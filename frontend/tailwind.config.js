/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // SyncBoard dark palette — near-black canvas with acid lime accent.
        // The surface scale is inverted from a typical light-mode scale:
        // low numbers = dark backgrounds, high numbers = light text.
        // This means existing classes like bg-surface-100 and text-surface-900
        // produce correct dark-mode output without changing class names.
        brand: {
          50: "#0f1a00",
          100: "#1a2e00",
          200: "#2d5000",
          300: "#4a7f00",
          400: "#7ab820",
          500: "#c8ee44", // Primary accent — acid lime
          600: "#d4f270",
          700: "#e0f69c",
          800: "#ecfac8",
          900: "#f5fde6",
        },
        surface: {
          0: "#09090b",
          50: "#0c0c0f",
          100: "#111114", // Page canvas
          200: "#1a1a1f", // Borders, dividers
          300: "#222228", // Cards, elevated surfaces
          400: "#71717a", // Muted text, icons
          500: "#a1a1aa", // Secondary text
          600: "#d4d4d8", // Body text
          700: "#e4e4e7", // Strong text
          800: "#f4f4f5", // Headings
          900: "#fafafa", // White text
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
