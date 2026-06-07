#!/usr/bin/env python3
"""
Campus Marketplace · Makhanda — Flask backend.

A single-file, dependency-light backend for the pilot:
  • Serves every page (clean URLs AND legacy *.html links) + root assets.
  • A real JSON API backed by SQLite (no external DB service required).
  • Runs on 0.0.0.0:5000 so Google Cloud Shell "Web Preview" can reach it.

Run (no virtualenv needed):
    pip install --user -r requirements.txt
    python3 app.py
    # then open the Web Preview on port 5000
"""

import json
import os
import re
import secrets
import smtplib
import sqlite3
import ssl
import time
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

from flask import (Flask, abort, g, jsonify, redirect, request,
                   send_from_directory, session)
from werkzeug.security import check_password_hash, generate_password_hash


def _load_dotenv(path):
    """Minimal .env loader (no dependency). KEY=value lines; existing env wins."""
    if not os.path.isfile(path):
        return
    with open(path) as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

# ── Paths & config ──────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "marketplace.db")

PORT = int(os.environ.get("PORT", "5000"))
DEBUG = os.environ.get("FLASK_DEBUG", "").lower() in ("1", "true", "yes")

# Pilot admin credentials — override via env in production.
ADMIN_USER = os.environ.get("ADMIN_USER", "admin")
ADMIN_PASS = os.environ.get("ADMIN_PASS", "campus2025")
ADMIN_KEY = os.environ.get("ADMIN_KEY", "cm-makhanda-pilot-key")

# ── User auth config ─────────────────────────────────────────────────────────
# Session signing key. MUST be set via env in production (any long random string).
SECRET_KEY = os.environ.get("SECRET_KEY", "dev-only-change-me-in-production")

# Rhodes email gates: students  g##X####@campus.ru.ac.za ; staff  name@ru.ac.za
STUDENT_EMAIL_RE = re.compile(r"^g\d{2}[a-z]\d{4}@campus\.ru\.ac\.za$", re.I)
STAFF_EMAIL_RE = re.compile(r"^[a-z0-9][a-z0-9._-]*@ru\.ac\.za$", re.I)

# Password policy + login lockout
PW_MIN_LEN = 8
MAX_ATTEMPTS = 3    # failed logins before lockout
LOCK_MINUTES = 15   # how long the lockout lasts

# ── Email (Gmail SMTP) config — set these in a .env file (see .env.example) ───
SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")          # your full Gmail address
SMTP_PASS = os.environ.get("SMTP_PASS", "")          # the 16-char Gmail app password
MAIL_FROM = os.environ.get("MAIL_FROM", SMTP_USER or "Campus Marketplace")
APP_BASE_URL = os.environ.get("APP_BASE_URL", "").rstrip("/")  # optional override
MAIL_ENABLED = bool(SMTP_USER and SMTP_PASS)

# Files we are willing to serve from the project root (by extension).
SERVABLE_EXT = {
    ".html", ".svg", ".js", ".mjs", ".css", ".png", ".jpg", ".jpeg",
    ".webp", ".gif", ".ico", ".json", ".woff", ".woff2", ".map",
}
# Build/backend config that matches a servable extension but must stay private.
DENY_NAMES = {
    "tailwind.config.js", "postcss.config.js", "package.json",
    "package-lock.json", "input.css",
}

app = Flask(__name__, static_folder="static", static_url_path="/static")
app.json.sort_keys = False  # preserve insertion order in responses
app.secret_key = SECRET_KEY  # signs the session cookie


# ── Database ────────────────────────────────────────────────────────────────
def get_db():
    db = getattr(g, "_db", None)
    if db is None:
        db = g._db = sqlite3.connect(DB_PATH)
        db.row_factory = sqlite3.Row
    return db


