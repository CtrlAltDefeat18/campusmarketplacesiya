"""Standalone email test. Run from your project folder:  python3 mailtest.py"""
import os
import smtplib
import ssl
from email.message import EmailMessage


def load_env(path=".env"):
    if not os.path.isfile(path):
        print("!! .env NOT FOUND in this folder. Are you in the project directory?")
        return
    for line in open(path):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


load_env()
host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
port = int(os.environ.get("SMTP_PORT", "587"))
user = os.environ.get("SMTP_USER", "")
pw = os.environ.get("SMTP_PASS", "")

print("host :", host, "| port:", port)
print("user :", user or "(BLANK!)")
print("pass : len =", len(pw), "→", (pw[:2] + "*" * max(0, len(pw) - 2)) if pw else "(BLANK!)")
if len(pw) not in (0, 16):
    print("   ⚠️  Gmail app passwords are exactly 16 chars. Yours isn't —")
    print("       you probably copied the SPACES too. Remove them.")
if not user or not pw:
    print("\n>>> Credentials are blank — .env didn't load or values are empty. Fix .env first.")
    raise SystemExit

to = input("\nSend a test email to (an inbox you can check): ").strip()
msg = EmailMessage()
msg["Subject"] = "Campus Marketplace — SMTP test"
msg["From"] = os.environ.get("MAIL_FROM", user)
msg["To"] = to
msg.set_content("If you received this, your Gmail SMTP setup works. 🎉")

try:
    ctx = ssl.create_default_context()
    if port == 465:
        s = smtplib.SMTP_SSL(host, port, context=ctx, timeout=15)
    else:
        s = smtplib.SMTP(host, port, timeout=15)
        s.starttls(context=ctx)
    s.set_debuglevel(1)        # print the full SMTP conversation
    s.login(user, pw)
    s.send_message(msg)
    s.quit()
    print("\n>>> SENT OK ✅  — check the inbox AND the spam folder.")
except Exception as e:
    print("\n>>> FAILED ❌ :", type(e).__name__, "-", e)