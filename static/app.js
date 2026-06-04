/* ═══════════════════════════════════════════════════════════════
   Campus Marketplace · Makhanda — shared frontend runtime
   Loaded by every Tailwind page. Exposes window.CM.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  // ── tiny helpers ──────────────────────────────────────────────
  const esc = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  const money = (n) => "R" + Number(n || 0).toLocaleString("en-ZA");

  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ── API client ────────────────────────────────────────────────
  async function jfetch(url, opts = {}) {
    const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    const key = adminKey();
    if (key) headers["X-Admin-Key"] = key;
    const res = await fetch(url, Object.assign({}, opts, { headers }));
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) throw Object.assign(new Error((data && data.error) || res.statusText), { status: res.status, data });
    return data;
  }

  const api = {
    health: () => jfetch("/api/health"),
    listings: (status = "approved") => jfetch("/api/listings?status=" + encodeURIComponent(status)),
    createListing: (payload) => jfetch("/api/listings", { method: "POST", body: JSON.stringify(payload) }),
    setStatus: (id, status) => jfetch(`/api/listings/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
    deleteListing: (id) => jfetch(`/api/listings/${id}`, { method: "DELETE" }),
    stats: () => jfetch("/api/stats"),
    news: () => jfetch("/api/news"),
    suggest: (payload) => jfetch("/api/suggestions", { method: "POST", body: JSON.stringify(payload) }),
    suggestions: () => jfetch("/api/suggestions"),
    adminLogin: (username, password) =>
      jfetch("/api/admin/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  };

  // ── auth (lightweight pilot session in localStorage) ──────────
  function getUser() { try { return JSON.parse(localStorage.getItem("cm_user") || "null"); } catch (_) { return null; } }
  function setUser(u) { localStorage.removeItem("cm_guest"); localStorage.setItem("cm_user", JSON.stringify(u)); }
  function logout() { localStorage.removeItem("cm_user"); localStorage.removeItem("cm_guest"); }
  function adminKey() { return localStorage.getItem("cm_admin_key") || ""; }
  function setAdminKey(k) { k ? localStorage.setItem("cm_admin_key", k) : localStorage.removeItem("cm_admin_key"); }
  function isAdmin() { return !!adminKey(); }

  // ── guest mode + access gate ──────────────────────────────────
  function isGuest() { return localStorage.getItem("cm_guest") === "1"; }
  function setGuest(on) { on ? localStorage.setItem("cm_guest", "1") : localStorage.removeItem("cm_guest"); }
  function hasAccess() { return !!getUser() || isGuest(); }
  // Call at the top of any gated page. Bounces unauthenticated visitors to the
  // public landing page, remembering where they wanted to go.
  function requireAccess() {
    if (hasAccess()) return true;
    const next = encodeURIComponent(location.pathname + location.search);
    location.replace("/?next=" + next + "#enter");
    return false;
  }

  // ── category grouping (sell.html uses granular cats; chips are broad) ──
  const CATEGORY_GROUPS = {
    "Books & Education": ["Textbooks", "Study Notes", "Past Papers", "Private Tutoring", "Tutoring Services"],
    "Digital": ["Laptops & Notebooks", "Phones & Accessories", "Tablets", "Gaming", "Audio & Headphones", "Cameras & Photo", "Other Electronics"],
    "Appliances": ["Kitchen Appliances", "Room Appliances", "Other Appliances"],
    "Apparel": ["Women's Clothing", "Men's Clothing", "Academic Regalia", "Lab Coats", "Footwear", "Accessories"],
    "Beauty & Care": ["Hair Care", "Skincare", "Makeup", "Fragrance", "Hair & Beauty Services"],
    "Office & Stationery": ["Calculators", "Stationery", "Bags & Backpacks"],
    "Transport": ["Bicycles", "Scooters", "Car Accessories"],
    "Food & Drink": ["Prepared Meals", "Snacks", "Beverages"],
    "Services": ["Photography", "Printing & Design", "Other Services"],
  };
  function groupOf(category) {
    if (!category) return "Other";
    if (CATEGORY_GROUPS[category]) return category;
    for (const [group, subs] of Object.entries(CATEGORY_GROUPS)) {
      if (subs.includes(category)) return group;
    }
    return "Other";
  }
  function matchesCat(product, cat) {
    if (cat === "all") return true;
    return product.category === cat || groupOf(product.category) === cat;
  }

  // ── seller contact buttons (shared markup) ────────────────────
  const WA_ICON = '<svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12 0C5.373 0 0 5.373 0 12c0 2.138.566 4.14 1.543 5.878L0 24l6.327-1.543A11.958 11.958 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg>';
  const CALL_ICON = '<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.09 1.18a2 2 0 012-2.18h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.91 6.91a16 16 0 006.18 6.18l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14z"/></svg>';
  const FB_ICON = '<svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>';

  function contactButtons(p) {
    const s = p.seller || {};
    // Guests can browse but contact is a sign-up nudge — keeps the social loop in-app.
    if (!getUser()) {
      return `<a href="/?next=${encodeURIComponent(location.pathname)}#enter" class="btn-primary w-full">🔓 Sign up free to contact the seller</a>
        <p class="text-[0.7rem] text-muted text-center mt-1">You're browsing as a guest. It takes 20 seconds to join.</p>`;
    }
    const out = [];
    if (s.whatsapp) {
      const msg = encodeURIComponent(`Hi! I saw your listing on Campus Marketplace: ${p.title} (${money(p.price)}). Is it still available?`);
      out.push(`<a href="https://wa.me/${esc(s.whatsapp)}?text=${msg}" target="_blank" rel="noopener" class="btn-wa">${WA_ICON} WhatsApp Seller</a>`);
    }
    if (s.phone) out.push(`<a href="tel:${esc(s.phone)}" class="btn-call">${CALL_ICON} Call Seller</a>`);
    if (s.facebook) {
      const url = s.facebook.startsWith("http") ? s.facebook : "https://" + s.facebook;
      out.push(`<a href="${esc(url)}" target="_blank" rel="noopener" class="btn-fb">${FB_ICON} Message on Facebook</a>`);
    }
    if (!out.length) out.push(`<a href="/#contact" class="btn-ghost w-full">Contact via our form →</a>`);
    return out.join("");
  }

  // ── toast ─────────────────────────────────────────────────────
  let toastTimer;
  function toast(msg, kind = "plum") {
    let t = qs("#cm-toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "cm-toast";
      t.className =
        "fixed left-1/2 bottom-6 z-[999] -translate-x-1/2 translate-y-24 opacity-0 " +
        "rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-plumlg transition-all duration-300 pointer-events-none max-w-[90vw] text-center";
      document.body.appendChild(t);
    }
    t.style.background = kind === "error" ? "#dc2626" : kind === "wa" ? "#16a34a" : "#4a1e6e";
    t.textContent = msg;
    requestAnimationFrame(() => { t.style.opacity = "1"; t.style.transform = "translate(-50%, 0)"; });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.style.opacity = "0"; t.style.transform = "translate(-50%, 6rem)"; }, 3400);
  }

  // ── shared chrome: auth-aware nav + footer (mounted on gated pages) ──
  const NAV_LINKS = [
    { href: "/home", label: "Home", icon: "🏠" },
    { href: "/marketplace", label: "Marketplace", icon: "🛒" },
    { href: "/rides", label: "Campus Rides", icon: "🚗" },
    { href: "/news", label: "News", icon: "📰" },
    { href: "/about", label: "About", icon: "💜" },
    { href: "/founder", label: "Founder", icon: "✨" },
  ];

  function navHTML(active) {
    const user = getUser();
    const path = active || location.pathname;
    const link = (l) => {
      const on = path.replace(/\/$/, "") === l.href;
      return `<a href="${l.href}" class="nav-link ${on ? "nav-link-active" : ""}">${l.label}</a>`;
    };
    const authBit = user
      ? `<div class="flex items-center gap-2">
           <a href="/profile" class="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-white/10 border border-white/15 hover:bg-white/15 transition">
             <span class="w-7 h-7 rounded-full bg-violet-500 grid place-items-center text-white text-xs font-bold">${esc((user.name || "U")[0].toUpperCase())}</span>
             <span class="text-white/90 text-xs font-semibold max-w-[8rem] truncate">${esc(user.name || "You")}</span>
           </a>
           <button data-logout class="nav-link">Log out</button>
         </div>`
      : `<div class="flex items-center gap-1.5">
           <span class="pill-glass !text-[0.62rem] hidden sm:inline-flex">👀 Guest</span>
           <a href="/?next=${encodeURIComponent(path)}#enter" class="btn-glass !px-4 !py-2 !text-xs">Log in</a>
           <a href="/?next=${encodeURIComponent(path)}#enter" class="btn-glow !px-4 !py-2 !text-xs">Sign up</a>
         </div>`;
    return `
    <nav class="nav-shell">
      <div class="container-wide flex items-center gap-3 h-14">
        <a href="/" class="flex items-center gap-2 shrink-0" title="Back to landing">
          <img src="/favicon.svg" class="h-8 w-8" alt=""/>
          <span class="font-syne font-extrabold text-white text-sm tracking-tight hidden sm:inline">Campus<span class="text-violet-300">Marketplace</span></span>
        </a>
        <div class="ml-auto hidden lg:flex items-center gap-1">
          ${NAV_LINKS.map(link).join("")}
          <a href="/sell" class="nav-link ml-1 bg-violet-600 text-white hover:bg-violet-700 hover:text-white">+ Sell</a>
        </div>
        <div class="ml-auto lg:ml-3">${authBit}</div>
        <button data-burger class="lg:hidden p-2 text-white/90" aria-label="Menu">
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
      </div>
      <div data-mobilemenu class="hidden lg:hidden border-t border-white/10 bg-plum-deep/95">
        <div class="container-wide py-2 flex flex-col">
          ${NAV_LINKS.map((l) => `<a href="${l.href}" class="nav-link py-3">${l.icon} ${l.label}</a>`).join("")}
          <a href="/sell" class="nav-link py-3">🏷️ Sell an Item</a>
          <a href="/suggest" class="nav-link py-3">💡 Make a Suggestion</a>
          <a href="/developers" class="nav-link py-3">⌨️ For Developers</a>
          <a href="/admin" class="nav-link py-3">⚙️ Admin</a>
        </div>
      </div>
    </nav>`;
  }

  function footerHTML() {
    return `
    <footer class="bg-plum-deep text-white/70 mt-12">
      <div class="container-wide py-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <a href="/" class="flex items-center gap-2 mb-3">
            <img src="/favicon.svg" class="h-8 w-8" alt=""/>
            <span class="font-syne font-extrabold text-white text-sm">Campus<span class="text-violet-300">Marketplace</span></span>
          </a>
          <p class="text-xs leading-relaxed text-white/50 max-w-xs">A student-built home for Rhodes University &amp; Makhanda — buy, sell, ride, and connect. Built in Makhanda. For Makhanda. 🇿🇦</p>
        </div>
        <div>
          <div class="text-white text-xs font-bold uppercase tracking-wider mb-3">Explore</div>
          <ul class="space-y-2 text-sm">
            <li><a href="/marketplace" class="hover:text-violet-300">Marketplace</a></li>
            <li><a href="/rides" class="hover:text-violet-300">Campus Rides</a></li>
            <li><a href="/news" class="hover:text-violet-300">News &amp; Opportunities</a></li>
            <li><a href="/sell" class="hover:text-violet-300">Sell an Item</a></li>
          </ul>
        </div>
        <div>
          <div class="text-white text-xs font-bold uppercase tracking-wider mb-3">The Platform</div>
          <ul class="space-y-2 text-sm">
            <li><a href="/about" class="hover:text-violet-300">About the Platform</a></li>
            <li><a href="/founder" class="hover:text-violet-300">About the Founder</a></li>
            <li><a href="/developers" class="hover:text-violet-300">For Developers</a></li>
            <li><a href="/suggest" class="hover:text-violet-300">Make a Suggestion</a></li>
          </ul>
        </div>
        <div>
          <div class="text-white text-xs font-bold uppercase tracking-wider mb-3">Stay safe</div>
          <p class="text-xs leading-relaxed text-white/50">Always meet in safe, public places. We don't process payments or hold liability for exchanges. Trust your gut. 💜</p>
          <a href="/admin" class="inline-block mt-3 text-xs text-white/40 hover:text-violet-300">Organiser? Admin sign-in →</a>
        </div>
      </div>
      <div class="border-t border-white/10">
        <div class="container-wide py-5 text-xs text-white/40 flex flex-col sm:flex-row gap-2 items-center justify-between">
          <div>© <span data-year></span> Campus Marketplace · Makhanda. CtrlAltDefeat.</div>
          <div>Made with 💜 for Rhodes students · Uncle Ross approves 🐭</div>
        </div>
      </div>
    </footer>`;
  }

  // Mount shared chrome into placeholder elements if present.
  function mountChrome(active) {
    const navMount = qs("#cm-nav");
    if (navMount) navMount.innerHTML = navHTML(active);
    const footMount = qs("#cm-footer");
    if (footMount) footMount.innerHTML = footerHTML();
  }

  // ── nav: mobile toggle + active link + year + auth label ──────
  function initChrome() {
    const burger = qs("[data-burger]");
    const menu = qs("[data-mobilemenu]");
    if (burger && menu) {
      burger.addEventListener("click", () => {
        menu.classList.toggle("hidden");
        burger.classList.toggle("is-open");
      });
    }
    qsa("[data-logout]").forEach((b) =>
      b.addEventListener("click", () => { logout(); toast("Logged out 👋"); setTimeout(() => (location.href = "/"), 400); })
    );
    // active link by pathname
    const path = location.pathname.replace(/\/$/, "") || "/";
    qsa("[data-navlink]").forEach((a) => {
      const href = a.getAttribute("href").replace(/\/$/, "") || "/";
      if (href === path) a.classList.add("nav-link-active");
    });
    // year stamps
    qsa("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
    // auth-aware bits
    const user = getUser();
    qsa("[data-auth-name]").forEach((el) => (el.textContent = user ? user.name : "Guest"));
    qsa("[data-auth-only]").forEach((el) => (el.style.display = user ? "" : "none"));
    qsa("[data-guest-only]").forEach((el) => (el.style.display = user ? "none" : ""));
  }

  // ── motion: scroll-reveal, tilt cards, parallax, count-up ─────
  function initReveal() {
    const els = qsa(".reveal");
    if (!els.length || !("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    els.forEach((e) => io.observe(e));
  }

  function initTilt() {
    if (matchMedia("(pointer: coarse)").matches) return;
    qsa(".tilt").forEach((card) => {
      const max = parseFloat(card.dataset.tilt || "8");
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = `rotateY(${px * max}deg) rotateX(${-py * max}deg) translateZ(0)`;
      });
      card.addEventListener("pointerleave", () => { card.style.transform = ""; });
    });
  }

  function initParallax() {
    const els = qsa("[data-parallax]");
    if (!els.length) return;
    let mx = 0, my = 0;
    const onScrollMove = () => {
      const sy = window.scrollY;
      els.forEach((el) => {
        const depth = parseFloat(el.dataset.parallax || "0.2");
        el.style.transform = `translate3d(${mx * depth * 30}px, ${sy * depth + my * depth * 30}px, 0)`;
      });
    };
    window.addEventListener("scroll", onScrollMove, { passive: true });
    if (!matchMedia("(pointer: coarse)").matches) {
      window.addEventListener("pointermove", (e) => {
        mx = e.clientX / window.innerWidth - 0.5;
        my = e.clientY / window.innerHeight - 0.5;
        onScrollMove();
      });
    }
    onScrollMove();
  }

  function countUp(el, target, dur = 1400) {
    const start = performance.now();
    const from = 0;
    function tick(now) {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(from + (target - from) * eased).toLocaleString("en-ZA");
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  function initCountUp() {
    const els = qsa("[data-countup]");
    if (!els.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { countUp(en.target, parseInt(en.target.dataset.countup, 10) || 0); io.unobserve(en.target); }
      });
    }, { threshold: 0.5 });
    els.forEach((e) => io.observe(e));
  }

  // ── social config (optional, from /config.js → window.CM_CONFIG) ──
  function applyConfig() {
    const cfg = window.CM_CONFIG;
    if (!cfg || !cfg.social) return;
    qsa("[data-social]").forEach((a) => {
      const val = cfg.social[a.getAttribute("data-social")];
      if (!val) return;
      a.href = a.getAttribute("data-social") === "whatsapp" ? "https://wa.me/" + val.replace(/\D/g, "") : val;
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (qs("#cm-nav") || qs("#cm-footer")) mountChrome();
    initChrome();
    applyConfig();
    initReveal();
    initTilt();
    initParallax();
    initCountUp();
  });

  // ── public surface ────────────────────────────────────────────
  window.CM = {
    api, esc, money, qs, qsa, toast,
    getUser, setUser, logout, isAdmin, adminKey, setAdminKey,
    isGuest, setGuest, hasAccess, requireAccess,
    groupOf, matchesCat, contactButtons,
    mountChrome, navHTML, footerHTML, countUp,
  };
})();
