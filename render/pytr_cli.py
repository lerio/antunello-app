"""
Wrapper around the pytr CLI for Trade Republic data export.

Encapsulates subprocess invocation, JSON-lines parsing, and session
cookie management so the rest of the service never touches pytr internals.
"""

import base64
import json
import pathlib
import subprocess
import tempfile
from dataclasses import dataclass, field

from logging_config import setup_logging

logger = setup_logging()

# ---------------------------------------------------------------------------
# Data types
# ---------------------------------------------------------------------------


# Patterns in pytr stderr that indicate an expired/broken session.
_SESSION_EXPIRED_MARKERS = (
    "Resuming websession failed",
    "Initiating web login",
    "session expired",
    "auth_required",
)


@dataclass
class PytrResult:
    """Result of a pytr export_transactions invocation."""

    transactions: list[dict]
    updated_cookies_b64: str | None
    returncode: int
    stderr: str = field(repr=False)

    @property
    def session_expired(self) -> bool:
        """True if stderr indicates the session cookies are no longer valid."""
        stderr_lower = self.stderr.lower()
        return any(m.lower() in stderr_lower for m in _SESSION_EXPIRED_MARKERS)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _set_up_session_cookies(cookies_b64: str, phone: str) -> pathlib.Path:
    """Decode and write the Netscape cookie file for pytr.

    Returns the path to the cookie file so the caller can read back
    refreshed cookies after pytr runs.

    IMPORTANT: We deliberately do NOT write a credentials file.  If pytr
    finds a credentials file and the session cookies are expired, it will
    attempt an interactive web login using the stored PIN — which we don't
    have.  Without credentials, pytr can only try to resume the existing
    session and will fail cleanly if the cookies are stale.
    """
    cookies_dir = pathlib.Path.home() / ".pytr"
    cookies_dir.mkdir(parents=True, exist_ok=True)
    cookies_path = cookies_dir / f"cookies.{phone}.txt"
    cookies_path.write_bytes(base64.b64decode(cookies_b64))
    logger.info("Session cookies restored for phone *%s", phone[-4:])
    return cookies_path


def _parse_json_lines(file_path: pathlib.Path) -> list[dict]:
    """Parse a JSON-lines file into a list of dicts.

    Malformed lines are logged and skipped — they do not fail the parse.
    """
    if not file_path.exists():
        logger.warning("pytr output file %s does not exist", file_path)
        return []

    transactions: list[dict] = []
    for line in file_path.read_text().strip().split("\n"):
        line = line.strip()
        if not line:
            continue
        try:
            transactions.append(json.loads(line))
        except json.JSONDecodeError as exc:
            logger.warning("Skipping malformed JSON line in pytr output: %s", exc)

    logger.info("Parsed %d transaction(s) from pytr output", len(transactions))
    return transactions


# ---------------------------------------------------------------------------
# Timeline enrichment (saveback / round-up)
# ---------------------------------------------------------------------------

# Timeline event types for the monthly/batch aggregate executions. Once
# per-card bonus transactions are generated at accept time, these aggregates
# would double-count the same money and are skipped on import.
_AGGREGATE_EVENT_TYPES = frozenset(
    {
        "SAVEBACK_AGGREGATE",
        "SPARE_CHANGE_AGGREGATE",
        "BENEFITS_SAVEBACK_EXECUTION",
        "BENEFITS_SPARE_CHANGE_EXECUTION",
    }
)

# pytr prefixes the exported Note of card events with one of these
# (see Event.from_dict in pytr; the raw key may be translated, hence the
# English form "Card Payment").
_CARD_NOTE_PREFIXES = (
    "card_successful_transaction",
    "CARD_TRANSACTION",
    "Card Payment",
)


def _parse_de_amount(text: str) -> float | None:
    """Parse a German-localised amount string like "0,13 €" into a float.

    Returns None when the string cannot be parsed (callers then skip
    enrichment for that event).
    """
    if not text:
        return None
    cleaned = (
        text.replace(" ", " ")  # non-breaking space
        .replace("€", "")  # euro sign
        .strip()
        .replace(",", ".")
    )
    try:
        return float(cleaned)
    except ValueError:
        return None


def _extract_bonus_amounts(event: dict) -> tuple[float | None, float | None]:
    """Extract (saveback, round_up) amounts from a card event's details.

    Card events carry a "Vorteile" (benefits) section whose items are
    embeddedTimelineItem dicts with a subtitle like "Saveback · 1%" or
    "Round up · 1×" and a localised amount like "0,13 €". Returns None for
    amounts that are absent, zero or unparseable.
    """
    saveback: float | None = None
    round_up: float | None = None

    sections = (event.get("details") or {}).get("sections") or []
    for section in sections:
        if section.get("title") != "Vorteile":
            continue
        for item in section.get("data") or []:
            if not isinstance(item, dict):
                continue
            detail = item.get("detail")
            if not isinstance(detail, dict) or detail.get("type") != "embeddedTimelineItem":
                continue
            amount = _parse_de_amount(detail.get("amount") or "")
            if amount is None or amount <= 0:
                continue
            subtitle = detail.get("subtitle") or ""
            if subtitle.startswith("Saveback") and saveback is None:
                saveback = amount
            elif subtitle.startswith("Round up") and round_up is None:
                round_up = amount
    return saveback, round_up


