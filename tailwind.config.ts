import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Niebieski z logo Aura Expert (#00a4dc). Tekst i przyciski: 700
        // (kontrast z białym 5,1:1 — WCAG AA), 500 tylko na akcenty graficzne.
        marka: {
          50: "#eef9fd",
          100: "#d7f1fb",
          200: "#b0e3f5",
          300: "#7fd0ee",
          400: "#3db8e4",
          500: "#00a4dc",
          600: "#0090c2",
          700: "#00769f",
          800: "#075f82",
          900: "#0a4a66",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
