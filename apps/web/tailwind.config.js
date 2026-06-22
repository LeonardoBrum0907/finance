/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef9f4",
          100: "#d6f1e4",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
        },
        sidebar: {
          DEFAULT: "#121C27",
          border: "#1E293B",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
