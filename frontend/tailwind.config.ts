import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Light, rich-colour theme tokens (DESIGN_SPEC.md)
        cv: {
          bg: "#FFF8F1",
          surface: "#FFFFFF",
          "tint-peach": "#FDEBD8",
          "tint-sky": "#EAF1FF",
          "tint-mint": "#E6F6F0",
          border: "#E6DCD2",
          text: "#1B1320",
          "text-muted": "#4A4056",
          primary: "#C8102E",
          "primary-hover": "#A60D26",
          "primary-pressed": "#8B0A20",
          gold: "#F2A900",
          teal: "#0E8F8A",
          blue: "#2563EB",
          amber: "#D97706",
          danger: "#C62828",
          ruby: "#9F1239",
          royalblue: "#1E40AF",
          amberbrown: "#8D5B28",
        },
      },
      fontSize: {
        // Enforce Phase 2c typography scale: body 18px, min 14px
        xs: ["0.875rem", { lineHeight: "1.25rem" }],   // 14px min
        sm: ["0.9375rem", { lineHeight: "1.375rem" }], // 15px
        base: ["1.125rem", { lineHeight: "1.8rem" }],  // 18px body
        lg: ["1.25rem", { lineHeight: "1.875rem" }],   // 20px
        xl: ["1.375rem", { lineHeight: "2rem" }],       // 22px H3
        "2xl": ["1.5rem", { lineHeight: "2.125rem" }],  // 24px H3
        "3xl": ["1.875rem", { lineHeight: "2.375rem" }],// 30px H2
        "4xl": ["2.125rem", { lineHeight: "2.625rem" }],// 34px H2
        "5xl": ["2.5rem", { lineHeight: "3rem" }],      // 40px H1
        "6xl": ["3rem", { lineHeight: "3.5rem" }],      // 48px H1
      },
      boxShadow: {
        soft: "0 8px 24px rgba(27, 19, 32, 0.08)",
        card: "0 4px 16px rgba(27, 19, 32, 0.06)",
        dropdown: "0 12px 32px rgba(27, 19, 32, 0.12)",
      },
      borderRadius: {
        card: "16px",
        pill: "9999px",
        btn: "12px",
      },
    },
  },
  plugins: [],
};
export default config;
