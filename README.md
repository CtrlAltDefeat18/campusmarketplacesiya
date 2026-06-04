I. Campus Marketplace · Makhanda 

> A student-built marketplace connecting Rhodes University buyers, sellers, cab drivers, and local businesses — all in one platform rooted in Makhanda.

Browse, list, and connect. Buyers click any item and contact the seller directly via **WhatsApp, phone, or Facebook** — no middleman, no payment processing, no liability.

---

II.   Features

- **Marketplace** — browse listings across 10 categories, search, sort, and filter
- **Direct seller contact** — WhatsApp (with pre-filled message), call, or Facebook
- **Seller listing form** — sellers submit items with real photo uploads; admin approves before they go live
- **Listing tiers** — Free vs Premium, plus Featured / Spotlight boosts
- **Admin panel** — approve/reject listings, manage users, cab drivers, news posts, and view commission logs
- **News & Blog** — "Makhanda Happening" feed for events, specials, and campus news
- **User profiles** — edit details, upload a profile picture, track your listings
- **Campus Cabs directory** — verified local drivers (POPI-conscious)
- **Mobile-first** — responsive, touch-friendly, bottom-sheet UI on phones

---

III.  Project Structure

```
.
├── app.py             # Flask backend — serves pages + JSON API on :5000, SQLite-backed
├── requirements.txt   # Python deps (Flask only — installs without a virtualenv)
├── package.json       # Tailwind build scripts (build:css / watch:css)
├── tailwind.config.js # Tailwind theme — plum design tokens, fonts, animations
├── input.css          # Tailwind source (@tailwind + component layer)  →  static/tailwind.css
├── index.html         # Landing page — hero, live stats, marketplace preview, news, contact
├── marketplace.html   # Full marketplace — categories, search, sort, product → seller contact
├── sell.html          # Seller listing form — 3-step wizard, photo upload → POST /api/listings
├── news.html          # Makhanda Happening — news/blog feed with tag filter and article view
├── profile.html       # User profile — editable details + "My Listings" with live status
├── admin.html         # Admin panel — login gate, approve/reject listings, post news
├── login.html         # Lightweight student sign-in (pilot session)
├── logo.svg           # Brand wordmark (scalable)
├── favicon.svg        # Browser tab / app icon
├── static/
│   ├── tailwind.css   # COMPILED Tailwind (committed — no build step needed to run)
│   └── app.js         # Shared frontend runtime (API client, nav, toasts, auth, contact)
├── data/              # SQLite database lives here (auto-created + seeded on first run)
└── README.md
```

---

 1.  Running Locally

The site is served by a small Flask backend (port **5000**). The compiled
Tailwind CSS is committed, so **no Node build step is required just to run**.

**Run it (Google Cloud Shell or any Linux terminal — no virtualenv needed):**
```bash
pip install --user -r requirements.txt   # one-time: installs Flask
python3 app.py                           # serves on 0.0.0.0:5000
```
Then open the app:
- **Cloud Shell:** click **Web Preview → Change port → 5000**.
- **Local:** browse to <http://localhost:5000>.

The SQLite database (`data/marketplace.db`) is created and seeded automatically
on first run — submit an item on **/sell**, approve it in **/admin**, and watch
it appear on **/marketplace**.

**Rebuilding the CSS** (only if you change `input.css` or page markup):
```bash
npm install        # one-time: installs Tailwind
npm run build:css  # → static/tailwind.css   (or: npm run watch:css)
```

---

2.  Admin Access

Open `admin.html`:

```
Username: admin
Password: campus2025
```

>  **These NEED to be CHANGED before going live (AND WILL)** — Admin Panel → Settings → Admin Credentials.

---

3.  Tech Stack

- **Backend** — **Flask** (Python 3) on port 5000, serving pages + a JSON API
- **Database** — **SQLite** via the Python standard library (no external service)
- **Styling** — **Tailwind CSS**, compiled from `input.css` with a custom plum design system (the landing & sell pages also keep their original hand-tuned CSS)
- **Frontend** — **Vanilla JavaScript** (no framework); shared runtime in `static/app.js`
- **Google Fonts** — Syne (display) + DM Sans (body)
- **API** — `GET/POST /api/listings`, `POST /api/listings/<id>/status`, `GET /api/stats`, `GET/POST /api/news`, `POST /api/admin/login`

---

4.  Roadmap

4.1. Current (v1 — prototype)
- [x] Public landing page with live stats
- [x] Marketplace with categories, search, filter
- [x] Seller listing form with photo upload
- [x] Admin approval workflow
- [x] News/blog feed
- [x] User profiles
- [x] Mobile-responsive throughout

4.2. In Progress
- [ ] **Supabase integration** — replace `localStorage` with a real database
  - [ ] Postgres tables: `listings`, `users`, `news`
  - [ ] Real authentication (email + Google)
  - [ ] Cloud image storage (Supabase Storage buckets)
- [ ] **Formspree** contact form connection
- [ ] **ImgBB / Supabase Storage** for seller image hosting

4.3. Planned
- [ ] Premium subscription payments
- [ ] Listing boost payments (Featured / Spotlight)
- [ ] Email notifications on approval
- [ ] Native mobile app

---

5.  Configuration Checklist (before launch)

| Item | Where | Action |
|------|-------|--------|
| Admin password | `admin.html` → Settings | Change from default |
| Contact form | `index.html` | Replace `YOUR_FORMSPREE_ID` with Formspree ID |
| Image uploads | `sell.html` | Add ImgBB API key (or Supabase Storage) |
| Social links | `admin.html` → Settings | Add real Instagram/Facebook/TikTok/WhatsApp URLs |
| Database | all files | Connect Supabase (Project URL + anon key) |

---

6.  Deployment

Static files — deploy anywhere:

**Netlify (recommended)**
1. Drag the project folder onto [app.netlify.com/drop](https://app.netlify.com/drop)
2. Add your custom domain in Site Settings → Domain
3. Live in minutes

Also works on **GitHub Pages**, **Vercel**, **Cloudflare Pages**.

---

7.  Disclaimer

Campus Marketplace connects buyers and sellers directly. All transactions occur between parties at their own discretion. The platform takes no responsibility for individual exchanges. Users are advised to meet in safe, public locations.

---

8.  Credits

- **Founder & Owner:** Siyamthanda Mpini
- **Platform & Development:** built for the Rhodes University / Makhanda community

---

*Built in Makhanda. For Makhanda.* 🇿🇦

---

*CtrlA(phelele)ltDefeat. 2026.* 
