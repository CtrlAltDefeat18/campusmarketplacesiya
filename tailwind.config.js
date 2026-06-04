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
        // Rhodes University purple family + accents
        rhodes: "#3a1f5c",
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
        glow: "0 0 0 1px rgba(167,139,250,0.25), 0 8px 40px rgba(109,40,217,0.35)",
      },
      backgroundImage: {
        "hero-plum":
          "linear-gradient(160deg,#0F0621 0%,#2D1269 35%,#6D28D9 65%,#A78BFA 100%)",
        "aurora":
          "radial-gradient(at 18% 22%, rgba(167,139,250,0.45) 0px, transparent 50%), radial-gradient(at 80% 12%, rgba(109,40,217,0.40) 0px, transparent 50%), radial-gradient(at 75% 80%, rgba(236,72,153,0.28) 0px, transparent 50%), radial-gradient(at 12% 78%, rgba(45,18,105,0.55) 0px, transparent 55%)",
        "grid-plum":
          "linear-gradient(rgba(167,139,250,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(167,139,250,0.10) 1px, transparent 1px)",
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
        floatySlow: {
          "0%,100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-16px) rotate(-2deg)" },
        },
        auroraShift: {
          "0%,100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(-3%,2%,0) scale(1.08)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% center" },
          "100%": { backgroundPosition: "-200% center" },
        },
        pop: {
          "0%": { transform: "scale(0.8)", opacity: "0" },
          "70%": { transform: "scale(1.05)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        tailwag: {
          "0%,100%": { transform: "rotate(-6deg)" },
          "50%": { transform: "rotate(10deg)" },
        },
        blink: {
          "0%,92%,100%": { transform: "scaleY(1)" },
          "96%": { transform: "scaleY(0.1)" },
        },
        spinSlow: { "100%": { transform: "rotate(360deg)" } },
      },
      animation: {
        "fade-up": "fadeUp .5s ease both",
        marquee: "marquee 30s linear infinite",
        floaty: "floaty 6s ease-in-out infinite",
        "floaty-slow": "floatySlow 9s ease-in-out infinite",
        aurora: "auroraShift 18s ease-in-out infinite",
        shimmer: "shimmer 6s linear infinite",
        pop: "pop .4s cubic-bezier(.34,1.56,.64,1) both",
        tailwag: "tailwag 1.6s ease-in-out infinite",
        blink: "blink 5s ease-in-out infinite",
        "spin-slow": "spinSlow 22s linear infinite",
      },
    },
  },
  plugins: [],
};
