from typing import Any, Dict, List, Optional, Set

import requests

from logging_config import setup_logging

logger = setup_logging()

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


class SupabaseClient:
    """Minimal Supabase REST client for the TR sync flow."""

    def __init__(self, url: str, key: str) -> None:
        if not url or not key:
            raise ValueError("supabase_url and supabase_key are required")
        self._url = url.rstrip("/")
        self._headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }

    # ------------------------------------------------------------------
    # Dedup helpers
    # ------------------------------------------------------------------

    def fetch_external_ids(self, user_id: str) -> Set[str]:
        """Return all *external_id* values from pending_transactions.

        Used to skip transactions that were already imported.
        Network / server errors are logged and an empty set is returned
        (conservative — the caller may create duplicates rather than lose
        data).
        """
        try:
            r = requests.get(
                f"{self._url}/rest/v1/pending_transactions"
                f"?select=external_id&user_id=eq.{user_id}",
                headers=self._headers,
                timeout=10,
            )
            if r.ok:
                ids = {e["external_id"] for e in r.json()}
                logger.debug("Fetched %d existing external_ids for dedup", len(ids))
                return ids

            logger.warning(
                "Failed to fetch external_ids: HTTP %d — %s",
                r.status_code,
                r.text[:300],
            )
        except requests.RequestException as exc:
            logger.error("Network error fetching external_ids: %s", exc)

        return set()

    def fetch_existing_signatures(
        self, user_id: str, last_sync_at: Optional[str]
    ) -> Set[str]:
        """Return signatures of confirmed transactions for dedup.

        Signature format: ``"{amount:.2f}_{date[:10]}_{currency}"``

        Only transactions on or after *last_sync_at* are considered;
        if *last_sync_at* is falsy an empty set is returned.
        """
        if not last_sync_at:
            return set()

        try:
            r = requests.get(
                f"{self._url}/rest/v1/transactions"
                f"?select=amount,date,currency"
                f"&user_id=eq.{user_id}"
                f"&date=gte.{last_sync_at[:10]}",
                headers=self._headers,
                timeout=10,
            )
            if r.ok:
                sigs = {
                    f"{float(t['amount']):.2f}_{(t.get('date') or '')[:10]}_{t.get('currency', 'EUR')}"
                    for t in r.json()
                }
                logger.debug(
                    "Fetched %d existing transaction signatures for dedup",
                    len(sigs),
                )
                return sigs

            logger.warning(
                "Failed to fetch transaction signatures: HTTP %d — %s",
                r.status_code,
                r.text[:300],
            )
        except requests.RequestException as exc:
            logger.error(
                "Network error fetching transaction signatures: %s", exc
            )

        return set()

    # ------------------------------------------------------------------
    # Writer
    # ------------------------------------------------------------------

    def insert_pending_transactions(self, rows: List[Dict[str, Any]]) -> int:
        """Insert rows into *pending_transactions*.

        Returns the number of rows successfully inserted (0 on any error).
        """
        if not rows:
            return 0

        try:
            r = requests.post(
                f"{self._url}/rest/v1/pending_transactions",
                headers={**self._headers, "Prefer": "return=minimal"},
                json=rows,
                timeout=30,
            )
            if r.ok:
                logger.info(
                    "Inserted %d row(s) into pending_transactions", len(rows)
                )
                return len(rows)

            logger.error(
                "Failed to insert pending_transactions: HTTP %d — %s",
                r.status_code,
                r.text[:500],
            )
        except requests.RequestException as exc:
            logger.error(
                "Network error inserting pending_transactions: %s", exc
            )

        return 0
