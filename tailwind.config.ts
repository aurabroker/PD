import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        marka: {
          50: "#fdf5f3",
          100: "#fbe8e4",
          200: "#f7d5cd",
          400: "#dc9b8a",
          600: "#a65a45",
          700: "#8a4838",
          900: "#5c3025",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
