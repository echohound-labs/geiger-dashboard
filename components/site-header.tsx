"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme";

const GROUPS = [
  { tag: "Mainnet", tone: "text-term-green", items: [{ href: "/", label: "Oracle" }] },
  {
    tag: "Testnet",
    tone: "text-term-amber",
    items: [
      { href: "/testnet", label: "Network" },
      { href: "/testnet/nodes", label: "Nodes" },
      { href: "/testnet/entropy", label: "ENTROPY" },
      { href: "/testnet/my-node", label: "My node" },
      { href: "/testnet/activity", label: "Activity" },
    ],
  },
  { tag: null, tone: "", items: [{ href: "/about", label: "About" }] },
];

// "/" and "/testnet" have child routes, so they match exactly.
const EXACT = new Set(["/", "/testnet"]);

export function SiteHeader() {
  const path = usePathname();
  return (
    <header className="border-b border-term-line bg-term-panel/60">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        <Link href="/" className="font-mono text-lg tracking-widest text-term-green">
          GERO<span className="text-term-text2">/hub</span>
        </Link>
        <nav className="-mx-1 flex w-full items-center gap-1 overflow-x-auto lg:w-auto lg:flex-1">
          {GROUPS.map((g, gi) => (
            <div key={gi} className={`flex items-center gap-1 ${gi > 0 ? "border-l border-term-line pl-2" : ""}`}>
              {g.tag && (
                <span className={`px-1 font-mono text-[10px] uppercase tracking-[0.14em] ${g.tone}`}>{g.tag}</span>
              )}
              {g.items.map((n) => {
                const active = EXACT.has(n.href) ? path === n.href : path.startsWith(n.href);
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
            </div>
          ))}
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
