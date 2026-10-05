import type { Config } from "tailwindcss";

// Terminal-green palette carried over from geiger-dashboard, with the glow
// and scanline effects dropped. Every colour is a CSS variable (app/globals.css)
// holding RGB channels, so the dark and light themes swap them and the
// Tailwind opacity modifiers (border-term-amber/50) keep working.
const v = (name: string) => `rgb(var(--term-${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        term: {
          bg: v("bg"),
          panel: v("panel"),
          raised: v("raised"),
          // Hairlines carry their own alpha.
          line: "var(--term-line)",
          lineStrong: "var(--term-line-strong)",
          green: v("green"),
          greenDim: v("green-dim"),
          text: v("text"),
          text2: v("text2"),
          text3: v("text3"),
          amber: v("amber"),
          red: v("red"),
        },
      },
      fontFamily: {
        sans: ["var(--font-grotesk)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-term)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