@app.teardown_appcontext
def close_db(_exc):
    db = getattr(g, "_db", None)
    if db is not None:
        db.close()


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def init_db():
    os.makedirs(DATA_DIR, exist_ok=True)
    con = sqlite3.connect(DB_PATH)
    con.executescript(
        """
        CREATE TABLE IF NOT EXISTS listings (
            id         TEXT PRIMARY KEY,
            data       TEXT NOT NULL,
            status     TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS news (
            id         TEXT PRIMARY KEY,
            data       TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS suggestions (
            id         TEXT PRIMARY KEY,
            data       TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS users (
            id              TEXT PRIMARY KEY,
            email           TEXT UNIQUE NOT NULL,
            role            TEXT NOT NULL,                 -- 'student' | 'staff'
            name            TEXT NOT NULL DEFAULT '',
            pw_hash         TEXT NOT NULL,
            verified        INTEGER NOT NULL DEFAULT 0,
            bio             TEXT NOT NULL DEFAULT '',
            photo_url       TEXT NOT NULL DEFAULT '',
            phone           TEXT NOT NULL DEFAULT '',
            phone_verified  INTEGER NOT NULL DEFAULT 0,
            failed_attempts INTEGER NOT NULL DEFAULT 0,
            locked_until    TEXT,
            verify_token    TEXT,
            reset_token     TEXT,
            reset_expires   TEXT,
            created_at      TEXT NOT NULL
        );
        """
    )
    con.commit()

    # Seed demo content once, so the pilot looks alive on first boot.
    if con.execute("SELECT COUNT(*) FROM listings").fetchone()[0] == 0:
        for p in SEED_LISTINGS:
            con.execute(
                "INSERT INTO listings (id, data, status, created_at) VALUES (?,?,?,?)",
                (p["id"], json.dumps(p), p.get("status", "approved"), now_iso()),
            )
    if con.execute("SELECT COUNT(*) FROM news").fetchone()[0] == 0:
        for n in SEED_NEWS:
            con.execute(
                "INSERT INTO news (id, data, created_at) VALUES (?,?,?)",
                (n["id"], json.dumps(n), now_iso()),
            )
    con.commit()
    con.close()


def row_to_listing(row):
    item = json.loads(row["data"])
    item["status"] = row["status"]
    item["created_at"] = row["created_at"]
    return item


# ── Auth helper ─────────────────────────────────────────────────────────────
def is_admin():
    key = request.headers.get("X-Admin-Key") or request.args.get("key", "")
    return key == ADMIN_KEY


# ── API: health ─────────────────────────────────────────────────────────────
@app.get("/api/health")
def api_health():
    return jsonify(ok=True, service="campus-marketplace", time=now_iso())


# ── API: listings ───────────────────────────────────────────────────────────
@app.get("/api/listings")
def api_listings():
    status = request.args.get("status", "approved")
    db = get_db()
    if status == "all":
        if not is_admin():
            abort(403)
        rows = db.execute("SELECT * FROM listings ORDER BY created_at DESC").fetchall()
    else:
        rows = db.execute(
            "SELECT * FROM listings WHERE status=? ORDER BY created_at DESC", (status,)
        ).fetchall()
    return jsonify([row_to_listing(r) for r in rows])


@app.post("/api/listings")
def api_create_listing():
    body = request.get_json(silent=True) or {}
    title = (body.get("title") or "").strip()
    if not title:
        return jsonify(ok=False, error="Title is required"), 400

    pid = "p" + format(int(time.time() * 1000), "x")
    listing = {
        "id": pid,
        "title": title[:120],
        "price": _safe_float(body.get("price")),
        "category": (body.get("category") or "Miscellaneous").strip(),
        "condition": (body.get("condition") or "").strip(),
        "desc": (body.get("desc") or "").strip()[:1200],
        "location": (body.get("location") or "").strip(),
        "imageUrl": body.get("imageUrl") or "",
        "allImages": body.get("allImages") or [],
        "emoji": body.get("emoji") or "📦",
        "bg": body.get("bg") or "#ede9fe",
        "boost": body.get("boost") or "",
        "dateAdded": datetime.now().strftime("%Y-%m-%d"),
        "active": True,
        "seller": {
            "name": (body.get("seller", {}).get("name") or "").strip()[:80],
            "faculty": (body.get("seller", {}).get("faculty") or "").strip()[:80],
            "whatsapp": _digits(body.get("seller", {}).get("whatsapp")),
            "phone": (body.get("seller", {}).get("phone") or "").strip()[:30],
            "facebook": (body.get("seller", {}).get("facebook") or "").strip()[:200],
            "email": (body.get("seller", {}).get("email") or "").strip()[:120],
        },
    }
    db = get_db()
    db.execute(
        "INSERT INTO listings (id, data, status, created_at) VALUES (?,?,?,?)",
        (pid, json.dumps(listing), "pending", now_iso()),
    )
    db.commit()
    return jsonify(ok=True, id=pid, status="pending"), 201


