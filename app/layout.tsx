import type { Metadata } from "next";
import { Share_Tech_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { WalletContextProvider } from "@/components/wallet-provider";
import { NETWORK } from "@/lib/config";

const term = Share_Tech_Mono({ subsets: ["latin"], weight: "400", variable: "--font-term", display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-grotesk", display: "swap" });

export const metadata: Metadata = {
  title: { default: "GERO Hub", template: "%s · GERO Hub" },
  description: "Read-only status of the GERO oracle and the ENTROPY minter.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${term.variable} ${grotesk.variable}`}>
      <body className="min-h-screen bg-term-bg font-sans text-term-text antialiased">
        <WalletContextProvider>
          <SiteHeader />
          <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6">{children}</main>
          <footer className="mx-auto w-full max-w-6xl px-4 pb-8 font-mono text-xs text-term-text3 sm:px-6">
            {NETWORK.label} · read-only · no third-party audit, no legal review
          </footer>
        </WalletContextProvider>
      </body>
    </html>
  );
}
