import type { Metadata } from "next";
import { Share_Tech_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Footer } from "@/components/footer";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/config";
import { Sidebar } from "@/components/sidebar";
import { ThemeSync } from "@/components/theme";
import { THEME_SCRIPT } from "@/lib/theme-script";

const term = Share_Tech_Mono({ subsets: ["latin"], weight: "400", variable: "--font-term", display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-grotesk", display: "swap" });

export const metadata: Metadata = {
  title: { default: `${SITE_NAME} · ${SITE_TAGLINE}`, template: `%s · ${SITE_NAME} · ${SITE_TAGLINE}` },
  description: "Status of the GERO randomness oracle on X1 mainnet, and of GERO v9.1b and the ENTROPY minter on X1 testnet.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-theme / data-sidebar are set by THEME_SCRIPT before first paint, hence suppressHydrationWarning
    <html lang="en" className={`${term.variable} ${grotesk.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-term-bg font-sans text-term-text antialiased">
        <ThemeSync />
        <Sidebar />
        <div className="app-main">
          <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