@app.post("/api/listings/<lid>/status")
def api_set_status(lid):
    if not is_admin():
        abort(403)
    new_status = (request.get_json(silent=True) or {}).get("status", "")
    if new_status not in ("approved", "rejected", "pending", "sold"):
        return jsonify(ok=False, error="Invalid status"), 400
    db = get_db()
    row = db.execute("SELECT * FROM listings WHERE id=?", (lid,)).fetchone()
    if not row:
        abort(404)
    data = json.loads(row["data"])
    data["sold"] = new_status == "sold"
    db.execute(
        "UPDATE listings SET status=?, data=? WHERE id=?",
        (new_status, json.dumps(data), lid),
    )
    db.commit()
    return jsonify(ok=True, id=lid, status=new_status)


@app.delete("/api/listings/<lid>")
def api_delete_listing(lid):
    if not is_admin():
        abort(403)
    db = get_db()
    db.execute("DELETE FROM listings WHERE id=?", (lid,))
    db.commit()
    return jsonify(ok=True, id=lid)


# ── API: stats ──────────────────────────────────────────────────────────────
@app.get("/api/stats")
def api_stats():
    db = get_db()
    approved = db.execute(
        "SELECT * FROM listings WHERE status='approved'"
    ).fetchall()
    sellers = set()
    cats = set()
    for r in approved:
        d = json.loads(r["data"])
        sellers.add((d.get("seller") or {}).get("name") or "?")
        cats.add(d.get("category") or "?")
    pending = db.execute(
        "SELECT COUNT(*) FROM listings WHERE status='pending'"
    ).fetchone()[0]
    return jsonify(
        listings=len(approved),
        sellers=len(sellers),
        categories=max(len(cats), 10),
        pending=pending,
    )


# ── API: news ───────────────────────────────────────────────────────────────
@app.get("/api/news")
def api_news():
    db = get_db()
    rows = db.execute("SELECT * FROM news ORDER BY created_at DESC").fetchall()
    return jsonify([json.loads(r["data"]) for r in rows])


@app.post("/api/news")
def api_create_news():
    if not is_admin():
        abort(403)
    body = request.get_json(silent=True) or {}
    title = (body.get("title") or "").strip()
    if not title:
        return jsonify(ok=False, error="Title is required"), 400
    nid = "n" + format(int(time.time() * 1000), "x")
    item = {
        "id": nid,
        "tag": (body.get("tag") or "News").strip(),
        "title": title[:160],
        "excerpt": (body.get("excerpt") or "").strip()[:300],
        "content": body.get("content") or f"<p>{body.get('excerpt', '')}</p>",
        "emoji": body.get("emoji") or "📰",
        "date": datetime.now().strftime("%b %Y"),
        "active": True,
    }
    db = get_db()
    db.execute(
        "INSERT INTO news (id, data, created_at) VALUES (?,?,?)",
        (nid, json.dumps(item), now_iso()),
    )
    db.commit()
    return jsonify(ok=True, id=nid), 201


