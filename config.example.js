/* ──────────────────────────────────────────────────────────────
   Campus Marketplace · Makhanda — PUBLIC frontend config TEMPLATE
   ----------------------------------------------------------------
   HOW TO USE:
     1. Copy this file to  config.js   (config.js is git-ignored)
     2. Fill in your Cloudinary cloud name + unsigned upload preset
     3. Done — the sell form will upload photos to Cloudinary.

   These values are PUBLIC by design (cloud name + an *unsigned*
   upload preset are meant to live in the browser). Never put any
   secret/API-secret or admin password in this file.
   ────────────────────────────────────────────────────────────── */
window.CM_CONFIG = {
  // From Cloudinary dashboard → "Cloud name"
  cloudinaryCloud: "",

  // Cloudinary → Settings → Upload → Upload presets → create an
  // UNSIGNED preset, then paste its name here.
  cloudinaryPreset: "",
};
