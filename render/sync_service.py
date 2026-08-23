"""
Trade Republic sync orchestration.

Pure business logic — no Flask dependency. Delegates to *pytr_cli* for
data fetching and *supabase_client* for persistence.
"""

import pathlib
from typing import Any, Dict, List, Optional, Set, Tuple

from pytr_cli import load_event_enrichments, run_pytr_export
from supabase_client import SupabaseClient
from logging_config import setup_logging

logger = setup_logging()

# Transaction types that map to the app's "income" category.
_INCOME_TYPES: frozenset[str] = frozenset(
    {"deposit", "sell", "dividend", "interest"}
)


# ---------------------------------------------------------------------------
# Row mapping (pure functions — easily unit-testable)
# ---------------------------------------------------------------------------


def _app_type(tr_type: str) -> str:
    """Map a pytr transaction type to the app's income / expense enum."""
    return "income" if tr_type.lower() in _INCOME_TYPES else "expense"


def _build_row(
    item: Dict[str, Any],
    user_id: str,
    fund_category_id: Optional[str],
    external_id: str,
    value: float,
    bonus_info: Optional[Dict[str, Any]] = None,
    wealth_fund_category_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Convert one pytr transaction dict into a pending_transactions row."""
    date_str = item.get("Date", "")
    title = item.get("Note", "TR Transaction")
    tr_type = (item.get("Type") or "").lower()

    data: Dict[str, Any] = {
        "amount": abs(value),
        "currency": "EUR",
        "date": date_str,
        "title": title,
        "type": _app_type(tr_type),
        "tr_type": tr_type.upper() if tr_type else "",
        "isin": item.get("ISIN"),
        "shares": item.get("Shares"),
        "fund_category_id": fund_category_id,
    }
    # Bonus enrichment fields — only present when the timeline carried them.
    if bonus_info:
        if bonus_info.get("saveback_amount") is not None:
            data["saveback_amount"] = bonus_info["saveback_amount"]
        if bonus_info.get("round_up_amount") is not None:
            data["round_up_amount"] = bonus_info["round_up_amount"]
    if wealth_fund_category_id:
        data["wealth_fund_category_id"] = wealth_fund_category_id

    return {
        "user_id": user_id,
        "external_id": external_id,
        "status": "pending",
        "data": data,
    }


def _filter_and_build_rows(
    transactions: List[Dict[str, Any]],
    user_id: str,
    external_ids: Set[str],
    existing_sigs: Set[str],
    fund_category_id: Optional[str],
    enrichments: Optional[Dict[Tuple[str, str, float], Dict[str, Any]]] = None,
    wealth_fund_category_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Dedup and map raw pytr transactions to pending_transactions rows.

    Bonus handling: aggregate saveback/round-up executions are skipped (they
    double-count once per-card bonus transactions are generated at accept
    time), and card transactions carry their saveback/round-up amounts.
    """
    rows: List[Dict[str, Any]] = []
    skip_zero = 0
    skip_external = 0
    skip_sig = 0
    skip_aggregate = 0

    for item in transactions:
        try:
            value = float(item.get("Value") or 0.0)
        except (ValueError, TypeError):
            value = 0.0

        if value == 0.0:
            skip_zero += 1
            continue

        date_str = item.get("Date", "")
        title = item.get("Note", "TR Transaction")

        ext_id = f"{date_str}_{title}_{value}"

        if ext_id in external_ids:
            skip_external += 1
            continue

        sig = f"{abs(value):.2f}_{date_str[:10]}_EUR"
        if sig in existing_sigs:
            skip_sig += 1
            continue

        # Enrichment lookup after dedup — duplicates don't pay for it.
        info = (enrichments or {}).get((date_str[:19], title, value))
        if info and info.get("is_aggregate"):
            skip_aggregate += 1
            continue

        rows.append(
            _build_row(
                item,
                user_id,
                fund_category_id,
                ext_id,
                value,
                bonus_info=info,
                wealth_fund_category_id=wealth_fund_category_id,
            )
        )

    if skip_zero or skip_external or skip_sig or skip_aggregate:
        logger.info(
            "Dedup: %d zero-value skipped, %d aggregate skipped, "
            "%d external-id dupes skipped, %d signature dupes skipped → "
            "%d new row(s)",
            skip_zero,
            skip_aggregate,
            skip_external,
            skip_sig,
            len(rows),
        )

    return rows


# ---------------------------------------------------------------------------
# Public orchestration
# ---------------------------------------------------------------------------


def run_sync(
    *,
    cookies_b64: str,
    supabase_url: str,
    supabase_key: str,
    user_id: str,
    account_id: str,
    phone: str,
    last_sync_at: Optional[str],
    fund_category_id: Optional[str],
    last_days: int,
    wealth_fund_category_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Orchestrate a full Trade Republic sync.

    Args:
        cookies_b64: Base64-encoded Netscape cookie file.
        supabase_url: Supabase project URL.
        supabase_key: Supabase service-role key (bypasses RLS).
        user_id: Owning user UUID.
        account_id: Integration config account_id (e.g. ``tr_+39123...``).
        phone: Trade Republic phone number for cookie file lookup.
        last_sync_at: ISO timestamp of the previous successful sync.
        fund_category_id: Optional fund category to assign to new txns.
        last_days: Number of days to pass to ``pytr --last_days``.
        wealth_fund_category_id: Optional wealth fund category carried on
            pending rows for bonus transaction creation at accept time.

    Returns:
        A dict with keys *status*, *transactions_count*, *imported*,
        and *cookies_b64* (the possibly-refreshed session cookies).
    """
    logger.info(
        "Sync started — user=%s account=%s last_days=%d",
        user_id,
        account_id,
        last_days,
    )

    # ---- Step 1: fetch transactions via pytr ----
    try:
        pytr_result = run_pytr_export(cookies_b64, phone, last_days)
    except Exception as exc:
        logger.error("pytr execution raised: %s", exc)
        return {
            "status": "error",
            "message": f"pytr execution failed: {exc}",
            "transactions_count": 0,
            "imported": 0,
            "cookies_b64": None,
        }

    transactions = pytr_result.transactions
    logger.info(
        "Fetched %d transaction(s) from Trade Republic", len(transactions)
    )

    # ---- Detect expired session early — propagate auth_required ----
    if pytr_result.session_expired:
        logger.warning(
            "Trade Republic session expired for user=%s account=%s",
            user_id,
            account_id,
        )
        return {
            "status": "error",
            "message": (
                "auth_required: Trade Republic session expired. "
                "Please re-authenticate in Settings."
            ),
            "transactions_count": len(transactions),
            "imported": 0,
            "cookies_b64": pytr_result.updated_cookies_b64,
        }

    if not transactions:
        return {
            "status": "ok",
            "transactions_count": 0,
            "imported": 0,
            "cookies_b64": pytr_result.updated_cookies_b64,
        }

    # ---- Step 2: load timeline enrichment data ----
    # pytr writes its event database (with per-card saveback/round-up details)
    # to the service cwd. A missing/unreadable file only disables enrichment —
    # the sync still proceeds.
    enrichments = load_event_enrichments(pathlib.Path.cwd() / "all_events.json")

    # ---- Step 3: dedup and import into Supabase ----
    imported = 0
    try:
        db = SupabaseClient(supabase_url, supabase_key)
        external_ids = db.fetch_external_ids(user_id)
        existing_sigs = db.fetch_existing_signatures(user_id, last_sync_at)

        rows = _filter_and_build_rows(
            transactions,
            user_id,
            external_ids,
            existing_sigs,
            fund_category_id,
            enrichments=enrichments,
            wealth_fund_category_id=wealth_fund_category_id,
        )
        imported = db.insert_pending_transactions(rows)
    except ValueError as exc:
        logger.error("Supabase configuration error: %s", exc)
        return {
            "status": "error",
            "message": str(exc),
            "transactions_count": len(transactions),
            "imported": 0,
            "cookies_b64": pytr_result.updated_cookies_b64,
        }

    return {
        "status": "ok",
        "transactions_count": len(transactions),
        "imported": imported,
        "cookies_b64": pytr_result.updated_cookies_b64,
    }
