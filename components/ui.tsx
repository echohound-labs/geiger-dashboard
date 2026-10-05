import type { ReactNode } from "react";
import { NetworkLabel, type Net } from "./network";

/** Every page title names the network the page reads. */
export function PageTitle({ title, network, sub, right }: { title: string; network: Net; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="mb-2">
          <NetworkLabel net={network} />
        </div>
        <h1 className="font-mono text-2xl tracking-wide text-term-green">{title}</h1>
        {sub && <p className="mt-1 max-w-3xl text-sm text-term-text2">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Panel({ title, children, note, className = "" }: { title?: string; children: ReactNode; note?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-md border border-term-line bg-term-panel p-4 ${className}`}>
      {title && <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.14em] text-term-text2">{title}</h2>}
      {children}
      {note && <p className="mt-3 text-xs leading-relaxed text-term-text3">{note}</p>}
    </section>
  );
}

export function Stat({ label, value, sub, tone = "default" }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone }) {
  return (
    <div className="rounded-md border border-term-line bg-term-panel p-4">
      <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-term-text2">{label}</div>
      <div className={`mt-2 break-words font-mono text-2xl ${toneText[tone]}`}>{value}</div>
      {sub && <div className="mt-1 font-mono text-xs text-term-text3">{sub}</div>}
    </div>
  );
}

export function Grid({ children, cols = 4 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const c = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[cols];
  return <div className={`grid grid-cols-1 gap-3 ${c}`}>{children}</div>;
}

export function KV({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <dl className="divide-y divide-term-line">
      {rows.map(([k, v], i) => (
        <div key={i} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
          <dt className="text-sm text-term-text2">{k}</dt>
          <dd className="break-all font-mono text-sm text-term-text sm:text-right">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export type Tone = "default" | "good" | "warn" | "bad" | "muted";
const toneText: Record<Tone, string> = {
  default: "text-term-text",
  good: "text-term-green",
  warn: "text-term-amber",
  bad: "text-term-red",
  muted: "text-term-text3",
};
const toneBox: Record<Tone, string> = {
  default: "border-term-lineStrong text-term-text",
  good: "border-term-green/40 text-term-green",
  warn: "border-term-amber/50 text-term-amber",
  bad: "border-term-red/50 text-term-red",
  muted: "border-term-line text-term-text3",
};

export function Badge({ tone = "default", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider ${toneBox[tone]}`}>
      {children}
    </span>
  );
}

export function Dot({ tone = "good" }: { tone?: Tone }) {
  const c = { default: "bg-term-text", good: "bg-term-green", warn: "bg-term-amber", bad: "bg-term-red", muted: "bg-term-text3" }[tone];
  return <span className={`inline-block h-2 w-2 rounded-full ${c}`} aria-hidden="true" />;
}

/** Address: full on wide screens, shortened on narrow ones; full value in the title. */
export function Addr({ value, label }: { value: string; label?: string }) {
  return (
    <span className="font-mono" title={value}>
      {label && <span className="text-term-text3">{label} </span>}
      <span className="hidden md:inline">{value}</span>
      <span className="md:hidden">
        {value.slice(0, 6)}…{value.slice(-6)}
      </span>
    </span>
  );
}

export function ErrorPanel({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <div className="rounded-md border border-term-red/40 bg-term-red/5 p-4 font-mono text-sm text-term-red">
      Could not read the chain: {msg}
    </div>
  );
}

export function Table({ head, rows, empty }: { head: ReactNode[]; rows: ReactNode[][]; empty?: ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-[560px] border-collapse font-mono text-[13px]">
        <thead>
          <tr className="border-b border-term-lineStrong text-left text-[11px] uppercase tracking-wider text-term-text2">
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-2 py-2 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={head.length} className="px-2 py-4 text-term-text3">
                {empty ?? "nothing to show"}
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i} className="border-b border-term-line last:border-0">
                {r.map((c, j) => (
                  <td key={j} className="whitespace-nowrap px-2 py-1.5 align-top">
                    {c}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export const HOT_PAYOUT_NOTE =
  "Payout address = operator (hot node) key. Fine on testnet; on mainnet the payout must be a cold wallet that can connect to a browser, distinct from the node key.";

/** ⚠ when a node pays its rewards to its own operator (hot node) key. */
export function HotPayoutBadge() {
  return (
    <span title={HOT_PAYOUT_NOTE}>
      <Badge tone="warn">⚠ payout = node key</Badge>
    </span>
  );
}
