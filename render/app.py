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
    """
    Fetch transactions and write directly to Supabase pending_transactions.
    This runs synchronously — the caller should set a long timeout or use
    a fire-and-forget pattern (the Vercel route returns immediately after
    triggering, and the UI polls pending_transactions for results).
    """
    data = request.get_json()
    cookies_b64 = data.get("cookies_b64", "")
    supabase_url = data.get("supabase_url", "")
    supabase_key = data.get("supabase_key", "")
    user_id = data.get("user_id", "")
    last_sync_at = data.get("last_sync_at")
    fund_category_id = data.get("fund_category_id")
    account_id = data.get("account_id", "tr_default")
    last_days = data.get("last_days", 7)

    if not cookies_b64:
        return jsonify({"status": "error", "message": "cookies_b64 required"}), 400

    phone = data.get("phone", "").strip() or "+4900000000000"

    try:
        import subprocess as sp

        # Restore session cookies for pytr CLI.
        cookies_dir = pathlib.Path.home() / ".pytr"
        cookies_dir.mkdir(parents=True, exist_ok=True)
        dest = cookies_dir / f"cookies.{phone}.txt"
        dest.write_bytes(base64.b64decode(cookies_b64))
        (cookies_dir / "credentials").write_text(f"{phone}\n0000")

        out_dir = pathlib.Path(tempfile.mkdtemp())
        out_file = out_dir / "transactions.json"

        try:
            result = sp.run(
                [
                    "pytr", "export_transactions",
                    "--export-format", "json",
                    "--waf-token", "awswaf",
                    "--last_days", str(last_days),
                    str(out_file),
                ],
                capture_output=True,
                text=True,
                timeout=120,
            )

            transactions = []
            if out_file.exists():
                for line in out_file.read_text().strip().split("\n"):
                    line = line.strip()
                    if line:
                        try:
                            transactions.append(json.loads(line))
                        except json.JSONDecodeError:
                            pass

            # Read back updated cookies.
            updated_b64 = None
            if dest.exists():
                updated_b64 = base64.b64encode(dest.read_bytes()).decode("ascii")

            # Write directly to Supabase if credentials provided.
            imported = 0
            if supabase_url and supabase_key and user_id and transactions:
                imported = _import_to_supabase(
                    supabase_url, supabase_key, user_id, account_id,
                    transactions, last_sync_at, fund_category_id, updated_b64,
                )

            return jsonify({
                "status": "ok",
                "transactions_count": len(transactions),
                "imported": imported,
                "cookies_b64": updated_b64,
            })
        finally:
            try:
                os.unlink(str(out_file))
                os.rmdir(str(out_dir))
            except OSError:
                pass

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


def _import_to_supabase(url, key, user_id, account_id, transactions,
                        last_sync_at, fund_category_id, updated_b64):
    """Write transactions into Supabase pending_transactions. Returns count."""
    import requests as req

    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }

    # Fetch existing IDs for dedup.
    existing_ids = set()
    try:
        r = req.get(
            f"{url}/rest/v1/pending_transactions?select=external_id&user_id=eq.{user_id}",
            headers=headers,
            timeout=10,
        )
        if r.ok:
            existing_ids = {e["external_id"] for e in r.json()}
    except Exception:
        pass

    # Fetch existing transaction signatures for dedup.
    existing_sigs = set()
    if last_sync_at:
        try:
            r = req.get(
                f"{url}/rest/v1/transactions"
                f"?select=amount,date,currency"
                f"&user_id=eq.{user_id}"
                f"&date=gte.{last_sync_at[:10]}",
                headers=headers,
                timeout=10,
            )
            if r.ok:
                for t in r.json():
                    amt = f"{float(t['amount']):.2f}"
                    d = t["date"][:10] if t.get("date") else ""
                    cur = t.get("currency", "EUR")
                    existing_sigs.add(f"{amt}_{d}_{cur}")
        except Exception:
            pass

    # Map and dedup.
    rows = []
    for item in transactions:
        value = item.get("Value") or 0
        if value == 0:
            continue
        amt = abs(value)
        date_str = item.get("Date", "")
        title = item.get("Note", "TR Transaction")
        ext_id = f"{date_str}_{title}_{value}"

        if ext_id in existing_ids:
            continue
        sig = f"{amt:.2f}_{date_str[:10]}_EUR"
        if sig in existing_sigs:
            continue

        tr_type = (item.get("Type") or "").lower()
        app_type = "income" if tr_type in ("deposit", "sell", "dividend", "interest") else "expense"

        rows.append({
            "user_id": user_id,
            "external_id": ext_id,
            "status": "pending",
            "data": {
                "amount": amt,
                "currency": "EUR",
                "date": date_str,
                "title": title,
                "type": app_type,
                "tr_type": tr_type.upper(),
                "isin": item.get("ISIN"),
                "shares": item.get("Shares"),
                "fund_category_id": fund_category_id,
            },
        })

    imported = 0
    if rows:
        r = req.post(
            f"{url}/rest/v1/pending_transactions",
            headers={**headers, "Prefer": "return=minimal"},
            json=rows,
            timeout=30,
        )
        if r.ok:
            imported = len(rows)

    # Update integration config with last_sync_at and refreshed cookies.
    if account_id:
        try:
            r = req.patch(
                f"{url}/rest/v1/integration_configs"
                f"?user_id=eq.{user_id}&provider=eq.trade_republic"
                f"&account_id=eq.{account_id}",
                headers=headers,
                json={
                    "last_sync_at": time.strftime("%Y-%m-%dT%H:%M:%S+00:00", time.gmtime()),
                    "settings": {"session_cookies": updated_b64, "auth_status": "authenticated"},
                },
                timeout=10,
            )
        except Exception:
            pass

    return imported


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5001)))