# ── API: suggestions ────────────────────────────────────────────────────────
@app.get("/api/suggestions")
def api_suggestions():
    db = get_db()
    rows = db.execute(
        "SELECT * FROM suggestions ORDER BY created_at DESC LIMIT 50"
    ).fetchall()
    return jsonify([json.loads(r["data"]) for r in rows])


@app.post("/api/suggestions")
def api_create_suggestion():
    body = request.get_json(silent=True) or {}
    title = (body.get("title") or "").strip()
    text = (body.get("body") or "").strip()
    if not title or not text:
        return jsonify(ok=False, error="Title and body required"), 400
    sid = "s" + format(int(time.time() * 1000), "x")
    item = {
        "id": sid,
        "kind": (body.get("kind") or "💬 Other").strip()[:40],
        "title": title[:120],
        "body": text[:1200],
        "name": (body.get("name") or "").strip()[:80] or "Anonymous student",
        "email": (body.get("email") or "").strip()[:120],
        "developer": bool(body.get("developer")),
        "date": datetime.now().strftime("%b %d, %Y"),
    }
    db = get_db()
    db.execute(
        "INSERT INTO suggestions (id, data, created_at) VALUES (?,?,?)",
        (sid, json.dumps(item), now_iso()),
    )
    db.commit()
    return jsonify(ok=True, id=sid), 201


# ── API: admin login ────────────────────────────────────────────────────────
@app.post("/api/admin/login")
def api_admin_login():
    body = request.get_json(silent=True) or {}
    if body.get("username") == ADMIN_USER and body.get("password") == ADMIN_PASS:
        return jsonify(ok=True, key=ADMIN_KEY)
    return jsonify(ok=False, error="Invalid credentials"), 401


# ── User auth: helpers ───────────────────────────────────────────────────────
def classify_email(email):
    """Return 'student' or 'staff' for a valid Rhodes address, else None."""
    email = (email or "").strip().lower()
    if STUDENT_EMAIL_RE.match(email):
        return "student"
    if STAFF_EMAIL_RE.match(email):
        return "staff"
    return None


def password_problem(pw):
    """Return a human-readable error if the password is too weak, else None."""
    pw = pw or ""
    if len(pw) < PW_MIN_LEN:
        return f"Password must be at least {PW_MIN_LEN} characters."
    if not re.search(r"\d", pw):
        return "Password must contain at least one number."
    if not re.search(r"[^A-Za-z0-9]", pw):
        return "Password must contain at least one special character."
    return None


def public_user(row):
    """User dict that is safe to send to the browser (no hash / tokens)."""
    if not row:
        return None
    return {
        "id": row["id"], "email": row["email"], "role": row["role"],
        "name": row["name"], "verified": bool(row["verified"]),
        "bio": row["bio"], "photo_url": row["photo_url"],
        "phone": row["phone"], "phone_verified": bool(row["phone_verified"]),
    }


def find_user(email):
    return get_db().execute(
        "SELECT * FROM users WHERE email = ?", ((email or "").strip().lower(),)
    ).fetchone()


def current_user_row():
    uid = session.get("uid")
    if not uid:
        return None
    return get_db().execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()


def abs_url(path):
    """Absolute URL for links inside emails. Uses APP_BASE_URL if set,
    otherwise the host of the current request (works on Cloud Shell preview)."""
    base = APP_BASE_URL or request.host_url.rstrip("/")
    return base + path


def send_email(to, subject, html_body, text_body=None):
    """Send one email via SMTP. Returns True on success. Never raises —
    on failure (or if mail isn't configured) it logs and returns False so
    the calling flow keeps working."""
    if not MAIL_ENABLED:
        print(f"\n  [mail disabled] to={to} subject={subject!r}\n", flush=True)
        return False
    try:
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = MAIL_FROM
        msg["To"] = to
        msg.set_content(text_body or "Open this email in an HTML-capable client.")
        msg.add_alternative(html_body, subtype="html")
        ctx = ssl.create_default_context()
        if SMTP_PORT == 465:
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=ctx, timeout=15) as s:
                s.login(SMTP_USER, SMTP_PASS)
                s.send_message(msg)
        else:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as s:
                s.starttls(context=ctx)
                s.login(SMTP_USER, SMTP_PASS)
                s.send_message(msg)
        return True
    except Exception as exc:  # noqa: BLE001 — pilot: log and continue
        print(f"\n  [mail ERROR] to={to}: {exc}\n", flush=True)
        return False


