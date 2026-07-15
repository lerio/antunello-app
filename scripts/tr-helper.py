#!/usr/bin/env python3
"""
Trade Republic helper — called from the Node.js API routes to handle
auth and data fetching without interactive prompts.

Usage:
  python tr-helper.py init <phone> <pin>
    → {"status":"ok","processId":"...","countdownSeconds":61,"wafToken":"..."}

  python tr-helper.py complete <phone> <pin> <processId> <code> [<wafToken>]
    → {"status":"ok","cookies":"<base64>"}

  python tr-helper.py sync <phone> <pin> <cookies_base64> [--last-days N]
    → {"status":"ok","transactions":[...]}
"""

import sys
import json
import base64
import tempfile
import os
import pathlib
from http.cookiejar import MozillaCookieJar

# Add pytr to path if needed
try:
    from pytr.api import TradeRepublicApi
except ImportError:
    print(json.dumps({"status": "error", "message": "pytr not installed. Run: pip install pytr"}))
    sys.exit(1)


def init_login(phone, pin):
    """Step 1: initiate web login, return processId and countdown."""
    tr = TradeRepublicApi(
        phone_no=phone,
        pin=pin,
        save_cookies=False,
        waf_token="playwright",
    )
    countdown = tr.initiate_weblogin()
    return {
        "status": "ok",
        "processId": tr._process_id,
        "countdownSeconds": countdown,
        "wafToken": tr._waf_token if tr._waf_token not in ("playwright", "awswaf") else None,
    }


def complete_login(phone, pin, process_id, code, waf_token=None):
    """Step 2: complete web login with verification code, return cookies."""
    # Use a temp file so we can read back the cookies.
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".txt")
    tmp.close()

    # Determine WAF token source.
    waf = waf_token if waf_token and waf_token not in ("playwright", "awswaf") else "playwright"

    tr = TradeRepublicApi(
        phone_no=phone,
        pin=pin,
        save_cookies=True,
        cookies_file=tmp.name,
        waf_token=waf,
    )

    # Restore the process ID so complete_weblogin can use it.
    tr._process_id = process_id

    tr.complete_weblogin(code)
    tr.save_websession()

    # Read the cookies file and base64-encode it for transport.
    with open(tmp.name, "rb") as f:
        cookies_b64 = base64.b64encode(f.read()).decode("ascii")

    os.unlink(tmp.name)

    return {
        "status": "ok",
        "cookies": cookies_b64,
    }


def sync_transactions(phone, pin, cookies_b64, last_days=7):
    """Fetch transactions using stored session cookies."""
    # Write cookies to a temp file.
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".txt")
    tmp.write(base64.b64decode(cookies_b64))
    tmp.close()

    # Use "playwright" for WAF in case a fresh token is needed.
    tr = TradeRepublicApi(
        phone_no=phone,
        pin=pin,
        save_cookies=True,
        cookies_file=tmp.name,
        waf_token="playwright",
    )

    # Load the cookies into the session.
    tr._websession.cookies = MozillaCookieJar(tmp.name)
    tr._websession.cookies.load(ignore_discard=True)

    # Try to resume. If it fails, we need re-auth.
    if not tr.resume_websession():
        os.unlink(tmp.name)
        return {"status": "error", "message": "auth_required"}

    # Use pytr's export_transactions logic.
    # We call the main pytr CLI as a subprocess since the export logic is
    # in the CLI layer, not the API class.
    import subprocess as sp

    # Write credentials for the subprocess.
    cred_dir = pathlib.Path(tempfile.mkdtemp())
    cred_file = cred_dir / "credentials"
    cred_file.write_text(f"{phone}\n{pin}")

    # Copy cookies to the expected location.
    cookies_dir = pathlib.Path.home() / ".pytr"
    cookies_dir.mkdir(parents=True, exist_ok=True)
    dest = cookies_dir / f"cookies.{phone}.txt"
    dest.write_bytes(base64.b64decode(cookies_b64))

    # Also write credentials for the subprocess.
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

        # Read the exported transactions.
        tx_file = pathlib.Path(f"{cred_dir}/transactions.json")
        transactions = []
        if tx_file.exists():
            for line in tx_file.read_text().strip().split("\n"):
                line = line.strip()
                if line:
                    try:
                        transactions.append(json.loads(line))
                    except json.JSONDecodeError:
                        pass

        # Read updated cookies (session refresh may have modified them).
        updated_b64 = None
        if dest.exists():
            updated_b64 = base64.b64encode(dest.read_bytes()).decode("ascii")

        return {
            "status": "ok",
            "transactions": transactions,
            "cookies": updated_b64,
        }
    finally:
        # Clean up.
        try:
            os.unlink(f"{cred_dir}/transactions.json")
        except OSError:
            pass
        try:
            os.rmdir(cred_dir)
        except OSError:
            pass

    return {"status": "ok", "transactions": transactions}


if __name__ == "__main__":
    args = sys.argv[1:]

    if len(args) < 1:
        print(json.dumps({"status": "error", "message": "Missing command. Use: init, complete, or sync"}))
        sys.exit(1)

    cmd = args[0]

    try:
        if cmd == "init":
            if len(args) < 3:
                raise ValueError("Usage: init <phone> <pin>")
            print(json.dumps(init_login(args[1], args[2])))

        elif cmd == "complete":
            if len(args) < 5:
                raise ValueError("Usage: complete <phone> <pin> <processId> <code> [<wafToken>]")
            waf = args[5] if len(args) > 5 else None
            print(json.dumps(complete_login(args[1], args[2], args[3], args[4], waf)))

        elif cmd == "sync":
            if len(args) < 4:
                raise ValueError("Usage: sync <phone> <pin> <cookies_base64> [--last-days N]")
            last_days = 7
            if "--last-days" in args:
                idx = args.index("--last-days")
                last_days = int(args[idx + 1])
            print(json.dumps(sync_transactions(args[1], args[2], args[3], last_days)))

        else:
            print(json.dumps({"status": "error", "message": f"Unknown command: {cmd}"}))

    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))
        sys.exit(1)
