import type { ReactNode } from "react";
import { Badge, Details, KV, Panel, type Tone } from "./ui";
import { int } from "@/lib/format";
import { TELEGRAM_URL } from "@/lib/config";

/** One node: name and slot, a badge row, then two columns of figures. Legacy nodes are greyed. */
export function NodeCard({
  name,
  sub,
  badges,
  left,
  right,
  footer,
  details,
  legacy = false,
}: {
  name: ReactNode;
  sub?: ReactNode;
  badges: ReactNode;
  left: [ReactNode, ReactNode][];
  right: [ReactNode, ReactNode][];
  footer?: ReactNode;
  /** Rows for the card's closed Details box (on-chain name, addresses). */
  details?: [ReactNode, ReactNode][];
  legacy?: boolean;
}) {
  return (
    <Panel className={legacy ? "opacity-60 grayscale" : ""}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="break-words text-lg font-semibold text-term-text">{name}</h2>
          {sub && <div className="font-mono text-xs text-term-text3">{sub}</div>}
        </div>
        <div className="flex flex-wrap items-center gap-2">{badges}</div>
      </div>
      <div className="grid grid-cols-1 gap-x-8 lg:grid-cols-2">
        <KV rows={left} />
        <KV rows={right} />
      </div>
      {footer && <div className="mt-3">{footer}</div>}
      {details && (
        <Details className="mt-3">
          <KV rows={details} />
        </Details>
      )}
    </Panel>
  );
}

export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <Badge tone={tone}>{children}</Badge>;
}

/**
 * On-time strip for the most recent final lines, oldest left. Each tick has a title with its line number; the
 * caller prints the totals beside it, so the reading never depends on colour alone.
 */
export function LineStrip({ lines }: { lines: { line: bigint; onTime: boolean }[] }) {
  if (lines.length === 0) return null;
  const hits = lines.filter((l) => l.onTime).length;
  const w = 4;
  const gap = 2;
  const h = 16;
  return (
    <svg
      width={lines.length * (w + gap) - gap}
      height={h}
      role="img"
      aria-label={`${hits} of the last ${lines.length} lines on time`}
      className="inline-block align-middle"
    >
      {lines.map((l, i) => (
        <rect
          key={i}
          x={i * (w + gap)}
          y={l.onTime ? 0 : h / 2}
          width={w}
          height={l.onTime ? h : h / 2}
          rx={1}
          className={l.onTime ? "fill-term-green" : "fill-term-red"}
        >
          <title>{`line ${int(l.line)}: ${l.onTime ? "on time" : "missed"}`}</title>
        </rect>
      ))}
    </svg>
  );
}

/** Requirements to run a node, at the level of the white paper. */
export function BecomeOperator({ stake, slash }: { stake?: string; slash?: string }) {
  const items: [string, ReactNode][] = [
    ["Approval", "Nodes are approved by GERO's governance key, held on a hardware wallet. The node set and payout addresses are public from the moment a node is proposed."],
    [
      "7-day shadow period",
      "After approval the node commits and reveals on the real network for 7 days, but affects no result, is not slashable and earns nothing. After that it can be activated.",
    ],
    [
      "XNT bond",
      <>
        Nodes post a bond in XNT, never in ENTROPY. A node that misses its reveal window is slashable and earns nothing
        for that line. Current values: a stake of {stake ?? "10 XNT"} and a slash of {slash ?? "1 XNT"} per missed line.
      </>,
    ],
    ["Geiger counter hardware", "GERO's entropy comes from radioactive decay measured by Geiger counters, so each node runs one."],
    [
      "Cold payout wallet",
      "The hot node key stays in the daemon; a cold owner key never touches the node machine. Only the owner key can change the payout address, after a 72-hour public delay. On mainnet the payout wallet must be a cold wallet that can connect to a browser, separate from the node key.",
    ],
  ];
  return (
    <Panel title="Become a node operator">
      <ul className="space-y-3 text-sm leading-relaxed text-term-text">
        {items.map(([k, v]) => (
          <li key={k}>
            <span className="font-mono text-term-green">{k}.</span> <span className="text-term-text2">{v}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 border-t border-term-line pt-3 text-sm text-term-text2">
        <span className="font-mono text-term-green">Contact.</span> To apply, join the GERO Network Telegram:{" "}
        <a className="underline decoration-term-line hover:text-term-text" href={TELEGRAM_URL} target="_blank" rel="noreferrer">
          https://t.me/geronetwork
        </a>
      </p>
    </Panel>
  );
}
