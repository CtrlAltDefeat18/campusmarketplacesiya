/* ════════════════════════════════════════════════════════════
   Campus Marketplace — Configuration TEMPLATE
   ────────────────────────────────────────────────────────────
   HOW TO USE:
   1. Copy this file and rename the copy to:  config.js
   2. Fill in your real values below
   3. config.js is gitignored — your keys never get committed
   ════════════════════════════════════════════════════════════ */

window.CM_CONFIG = {

  /* ── Contact form (formspree.io) ──────────────────────────
     Sign up free → create a form → copy the ID (e.g. "xabc1234") */
  formspreeId: "YOUR_FORMSPREE_ID",

  /* ── Image hosting (imgbb.com) ────────────────────────────
     Free account → API → copy key. Leave "" to store images
     locally (small files only). */
  imgbbKey: "",

  /* ── Database (supabase.com) — added when we wire it up ───
     Project Settings → API. The anon key is safe in browser code. */
  supabaseUrl: "",
  supabaseAnonKey: "",

  /* ── Social media links (used across the site) ───────────── */
  social: {
    instagram: "https://instagram.com/campusmarketplacemakhanda",
    facebook:  "https://facebook.com/campusmarketplacemakhanda",
    tiktok:    "https://tiktok.com/@campusmarketplace",
    twitter:   "https://twitter.com/campusmktmakhanda",
    whatsapp:  "27000000000",
    email:     "hello@campusmarketplace.co.za"
  }
};
