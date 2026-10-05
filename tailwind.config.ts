import type { Config } from "tailwindcss";

// Terminal-green palette carried over from geiger-dashboard, with the glow
// and scanline effects dropped and contrast checked against the background.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        term: {
          bg: "#080c0a",
          panel: "#0d130f",
          raised: "#111810",
          line: "rgba(0,255,100,0.12)",
          lineStrong: "rgba(0,255,100,0.24)",
          green: "#00ff64",
          greenDim: "#00cc50",
          text: "#c8ffd8",
          text2: "#7aad8a",
          text3: "#4f7d5c",
          amber: "#ffb300",
          red: "#ff5c5c",
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
