"""
Trade Republic microservice for antunello-app.
Deploy on Render free tier. Called from the Vercel Next.js app via HTTP.

Endpoints:
  POST /auth/initiate  — { phone, pin } → { processId, countdownSeconds }
  POST /auth/complete  — { phone, pin, processId, code } → { cookies_b64 }
  POST /sync           — { cookies_b64, supabase_url, … } → { transactions_count, imported, cookies_b64 }
  GET  /health         — { status: "ok" }

NOTE: This service does **not** update integration_configs. The Vercel
caller (utils/trade-republic/sync-service.ts) handles that after
receiving the response, preserving all settings fields.
"""

import base64
import os
import pathlib
import tempfile
import time
from http.cookiejar import MozillaCookieJar

from flask import Flask, request, jsonify
from pytr.api import TradeRepublicApi

from logging_config import setup_logging
from sync_service import run_sync

logger = setup_logging()
app = Flask(__name__)

# ---------------------------------------------------------------------------
# In-memory auth session store
# ---------------------------------------------------------------------------

# processId → (TradeRepublicApi instance, created_at timestamp)
_auth_sessions: dict[str, tuple[TradeRepublicApi, float]] = {}
_SESSION_TTL = 300  # seconds


def _cleanup_sessions() -> None:
    """Remove expired in-memory auth sessions."""
    now = time.time()
    expired = [k for k, (_, t) in _auth_sessions.items() if now - t > _SESSION_TTL]
    for k in expired:
        del _auth_sessions[k]
    if expired:
        logger.debug("Cleaned up %d expired auth session(s)", len(expired))


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


# ---------------------------------------------------------------------------
# Auth — structurally identical to the previous version (no bugs found)
# ---------------------------------------------------------------------------


@app.route("/auth/initiate", methods=["POST"])
def auth_initiate():
    """Step 1: phone + PIN → initiate web login, return processId."""
    _cleanup_sessions()
    data = request.get_json(silent=True) or {}
    phone = (data.get("phone") or "").strip()
    pin = (data.get("pin") or "").strip()

    if not phone or not pin:
        logger.warning("auth/initiate: missing phone or pin")
        return jsonify({"status": "error", "message": "phone and pin required"}), 400

    try:
        tr = TradeRepublicApi(
            phone_no=phone,
            pin=pin,
            save_cookies=False,
            waf_token="playwright",
        )
        countdown = tr.initiate_weblogin()
        pid = tr._process_id
        _auth_sessions[pid] = (tr, time.time())
        logger.info("Auth initiated — phone *%s  processId=%s", phone[-4:], pid)
        return jsonify(
            {"status": "ok", "processId": pid, "countdownSeconds": countdown}
        )
    except Exception as e:
        logger.error("auth/initiate failed for phone *%s: %s", phone[-4:], e)
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/auth/complete", methods=["POST"])
def auth_complete():
    """Step 2: code → complete login, return base64 cookies."""
    _cleanup_sessions()
    data = request.get_json(silent=True) or {}
    pid = (data.get("processId") or "").strip()
    code = (data.get("code") or "").strip()
    phone = (data.get("phone") or "").strip()

    if not pid or not code:
        logger.warning("auth/complete: missing processId or code")
        return (
            jsonify({"status": "error", "message": "processId and code required"}),
            400,
        )

    entry = _auth_sessions.pop(pid, None)
    if entry is None:
        logger.warning("auth/complete: session %s expired or not found", pid)
        return (
            jsonify({"status": "error", "message": "session expired, re-initiate login"}),
            410,
        )

    tr, _ = entry

    try:
        tr.complete_weblogin(code)

        # Serialise cookies to a temp file, base64-encode for transport.
        tmp_fd, tmp_name = tempfile.mkstemp(suffix=".txt")
        os.close(tmp_fd)
        tmp = pathlib.Path(tmp_name)
        cookie_jar = MozillaCookieJar(tmp)
        for c in tr._websession.cookies:
            cookie_jar.set_cookie(c)
        cookie_jar.save(ignore_discard=True)

        cookies_b64 = base64.b64encode(tmp.read_bytes()).decode("ascii")
        tmp.unlink()

        logger.info("Auth completed — phone *%s", phone[-4:])
        return jsonify({"status": "ok", "cookies_b64": cookies_b64})
    except Exception as e:
        logger.error("auth/complete failed: %s", e)
        return jsonify({"status": "error", "message": str(e)}), 500


# ---------------------------------------------------------------------------
# Sync
# ---------------------------------------------------------------------------


@app.route("/sync", methods=["POST"])
def sync():
    """Fetch transactions via pytr and import into Supabase.

    This endpoint does **not** update integration_configs — the Vercel
    *syncTradeRepublicAccount* function handles that after receiving
    the response, preserving all settings fields (phone_number,
    fund_category_id, bulk_fetch_enabled, etc.).
    """
    data = request.get_json(silent=True) or {}
    cookies_b64: str = data.get("cookies_b64", "")

    if not cookies_b64:
        logger.warning("/sync: missing cookies_b64")
        return jsonify({"status": "error", "message": "cookies_b64 required"}), 400

    phone: str = (data.get("phone") or "").strip() or "+4900000000000"

    result = run_sync(
        cookies_b64=cookies_b64,
        supabase_url=data.get("supabase_url", ""),
        supabase_key=data.get("supabase_key", ""),
        user_id=data.get("user_id", ""),
        account_id=data.get("account_id", "tr_default"),
        phone=phone,
        last_sync_at=data.get("last_sync_at"),
        fund_category_id=data.get("fund_category_id"),
        last_days=data.get("last_days", 7),
    )

    if result["status"] == "error":
        return jsonify(result), 500

    return jsonify(result)


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    setup_logging()
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5001)))
