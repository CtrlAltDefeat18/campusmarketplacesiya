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
├── index.html        # Public landing page — hero, live stats, marketplace preview, news, about, contact
├── marketplace.html  # Full marketplace — login gate, categories, search, product cards → seller contact
├── sell.html         # Seller listing form — 3-step wizard, mandatory photo upload, submit for approval
├── news.html         # Makhanda Happening — news/blog feed with tag filter and article view
├── profile.html      # User profile — details, profile photo, "My Listings" with status
├── admin.html        # Admin panel — approvals, users, cabs, news, commission, settings
├── login.html        # (legacy / standalone auth — superseded by in-page gate on marketplace)
├── logo.svg          # Brand logo (scalable, transparent)
├── favicon.svg       # Browser tab icon
└── README.md
```

---

 1.  Running Locally

No build step, no dependencies to install. Either:

**Option A — open directly**
Double-click `index.html`. (Some features like icon fonts need internet.)

**Option B — run a local server (recommended)**
```bash
# Python 3
python3 -m http.server 8000
# then open http://localhost:8000
```
```bash
# Node
npx serve
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

- **HTML5 + semantic markup**
- **Vanilla CSS** (custom design system, CSS variables, mobile-first)
- **Vanilla JavaScript** (no framework)
- **Google Fonts** — Syne (display) + DM Sans (body)
- **Lucide Icons** (CDN)
- **Data layer** — `localStorage` (prototype) → migrating to **Supabase** (see Roadmap)

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
