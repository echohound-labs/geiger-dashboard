"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme";
import {
  ActivityIcon, BookIcon, ChevronsLeft, ChevronsRight, CloseIcon, CoinIcon, CompassIcon, FileIcon, HelpIcon, MenuIcon,
  NodesIcon, PlugIcon, RadarIcon, WalletIcon, type Icon,
} from "./icons";
import { WHITE_PAPER_URL } from "@/lib/config";
import { NETS, isNet, netFromPath, switchNetPath, type NetSlug } from "@/lib/networks";
import { SIDEBAR_KEY } from "@/lib/theme-script";

type Item = { label: string; Icon: Icon; href: string; external?: boolean; badge?: string; exact?: boolean };
type Section = { title: string | null; items: Item[] };

// Data pages live under /[network]; Learn pages are the same on both networks.
function sections(net: NetSlug): Section[] {
  const notLive = net === "mainnet" ? "Testnet" : undefined;
  return [
    { title: null, items: [{ label: "Overview", Icon: CompassIcon, href: `/${net}`, exact: true }] },
    {
      title: "GERO",
      items: [
        { label: "Oracle status", Icon: RadarIcon, href: `/${net}/oracle` },
        { label: "Nodes", Icon: NodesIcon, href: `/${net}/nodes` },
        { label: "Activity", Icon: ActivityIcon, href: `/${net}/activity` },
        { label: "Integrations", Icon: PlugIcon, href: `/${net}/integrations` },
      ],
    },
    {
      title: "ENTROPY",
      items: [
        { label: "Token & supply", Icon: CoinIcon, href: `/${net}/entropy`, badge: notLive },
        { label: "Claim", Icon: WalletIcon, href: `/${net}/claim`, badge: notLive },
      ],
    },
    {
      title: "Learn",
      items: [
        { label: "How it works", Icon: BookIcon, href: "/learn/how-it-works" },
        { label: "How to test", Icon: HelpIcon, href: "/learn/how-to-test" },
        { label: "White paper", Icon: FileIcon, href: WHITE_PAPER_URL, external: true },
      ],
    },
  ];
}

// ---- expanded / collapsed (desktop), remembered, restored before paint by THEME_SCRIPT ----
const EVENT = "gero-sidebar-change";
function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === "collapsed";
  } catch {
    return false;
  }
}
function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}
function useCollapsed(): [boolean, (v: boolean) => void] {
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);
  const set = (v: boolean) => {
    try {
      if (v) localStorage.setItem(SIDEBAR_KEY, "collapsed");
      else localStorage.removeItem(SIDEBAR_KEY);
    } catch {}
    if (v) document.documentElement.setAttribute("data-sidebar", "collapsed");
    else document.documentElement.removeAttribute("data-sidebar");
    window.dispatchEvent(new Event(EVENT));
  };
  return [collapsed, set];
}

// ---- the network the sidebar links to: the URL's on /[network] pages, else the last one visited ----
const NET_KEY = "gero-network";
const NET_EVENT = "gero-network-change";
function readNet(): NetSlug {
  try {
    const n = localStorage.getItem(NET_KEY) ?? undefined;
    return isNet(n) ? n : "mainnet";
  } catch {
    return "mainnet";
  }
}
function subscribeNet(cb: () => void) {
  window.addEventListener(NET_EVENT, cb);
  return () => window.removeEventListener(NET_EVENT, cb);
}
function rememberNet(n: NetSlug) {
  try {
    localStorage.setItem(NET_KEY, n);
  } catch {}
  window.dispatchEvent(new Event(NET_EVENT));
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useCollapsed();
  const urlNet = netFromPath(pathname);
  const savedNet = useSyncExternalStore(subscribeNet, readNet, () => "mainnet" as NetSlug);
  const net = urlNet ?? savedNet;
  useEffect(() => {
    if (urlNet && urlNet !== readNet()) rememberNet(urlNet);
  }, [urlNet]);

  // Mobile: the sidebar is a drawer; it remembers the route it was opened on, so navigating closes it.
  const [drawerOn, setDrawerOn] = useState<string | null>(null);
  const drawerOpen = drawerOn === pathname;
  const closeDrawer = () => setDrawerOn(null);
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOn(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const isActive = (it: Item) => (it.exact ? pathname === it.href : pathname === it.href || pathname.startsWith(`${it.href}/`));

  function renderItem(it: Item) {
    const inner = (
      <>
        <it.Icon className="sb-icon" size={18} />
        <span className="sb-label">{it.label}</span>
        {it.badge && <span className="sb-badge">{it.badge}</span>}
      </>
    );
    const title = it.badge ? `${it.label} (not launched on mainnet; ${it.badge.toLowerCase()} only)` : it.label;
    if (it.external)
      return (
        <a key={it.label} href={it.href} target="_blank" rel="noreferrer" className="sb-item" title={title} onClick={closeDrawer}>
          {inner}
        </a>
      );
    return (
      <Link
        key={it.label}
        href={it.href}
        className="sb-item"
        title={title}
        data-badge={it.badge ? "true" : undefined}
        aria-current={isActive(it) ? "page" : undefined}
        onClick={closeDrawer}
      >
        {inner}
      </Link>
    );
  }

  return (
    <>
      <div className="mobilebar">
        <button type="button" className="sb-btn" aria-label="Open menu" onClick={() => setDrawerOn(pathname)}>
          <MenuIcon size={18} />
        </button>
        <Link href={`/${net}`} className="sb-brand">
          <span>
            GERO<span className="text-term-text2">/hub</span>
          </span>
        </Link>
        <span className="mobilebar-net" data-net={net}>
          {net}
        </span>
      </div>

      <div className="sb-backdrop" data-open={drawerOpen} onClick={closeDrawer} />
      <aside className="sidebar" data-open={drawerOpen} aria-label="Sidebar">
        <div className="sb-top">
          <Link href={`/${net}`} className="sb-brand" aria-label="GERO hub overview" onClick={closeDrawer}>
            <span className="sb-brand-short">G</span>
            <span className="sb-label">
              GERO<span className="text-term-text2">/hub</span>
            </span>
          </Link>
          <button type="button" className="sb-btn sb-close" aria-label="Close menu" onClick={closeDrawer}>
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="sb-net" role="group" aria-label="Network">
          {NETS.map((n) => (
            <Link
              key={n}
              href={urlNet ? switchNetPath(pathname, n) : pathname}
              data-active={net === n}
              data-net={n}
              title={n === "mainnet" ? "X1 Mainnet" : "X1 Testnet"}
              onClick={() => {
                rememberNet(n);
                closeDrawer();
              }}
            >
              <span className="sb-net-full">{n === "mainnet" ? "Mainnet" : "Testnet"}</span>
              <span className="sb-net-short">{n === "mainnet" ? "M" : "T"}</span>
            </Link>
          ))}
        </div>

        <nav className="sb-nav">
          {sections(net).map((s, i) => (
            <div key={s.title ?? i} className="sb-section">
              {s.title && <div className="sb-title">{s.title}</div>}
              {s.items.map(renderItem)}
            </div>
          ))}
        </nav>

        <div className="sb-section sb-bottom">
          <div className="sb-theme">
            <span className="sb-title">Theme</span>
            <ThemeToggle />
          </div>
          <button
            type="button"
            className="sb-item sb-toggle"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronsRight className="sb-icon" size={18} /> : <ChevronsLeft className="sb-icon" size={18} />}
            <span className="sb-label">Collapse</span>
          </button>
        </div>
      </aside>
    </>
  );
}
