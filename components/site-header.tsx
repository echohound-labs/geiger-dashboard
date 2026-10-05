"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletButton } from "./wallet-button";
import { NETWORK } from "@/lib/config";

const NAV = [
  { href: "/", label: "Network" },
  { href: "/nodes", label: "Nodes" },
  { href: "/entropy", label: "ENTROPY" },
  { href: "/my-node", label: "My node" },
  { href: "/activity", label: "Activity" },
  { href: "/about", label: "About" },
];

export function SiteHeader() {
  const path = usePathname();
  return (
    <header className="border-b border-term-line bg-term-panel/60">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        <Link href="/" className="font-mono text-lg tracking-widest text-term-green">
          GERO<span className="text-term-text2">/hub</span>
        </Link>
        <span className="rounded border border-term-amber/40 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-term-amber">
          {NETWORK.label}
        </span>
        <nav className="order-last -mx-1 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto sm:flex-1">
          {NAV.map((n) => {
            const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`whitespace-nowrap rounded px-2.5 py-1.5 font-mono text-[13px] tracking-wide transition-colors ${
                  active ? "bg-term-green/10 text-term-green" : "text-term-text2 hover:text-term-text"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto sm:ml-0">
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