def _email_shell(title, intro, button_label, link):
    """Shared branded HTML wrapper for our transactional emails."""
    return f"""<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:auto;padding:8px">
      <h2 style="color:#6d28d9;margin:0 0 12px">{title}</h2>
      <p style="color:#333;line-height:1.6">{intro}</p>
      <p style="margin:22px 0">
        <a href="{link}" style="display:inline-block;background:#6d28d9;color:#fff;
           padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600">{button_label}</a>
      </p>
      <p style="color:#666;font-size:13px;line-height:1.5">Or paste this link into your browser:<br>
        <span style="color:#6d28d9;word-break:break-all">{link}</span></p>
      <p style="color:#999;font-size:12px;margin-top:20px">Campus Marketplace · Makhanda. If you didn't request this, you can ignore this email.</p>
    </div>"""


def send_verification_email(email, token):
    link = abs_url(f"/api/auth/verify?token={token}")
    html = _email_shell(
        "Verify your Campus Marketplace account",
        "Welcome aboard! Tap the button below to verify this email and activate your account.",
        "Verify my email", link)
    sent = send_email(email, "Verify your Campus Marketplace account", html,
                      f"Verify your account: {link}")
    if not sent:  # dev fallback so the flow stays testable without SMTP
        print(f"\n  [verify] {email} -> {link}\n", flush=True)
    return link


# ── User auth: endpoints ─────────────────────────────────────────────────────
@app.post("/api/auth/register")
def api_register():
    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip().lower()
    name = (body.get("name") or "").strip()[:80]
    pw = body.get("password") or ""

    role = classify_email(email)
    if not role:
        return jsonify(ok=False, error=(
            "Use your Rhodes email — students like g22a1234@campus.ru.ac.za, "
            "staff like name@ru.ac.za.")), 400
    perr = password_problem(pw)
    if perr:
        return jsonify(ok=False, error=perr), 400
    if not name:
        return jsonify(ok=False, error="Please enter your name."), 400
    if find_user(email):
        return jsonify(ok=False, error="That email is already registered. Try logging in."), 409

    uid = "u" + secrets.token_hex(6)
    token = secrets.token_urlsafe(24)
    db = get_db()
    db.execute(
        """INSERT INTO users (id, email, role, name, pw_hash, verified,
                              verify_token, created_at)
           VALUES (?,?,?,?,?,0,?,?)""",
        (uid, email, role, name, generate_password_hash(pw), token, now_iso()),
    )
    db.commit()
    link = send_verification_email(email, token)
    resp = {"ok": True, "role": role,
            "message": "Account created. Check your Rhodes email to verify before logging in."}
    if DEBUG or not MAIL_ENABLED:
        resp["dev_verify_link"] = link  # only when email isn't actually being sent
    return jsonify(resp), 201


@app.get("/api/auth/verify")
def api_verify():
    token = request.args.get("token", "")
    if not token:
        abort(404)
    db = get_db()
    row = db.execute("SELECT * FROM users WHERE verify_token = ?", (token,)).fetchone()
    if not row:
        return redirect("/login?verified=bad")
    db.execute("UPDATE users SET verified = 1, verify_token = NULL WHERE id = ?", (row["id"],))
    db.commit()
    return redirect("/login?verified=1")


