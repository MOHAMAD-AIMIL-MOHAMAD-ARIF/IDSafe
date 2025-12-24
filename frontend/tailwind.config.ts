import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}", "./src/**/*.{mdx}", "./public/**/*.html"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef7ff",
          100: "#d8ebff",
          200: "#b6daff",
          300: "#83c0ff",
          400: "#4a9dff",
          500: "#1f7dff",
          600: "#0f5ce6",
          700: "#0f47b8",
          800: "#113c93",
          900: "#153470",
        },
      },
    },
  },
  plugins: [],
};

export default config;
