/** @type {import('tailwindcss').Config} */
module.exports = {
  // Scan every page + the shared JS (which injects class names at runtime)
  content: ["./*.html", "./static/**/*.js"],
  theme: {
    extend: {
      colors: {
        plum: {
          DEFAULT: "#4a1e6e",
          mid: "#6b3fa0",
          light: "#c4a9e0",
          wash: "#f5f0fb",
          rim: "#e9dff5",
          deep: "#0F0621",
          night: "#2D1269",
        },
        ink: "#1a1228",
        muted: "#6b6578",
        wa: "#25D366",
      },
      fontFamily: {
        syne: ["Syne", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ['"DM Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        plum: "0 4px 24px rgba(74,30,110,0.10)",
        plumlg: "0 12px 48px rgba(74,30,110,0.18)",
      },
      backgroundImage: {
        "hero-plum":
          "linear-gradient(160deg,#0F0621 0%,#2D1269 35%,#6D28D9 65%,#A78BFA 100%)",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "none" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        floaty: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      animation: {
        "fade-up": "fadeUp .5s ease both",
        marquee: "marquee 30s linear infinite",
        floaty: "floaty 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
