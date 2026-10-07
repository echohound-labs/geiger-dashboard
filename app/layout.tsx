import type { Metadata } from "next";
import { Share_Tech_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Footer } from "@/components/footer";
import { MAINNET, SITE_NAME, SITE_TAGLINE, SITE_URL, TESTNET } from "@/lib/config";
import { Sidebar } from "@/components/sidebar";
import { ThemeSync } from "@/components/theme";
import { THEME_SCRIPT } from "@/lib/theme-script";

const term = Share_Tech_Mono({ subsets: ["latin"], weight: "400", variable: "--font-term", display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-grotesk", display: "swap" });

const DESCRIPTION = `Status of the GERO ${MAINNET.geroVersion} randomness oracle on X1 mainnet and testnet, and of the ENTROPY minter (${TESTNET.symbol}) on X1 testnet.`;

// Favicon and Open Graph image are static files in public/ (see README, "Brand assets").
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} · ${SITE_TAGLINE}`, template: `%s · ${SITE_NAME} · ${SITE_TAGLINE}` },
  description: DESCRIPTION,
  // "./" resolves to the current route, so every page gets its own canonical URL under SITE_URL.
  alternates: { canonical: "./" },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} · ${SITE_TAGLINE}`,
    description: DESCRIPTION,
    url: SITE_URL,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: `${SITE_NAME} · ${SITE_TAGLINE}` }],
  },
  twitter: { card: "summary_large_image", title: `${SITE_NAME} · ${SITE_TAGLINE}`, description: DESCRIPTION, images: ["/og.png"] },
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