@app.post("/api/auth/resend")
def api_resend():
    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip().lower()
    row = find_user(email)
    # Always answer ok — never reveal which emails exist or are already verified.
    if row and not row["verified"]:
        token = secrets.token_urlsafe(24)
        db = get_db()
        db.execute("UPDATE users SET verify_token = ? WHERE id = ?", (token, row["id"]))
        db.commit()
        link = send_verification_email(email, token)
        resp = {"ok": True}
        if DEBUG or not MAIL_ENABLED:
            resp["dev_verify_link"] = link
        return jsonify(resp)
    return jsonify(ok=True)


@app.post("/api/auth/login")
def api_login():
    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip().lower()
    pw = body.get("password") or ""
    row = find_user(email)

    GENERIC = "Invalid email or password."  # don't reveal which emails exist
    if not row:
        return jsonify(ok=False, error=GENERIC), 401

    # Currently locked out?
    if row["locked_until"]:
        try:
            lu = datetime.fromisoformat(row["locked_until"])
            now = datetime.now(timezone.utc)
            if lu > now:
                mins = max(1, int((lu - now).total_seconds() // 60) + 1)
                return jsonify(ok=False, error=f"Too many attempts. Try again in {mins} min."), 423
        except ValueError:
            pass

    db = get_db()
    if not check_password_hash(row["pw_hash"], pw):
        attempts = row["failed_attempts"] + 1
        if attempts >= MAX_ATTEMPTS:
            lock = (datetime.now(timezone.utc) + timedelta(minutes=LOCK_MINUTES)
                    ).isoformat(timespec="seconds")
            db.execute("UPDATE users SET failed_attempts=?, locked_until=? WHERE id=?",
                       (attempts, lock, row["id"]))
            db.commit()
            return jsonify(ok=False, error=f"Too many attempts. Locked for {LOCK_MINUTES} min."), 423
        db.execute("UPDATE users SET failed_attempts=? WHERE id=?", (attempts, row["id"]))
        db.commit()
        left = MAX_ATTEMPTS - attempts
        return jsonify(ok=False, error=f"{GENERIC} {left} attempt(s) left."), 401

    if not row["verified"]:
        return jsonify(ok=False, need_verify=True,
                       error="Please verify your email first — check your inbox."), 403

    # Success — reset counters and start the session.
    db.execute("UPDATE users SET failed_attempts=0, locked_until=NULL WHERE id=?", (row["id"],))
    db.commit()
    session.clear()
    session["uid"] = row["id"]
    session.permanent = True
    return jsonify(ok=True, user=public_user(row))


@app.post("/api/auth/logout")
def api_logout():
    session.clear()
    return jsonify(ok=True)


@app.get("/api/auth/me")
def api_me():
    return jsonify(user=public_user(current_user_row()))


# ── Page & asset serving ────────────────────────────────────────────────────
@app.get("/")
def home():
    return send_from_directory(BASE_DIR, "index.html")


@app.get("/<path:filename>")
def page_or_asset(filename):
    """Serve a clean page route (/marketplace), a legacy link (/marketplace.html),
    or a whitelisted root asset (logo.svg, config.js, ...). Never serves source."""
    if filename.startswith("api/"):
        abort(404)

    name = filename.strip("/")
    if "." not in os.path.basename(name):  # clean URL → map to .html page
        name = name + ".html"

    safe = os.path.normpath(name)
    if safe.startswith("..") or os.path.isabs(safe) or safe.startswith("."):
        abort(404)
    if os.path.splitext(safe)[1].lower() not in SERVABLE_EXT:
        abort(404)
    if os.path.basename(safe) in DENY_NAMES:
        abort(404)
    if not os.path.isfile(os.path.join(BASE_DIR, safe)):
        abort(404)
    return send_from_directory(BASE_DIR, safe)


# ── Helpers ─────────────────────────────────────────────────────────────────
def _safe_float(v):
    try:
        return round(float(v), 2)
    except (TypeError, ValueError):
        return 0.0


def _digits(v):
    return "".join(ch for ch in str(v or "") if ch.isdigit())


# ── Seed data (mirrors the landing-page demo set for visual consistency) ─────
SEED_LISTINGS = [
    {"id": "p1", "title": "Calculus Textbook (9th Ed.)", "price": 320, "category": "Books & Education", "condition": "Good", "location": "Drostdy Res", "desc": "Stewart Calculus 9th edition. Minor annotations. Perfect for 1st year science/commerce.", "emoji": "📚", "bg": "#ede9fe", "seller": {"name": "Amahle N.", "whatsapp": "27821234567", "phone": "0821234567", "facebook": ""}, "dateAdded": "2025-01-15", "active": True, "status": "approved"},
    {"id": "p2", "title": "HP Laptop Charger 65W", "price": 280, "category": "Digital", "condition": "Excellent", "location": "Eden Grove", "desc": "Universal HP charger, used 2 months. All connections perfect. Comes with original packaging.", "emoji": "🔌", "bg": "#fef9c3", "seller": {"name": "Sipho M.", "whatsapp": "27719876543", "phone": "0719876543", "facebook": "fb.com/sipho"}, "dateAdded": "2025-01-14", "active": True, "status": "approved"},
    {"id": "p3", "title": "Mini Bar Fridge (60L)", "price": 1100, "category": "Appliances", "condition": "Good", "location": "Jan Smuts Res", "desc": "Works perfectly. Moving to off-campus accommodation. Pick up only.", "emoji": "🧊", "bg": "#dcfce7", "seller": {"name": "Lerato B.", "whatsapp": "27601122334", "phone": "0601122334", "facebook": ""}, "dateAdded": "2025-01-13", "active": True, "status": "approved"},
    {"id": "p4", "title": "PSY101 Notes Pack", "price": 80, "category": "Books & Education", "condition": "Excellent", "location": "Library (on request)", "desc": "Complete typed notes for PSY101 incl past papers. Got 82% with these.", "emoji": "🧠", "bg": "#fff7ed", "seller": {"name": "Zanele D.", "whatsapp": "27839988776", "phone": "0839988776", "facebook": ""}, "dateAdded": "2025-01-12", "active": True, "status": "approved"},
    {"id": "p5", "title": "Drawing Tablet (Huion H610)", "price": 900, "category": "Digital", "condition": "Good", "location": "Art Studios", "desc": "Huion H610 Pro, 2 spare nibs included. Ideal for Fine Art or Graphic Design.", "emoji": "🎨", "bg": "#fae8ff", "seller": {"name": "Cara L.", "whatsapp": "27821111222", "phone": "0821111222", "facebook": "fb.com/cara"}, "dateAdded": "2025-01-11", "active": True, "status": "approved"},
    {"id": "p6", "title": "21-speed Campus Bike", "price": 1800, "category": "Transport", "condition": "Good", "location": "Science Drive", "desc": "Trek mountain bike, new chain June. Lock and pump included. Test ride welcome.", "emoji": "🚲", "bg": "#e0f2fe", "seller": {"name": "James O.", "whatsapp": "27833334444", "phone": "0833334444", "facebook": ""}, "dateAdded": "2025-01-10", "active": True, "status": "approved"},
    {"id": "p7", "title": "Desk Lamp (USB-C)", "price": 150, "category": "Office & Stationery", "condition": "Like New", "location": "Beit Res", "desc": "Adjustable arm, 3 brightness levels, USB-C charging port. Box included.", "emoji": "💡", "bg": "#fce7f3", "seller": {"name": "Thabo K.", "whatsapp": "27845556666", "phone": "0845556666", "facebook": ""}, "dateAdded": "2025-01-09", "active": True, "status": "approved"},
    {"id": "p8", "title": "Air Fryer 2.5L", "price": 650, "category": "Appliances", "condition": "Very Good", "location": "Marjorie Ramsey", "desc": "Compact, lightly used. Timer and temp control. Makes great chips and chicken!", "emoji": "🍟", "bg": "#fef3c7", "seller": {"name": "Nandi Z.", "whatsapp": "27856667777", "phone": "0856667777", "facebook": ""}, "dateAdded": "2025-01-08", "active": True, "status": "approved"},
]

SEED_NEWS = [
    {"id": "n1", "tag": "Events", "title": "R10 Wine Night @ Rat & Parrot", "excerpt": "Every Thursday from 18:00 — Rhodes favourite watering hole is running their legendary R10 wine special. Student card required.", "content": "<p>The Rat and Parrot on High Street is running their famous R10 wine night every Thursday from 18:00. Show your student card at the door. Food specials also available from 18:00 – 20:00.</p><p>Located on High Street, the Rat and Parrot is a Makhanda institution. Safe transport back to campus is available — check Campus Cabs for verified drivers.</p>", "emoji": "🍷", "date": "Jan 2025", "active": True},
    {"id": "n2", "tag": "Campus News", "title": "SRC Elections: Everything You Need to Know", "excerpt": "Voting opens Monday 08:00 – 17:00 at the Student Union. All registered students can vote. Here's what's on the ballot.", "content": "<p>The 2025 SRC elections are here. Polling stations will be open Monday through Wednesday from 08:00 to 17:00 at the Student Union building.</p><p>All currently registered Rhodes University students are eligible to vote. Bring your student card. Results will be announced Thursday evening at the Great Hall.</p>", "emoji": "🏛️", "date": "Jan 2025", "active": True},
    {"id": "n3", "tag": "Specials", "title": "Pick n Pay Student Discount — Every Wednesday", "excerpt": "Show your student card at PnP on African Street every Wednesday for 5% off your total grocery bill.", "content": "<p>Pick n Pay on African Street is offering a 5% student discount every Wednesday. Simply show your valid student card at the checkout.</p><p>Stock up on essentials mid-week. The discount applies to groceries, toiletries, and household items — excluding liquor and airtime.</p>", "emoji": "🛒", "date": "Jan 2025", "active": True},
    {"id": "n4", "tag": "Load-shedding", "title": "Stage 2 Load-shedding Schedule — This Week", "excerpt": "Eskom has confirmed Stage 2 from 18:00 daily this week. Plan your study sessions accordingly.", "content": "<p>Eskom has confirmed Stage 2 load-shedding for the week. Makhanda is on Group 6, meaning cuts from 18:00 – 20:30 and 02:00 – 04:30 daily.</p><p>The library emergency generator is running during cuts. Rhodes IT systems will remain operational. Save your work frequently.</p>", "emoji": "⚡", "date": "Jan 2025", "active": True},
    {"id": "n5", "tag": "Nightlife", "title": "Champs Bar @ MiCasa — What's On This Weekend", "excerpt": "MiCasa's Champs Bar has a packed weekend lineup. Cover charge R30 with student card, R50 without.", "content": "<p>MiCasa's Champs Bar on African Street has a full weekend lined up. Friday: DJ Lesedi from 21:00. Saturday: Live band from 20:00, DJ sets till 03:00.</p><p>Cover charge: R30 with student card, R50 general. Campus Cabs available for safe returns to residences.</p>", "emoji": "🎶", "date": "Jan 2025", "active": True},
    {"id": "n6", "tag": "Health", "title": "Campus Health Centre — Extended Hours", "excerpt": "The campus health centre is extending hours to 20:00 on weekdays for the rest of the month.", "content": "<p>The Rhodes University Health Centre is extending its operating hours to 20:00 on weekdays to accommodate student demand at the start of the academic year.</p><p>No appointment needed for primary care. GP consultations available by booking. Mental health services also available — book via the health centre reception.</p>", "emoji": "🏥", "date": "Jan 2025", "active": True},
]


init_db()

if __name__ == "__main__":
    print(f"\n  Campus Marketplace · Makhanda")
    print(f"  → http://0.0.0.0:{PORT}  (open the Cloud Shell Web Preview on port {PORT})\n")
    app.run(host="0.0.0.0", port=PORT, debug=DEBUG, threaded=True)
