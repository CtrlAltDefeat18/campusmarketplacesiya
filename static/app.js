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
    adminLogin: (username, password) =>
      jfetch("/api/admin/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  };

  // ── auth (lightweight pilot session in localStorage) ──────────
  function getUser() { try { return JSON.parse(localStorage.getItem("cm_user") || "null"); } catch (_) { return null; } }
  function setUser(u) { localStorage.setItem("cm_user", JSON.stringify(u)); }
  function logout() { localStorage.removeItem("cm_user"); }
  function adminKey() { return localStorage.getItem("cm_admin_key") || ""; }
  function setAdminKey(k) { k ? localStorage.setItem("cm_admin_key", k) : localStorage.removeItem("cm_admin_key"); }
  function isAdmin() { return !!adminKey(); }

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

  document.addEventListener("DOMContentLoaded", () => { initChrome(); applyConfig(); });

  // ── public surface ────────────────────────────────────────────
  window.CM = {
    api, esc, money, qs, qsa, toast,
    getUser, setUser, logout, isAdmin, adminKey, setAdminKey,
    groupOf, matchesCat, contactButtons,
  };
})();
