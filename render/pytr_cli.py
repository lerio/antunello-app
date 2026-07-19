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
