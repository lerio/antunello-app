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
    """Fetch transactions using stored cookies."""
    data = request.get_json()
    phone = data.get("phone", "").strip()
    pin = data.get("pin", "").strip()
    cookies_b64 = data.get("cookies_b64", "")
    last_days = data.get("last_days", 7)

    if not phone or not pin or not cookies_b64:
        return jsonify({"status": "error", "message": "phone, pin, and cookies_b64 required"}), 400

    try:
        # Write cookies to temp file.
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".txt")
        tmp.write(base64.b64decode(cookies_b64))
        tmp.close()

        tr = TradeRepublicApi(
            phone_no=phone,
            pin=pin,
            save_cookies=True,
            cookies_file=tmp.name,
            waf_token="playwright",
        )

        # Load cookies and try to resume.
        tr._websession.cookies = MozillaCookieJar(tmp.name)
        tr._websession.cookies.load(ignore_discard=True)

        if not tr.resume_websession():
            os.unlink(tmp.name)
            return jsonify({"status": "error", "message": "auth_required"}), 401

        # Run export_transactions via pytr CLI (uses the stored cookies).
        import subprocess as sp

        # Write credentials for the pytr subprocess.
        cred_dir = pathlib.Path(tempfile.mkdtemp())
        (cred_dir / "credentials").write_text(f"{phone}\n{pin}")

        # Copy cookies to the expected location.
        cookies_dir = pathlib.Path.home() / ".pytr"
        cookies_dir.mkdir(parents=True, exist_ok=True)
        dest = cookies_dir / f"cookies.{phone}.txt"
        dest.write_bytes(base64.b64decode(cookies_b64))
        (cookies_dir / "credentials").write_text(f"{phone}\n{pin}")

        try:
            result = sp.run(
                [
                    "pytr", "export_transactions",
                    "--export-format", "json",
                    "--last_days", str(last_days),
                    "--no-date-with-time",
                    f"{cred_dir}/transactions.json",
                ],
                capture_output=True,
                text=True,
                timeout=120,
            )

            transactions = []
            tx_file = pathlib.Path(f"{cred_dir}/transactions.json")
            if tx_file.exists():
                for line in tx_file.read_text().strip().split("\n"):
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

            return jsonify({
                "status": "ok",
                "transactions": transactions,
                "cookies_b64": updated_b64,
            })
        finally:
            try:
                os.unlink(f"{cred_dir}/transactions.json")
                os.rmdir(cred_dir)
            except OSError:
                pass
            try:
                os.unlink(tmp.name)
            except OSError:
                pass

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
