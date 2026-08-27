/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // SyncBoard palette — cool slate with an electric blue accent.
        // Professional enough for a productivity tool, distinctive
        // enough to not look like every other Tailwind template.
        brand: {
          50: "#eef4ff",
          100: "#d9e5ff",
          200: "#bcd3ff",
          300: "#8eb8ff",
          400: "#5990ff",
          500: "#3366ff", // Primary accent
          600: "#1b44ff",
          700: "#1433eb",
          800: "#172bbe",
          900: "#192b95",
        },
        surface: {
          0: "#ffffff",
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
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
