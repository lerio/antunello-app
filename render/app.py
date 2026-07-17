"""
Trade Republic microservice for antunello-app.
Deploy on Render free tier. Called from the Vercel Next.js app via HTTP.

Endpoints:
  POST /auth/initiate  — { phone, pin } → { processId, countdownSeconds }
  POST /auth/complete  — { phone, pin, processId, code } → { cookies_b64 }
  POST /sync           — { phone, pin, cookies_b64, last_days } → { transactions, cookies_b64 }
"""

import json
import base64
import tempfile
import os
import time
import pathlib
from http.cookiejar import MozillaCookieJar

from flask import Flask, request, jsonify
from pytr.api import TradeRepublicApi

app = Flask(__name__)

# In-memory store for auth sessions (processId → pytr instance).
# Keys expire after 5 minutes.
_auth_sessions: dict[str, tuple[TradeRepublicApi, float]] = {}


def _cleanup_sessions():
    """Remove expired sessions."""
    now = time.time()
    expired = [k for k, (_, t) in _auth_sessions.items() if now - t > 300]
    for k in expired:
        del _auth_sessions[k]


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/auth/initiate", methods=["POST"])
def auth_initiate():
    """Step 1: phone + PIN → initiate web login, return processId."""
    _cleanup_sessions()
    data = request.get_json()
    phone = data.get("phone", "").strip()
    pin = data.get("pin", "").strip()
    if not phone or not pin:
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
        return jsonify({
            "status": "ok",
            "processId": pid,
            "countdownSeconds": countdown,
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/auth/complete", methods=["POST"])
def auth_complete():
    """Step 2: code → complete login, return base64 cookies."""
    _cleanup_sessions()
    data = request.get_json()
    pid = data.get("processId", "").strip()
    code = data.get("code", "").strip()
    phone = data.get("phone", "").strip()

    if not pid or not code:
        return jsonify({"status": "error", "message": "processId and code required"}), 400

    entry = _auth_sessions.pop(pid, None)
    if entry is None:
        return jsonify({"status": "error", "message": "session expired, re-initiate login"}), 410

    tr, _ = entry

    try:
        tr.complete_weblogin(code)

        # Save cookies to a temp file and base64-encode for transport.
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".txt")
        tmp.close()
        cookie_jar = MozillaCookieJar(tmp.name)
        for c in tr._websession.cookies:
            cookie_jar.set_cookie(c)
        cookie_jar.save(ignore_discard=True)

        with open(tmp.name, "rb") as f:
            cookies_b64 = base64.b64encode(f.read()).decode("ascii")
        os.unlink(tmp.name)

        return jsonify({"status": "ok", "cookies_b64": cookies_b64})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/sync", methods=["POST"])
def sync():
    """Fetch transactions using stored cookies only (no phone/PIN needed)."""
    data = request.get_json()
    cookies_b64 = data.get("cookies_b64", "")
    last_days = data.get("last_days", 7)

    if not cookies_b64:
        return jsonify({"status": "error", "message": "cookies_b64 required"}), 400

    try:
        # Write cookies to temp file.
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".txt")
        tmp.write(base64.b64decode(cookies_b64))
        tmp.close()

        # Use a placeholder phone — TradeRepublicApi needs one to construct
        # the cookies filename, but it won't be used for auth since we
        # pre-load the session cookies.
        tr = TradeRepublicApi(
            phone_no="+4900000000000",
            pin="0000",
            save_cookies=True,
            cookies_file=tmp.name,
            waf_token="playwright",
        )

        tr._websession.cookies = MozillaCookieJar(tmp.name)
        tr._websession.cookies.load(ignore_discard=True)

        if not tr.resume_websession():
            os.unlink(tmp.name)
            return jsonify({"status": "error", "message": "auth_required"}), 401

        # Fetch timeline directly via pytr's WebSocket API (no subprocess).
        timeline_items = _fetch_timeline(tr, last_days)

        # Read back updated cookies.
        tr._websession.cookies.save(ignore_discard=True)
        updated_b64 = None
        try:
            with open(tmp.name, "rb") as f:
                updated_b64 = base64.b64encode(f.read()).decode("ascii")
        except Exception:
            pass
        os.unlink(tmp.name)

        transactions = _parse_timeline(timeline_items)

        return jsonify({
            "status": "ok",
            "transactions": transactions,
            "cookies_b64": updated_b64,
        })

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


# ---------------------------------------------------------------------------
# Timeline fetching — uses pytr's WebSocket API directly
# ---------------------------------------------------------------------------

def _fetch_timeline(tr: TradeRepublicApi, last_days: int) -> list[dict]:
    """Fetch raw timeline items via pytr's internal WebSocket. Returns raw dicts."""
    import asyncio

    async def _collect():
        items = []
        since = (time.time() - last_days * 86400) * 1000  # ms timestamp

        timeline_id = await tr.timeline(since=since)
        detail_ids = set()

        while True:
            sid, sub, response = await tr.recv()
            if sid == timeline_id:
                if sub.get("type") == "timeline" and response:
                    for evt in response.get("items", []):
                        items.append(evt)
                        # Request details for events that have them.
                        eid = evt.get("id", "")
                        if eid and eid not in detail_ids:
                            detail_ids.add(eid)
                            await tr.timelineDetail(eid)
                else:
                    break  # timeline subscription closed

        # Collect detail responses (up to the requested count).
        detail_received = 0
        while detail_received < len(detail_ids):
            sid, sub, response = await tr.recv()
            if sub.get("type") == "timelineDetail":
                detail_received += 1
                # Details are injected into the matching item.
            if detail_received >= len(detail_ids):
                break

        return items

    loop = asyncio.new_event_loop()
    try:
        result = loop.run_until_complete(asyncio.wait_for(_collect(), timeout=60))
    finally:
        loop.close()

    return result or []


def _parse_timeline(items: list[dict]) -> list[dict]:
    """Convert raw timeline items to the same format pytr's export_transactions produces."""
    out = []
    for evt in items:
        action = evt.get("action", {}) or {}
        action_type = (action.get("type") or "").lower()
        status = (action.get("status") or "").lower()

        # Skip non-financial events.
        if action_type in ("", "device", "news", "benefit"):
            continue

        # Determine type and note.
        if action_type in ("card payment", "card refund", "card"):
            tr_type = "Removal" if "refund" not in action_type else "Deposit"
            note = f"Card Payment - {evt.get('title', 'Card')}"
        elif action_type in ("buy", "order"):
            tr_type = "Buy"
        elif action_type in ("sell"):
            tr_type = "Sell"
        elif action_type in ("dividend", "interest"):
            tr_type = action_type.capitalize()
        elif action_type in ("savings plan", "savingsplan"):
            tr_type = "Buy"
        elif action_type in ("deposit", "transfer in"):
            tr_type = "Deposit"
        elif action_type in ("fee", "tax"):
            tr_type = "Removal"
        else:
            tr_type = action_type.capitalize()

        note = evt.get("title", "") or tr_type

        # Extract amount — cash events have amount, others have amount+payout.
        amount_data = evt.get("amount", {}) or {}
        value = amount_data.get("value", 0) or 0

        out.append({
            "Date": evt.get("timestamp", ""),
            "Type": tr_type,
            "Value": value,
            "Note": note,
            "ISIN": evt.get("isin"),
            "Shares": evt.get("shares"),
            "Fees": evt.get("fees"),
            "Taxes": evt.get("taxes"),
            "ISIN2": None,
            "Shares2": None,
        })
    return out


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5001)))