def load_event_enrichments(path: pathlib.Path) -> dict[tuple[str, str, float], dict]:
    """Build a signature -> enrichment map from pytr's event database.

    pytr's `export_transactions` writes `all_events.json` into the output
    directory (the service cwd) after fetching every event's details, so card
    events contain the per-payment saveback/round-up amounts. Signatures match
    the exporter's Date/Note/Value triple: `(timestamp[:19], note, value)`.
    Card events are indexed under the raw title plus the note-prefixed
    variants pytr exports. A missing or corrupt file yields an empty map —
    sync proceeds without enrichment.
    """
    enrichments: dict[tuple[str, str, float], dict] = {}

    if not path.exists():
        logger.warning(
            "Event database %s not found — sync proceeds without enrichment", path
        )
        return enrichments

    try:
        with open(path, "r", encoding="utf-8") as f:
            events = json.load(f)
    except (json.JSONDecodeError, OSError) as exc:
        logger.warning(
            "Event database %s unreadable (%s) — sync proceeds without enrichment",
            path,
            exc,
        )
        return enrichments

    if not isinstance(events, list):
        logger.warning(
            "Event database %s has unexpected shape — sync proceeds without enrichment",
            path,
        )
        return enrichments

    enriched = 0
    for event in events:
        if not isinstance(event, dict):
            continue
        try:
            timestamp = str(event["timestamp"])[:19]
            title = str(event["title"])
            value = float(event["amount"]["value"])
        except (KeyError, TypeError, ValueError):
            continue

        event_type = (event.get("eventType") or "").upper()
        info: dict = {"is_aggregate": event_type in _AGGREGATE_EVENT_TYPES}

        if event_type == "CARD_TRANSACTION":
            saveback, round_up = _extract_bonus_amounts(event)
            if saveback is not None:
                info["saveback_amount"] = saveback
            if round_up is not None:
                info["round_up_amount"] = round_up
            if saveback is not None or round_up is not None:
                enriched += 1

        enrichments[(timestamp, title, value)] = info
        if event_type == "CARD_TRANSACTION":
            for prefix in _CARD_NOTE_PREFIXES:
                enrichments[(timestamp, f"{prefix} - {title}", value)] = info
        elif info["is_aggregate"]:
            # SAVEBACK aggregates export a second companion row (the DEPOSIT
            # half of the buy+deposit pair) with the negated value — index it
            # so both halves are skipped.
            enrichments[(timestamp, title, -value)] = info

    logger.info(
        "Event database loaded: %d event(s), %d card event(s) with bonus amounts",
        len(enrichments),
        enriched,
    )
    return enrichments


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def run_pytr_export(cookies_b64: str, phone: str, last_days: int) -> PytrResult:
    """Run ``pytr export_transactions`` and return the parsed results.

    Args:
        cookies_b64: Base64-encoded Netscape cookie file.
        phone: Trade Republic phone number (used to locate the cookie file).
        last_days: Number of days to fetch (passed as ``--last_days``).

    Returns:
        A *PytrResult* with parsed transactions and updated cookie data.
        A non-zero *returncode* means pytr exited with an error — the caller
        should inspect *stderr* and decide whether to proceed.

    Raises:
        subprocess.TimeoutExpired: If pytr takes longer than 120 s.
    """
    cookies_path = _set_up_session_cookies(cookies_b64, phone)

    # NOTE: the export file goes to a temp dir, but pytr's event database
    # (`all_events.json`) is written to its default --outputdir, i.e. the
    # service cwd — run_sync reads it from there for bonus enrichment. If a
    # --outputdir flag is ever added here, update run_sync accordingly.
    out_dir = pathlib.Path(tempfile.mkdtemp())
    out_file = out_dir / "transactions.json"

    logger.info("Launching pytr export_transactions (last_days=%d)", last_days)

    try:
        result = subprocess.run(
            [
                "pytr",
                "export_transactions",
                "--export-format",
                "json",
                "--waf-token",
                "awswaf",
                "--store_credentials",   # load cookies from ~/.pytr/
                "--last_days",
                str(last_days),
                "-n",
                phone,
                "-p",
                "0000",                  # dummy PIN — prevents interactive getpass prompt;
                str(out_file),           # only used as fallback when cookies are expired
            ],
            capture_output=True,
            text=True,
            timeout=120,
        )

        # --- Bug fix: check exit code ---
        if result.returncode != 0:
            logger.error(
                "pytr exited with code %d. stderr:\n%s",
                result.returncode,
                result.stderr.strip(),
            )
        else:
            logger.info("pytr completed successfully (rc=0)")

        # --- Bug fix: always surface stderr ---
        stderr_clean = result.stderr.strip()
        if stderr_clean:
            logger.info("pytr stderr: %s", stderr_clean)

        transactions = _parse_json_lines(out_file)

        # pytr may refresh session cookies in-place — read them back.
        updated_b64: str | None = None
        if cookies_path.exists():
            updated_b64 = base64.b64encode(cookies_path.read_bytes()).decode(
                "ascii"
            )

        return PytrResult(
            transactions=transactions,
            updated_cookies_b64=updated_b64,
            returncode=result.returncode,
            stderr=stderr_clean,
        )

    except subprocess.TimeoutExpired:
        logger.error("pytr export_transactions timed out after 120 s")
        raise

    finally:
        # Best-effort cleanup of temporary output directory.
        try:
            out_file.unlink(missing_ok=True)
            out_dir.rmdir()
        except OSError as exc:
            logger.debug("Temp file cleanup skipped: %s", exc)
