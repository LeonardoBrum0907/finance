/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        app: {
          bg: "rgb(var(--app-bg) / <alpha-value>)",
          surface: "rgb(var(--app-surface) / <alpha-value>)",
          border: "rgb(var(--app-border) / <alpha-value>)",
        },
        positive: {
          DEFAULT: "rgb(var(--positive) / <alpha-value>)",
          muted: "rgb(var(--positive-muted) / <alpha-value>)",
        },
        negative: {
          DEFAULT: "rgb(var(--negative) / <alpha-value>)",
          muted: "rgb(var(--negative-muted) / <alpha-value>)",
        },
        brand: {
          DEFAULT: "rgb(var(--brand) / <alpha-value>)",
          muted: "rgb(var(--brand-muted) / <alpha-value>)",
          50: "#eef9f4",
          100: "#d6f1e4",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
        },
        sidebar: {
          DEFAULT: "rgb(var(--sidebar-bg) / <alpha-value>)",
          border: "rgb(var(--sidebar-border) / <alpha-value>)",
          hover: "rgb(var(--sidebar-hover) / <alpha-value>)",
          active: "rgb(var(--sidebar-active) / <alpha-value>)",
        },
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        muted: {
          foreground: "rgb(var(--muted-foreground) / <alpha-value>)",
        },
        danger: {
          DEFAULT: "rgb(var(--danger) / <alpha-value>)",
          muted: "rgb(var(--danger-muted) / <alpha-value>)",
          border: "rgb(var(--danger-border) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        card: "var(--radius-card)",
        "card-lg": "var(--radius-card-lg)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
      },
    },
  },
  plugins: [],
};
