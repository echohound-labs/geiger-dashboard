import Link from "next/link";
import type { ReactNode } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { Badge, Dot, ErrorPanel, KV, PageTitle, Panel, type Tone } from "@/components/ui";
import { getOverview, type Overview } from "@/lib/chain";
import { MAINNET, TELEGRAM_URL, TESTNET, WHITE_PAPER_URL, explorerAddress, explorerTx, networkConfig } from "@/lib/config";
import { amount, amountShort, int, linesToDuration, short, timeAgo, utc, xnt } from "@/lib/format";
import { netMetadata, netParam, type NetParams, type NetSlug } from "@/lib/networks";
import { CAP } from "@/lib/schedule";

export const dynamic = "force-dynamic";
export const generateMetadata = netMetadata("Overview");

type FeedRow = { time: number | null; what: ReactNode; href: string; ref: string };

const FEED_ROWS = 6;

// One slim read per network: OracleState, the newest fulfilled requests and, where they exist, the last 64
// line-record entries and the minter's figures.
async function geroSummary(net: NetSlug) {
  const cfg = networkConfig(net);
  const v = await getOverview(FEED_ROWS, cfg);
  const sym = cfg.symbol;
  const feed: FeedRow[] | null = v.events
    ? v.events.map((e) => ({
        time: e.time,
        what:
          e.kind === "fulfilled" ? (
            <span className="text-term-green">Request fulfilled · line {int(e.line ?? 0n)}</span>
          ) : (
            <span>
              {e.kind === "claim" ? "Claim" : "Ecosystem claim"} · {e.amount === null ? "?" : amountShort(e.amount)} {sym}
            </span>
          ),
        href: e.kind === "fulfilled" ? explorerAddress(e.ref, cfg) : explorerTx(e.ref, cfg),
        ref: e.ref,
      }))
    : null;
  return { v, feed };
}

const btn = "inline-flex items-center rounded border px-3 py-1.5 font-mono text-[13px] tracking-wide transition-colors";
const btnPrimary = `${btn} border-term-green/50 text-term-green hover:bg-term-green/10`;
const btnPlain = `${btn} border-term-lineStrong text-term-text2 hover:text-term-text`;

function CardLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="mt-3 inline-block font-mono text-sm text-term-green underline">
      {children}
    </Link>
  );
}

function statusOf(v: Overview): { text: string; tone: Tone } {
  if (v.paused) return { text: "PAUSED", tone: "bad" };
  return v.live ? { text: "LIVE", tone: "good" } : { text: "STALE", tone: "bad" };
}

export default async function OverviewPage(p: NetParams) {
  const net = netParam(p);
  const cfg = networkConfig(net);
  const [gero] = await Promise.allSettled([geroSummary(net)]);
  const entropy = gero.status === "fulfilled" ? gero.value.v.entropy : null;
  const sym = TESTNET.symbol;
  return (
    <>
      <PageTitle title="Overview" network={net} right={<AutoRefresh renderedAt={Date.now()} />} />

      <div className="mb-6 max-w-3xl space-y-3 text-[15px] leading-relaxed text-term-text">
        <p>
          <span className="font-mono text-term-green">GERO</span> is a randomness oracle on X1 whose entropy comes from
          physical radioactive decay measured by Geiger counters run by node operators. Both networks run GERO{" "}
          {MAINNET.geroVersion}: {MAINNET.label} has the oracle and the request fee; {TESTNET.label} additionally has
          the line record and {sym}. GERO is run by a single operator with one node today.
        </p>
        <p>
          <span className="font-mono text-term-green">ENTROPY</span> is a mined, hard-capped utility token for GERO:
          each line&apos;s emission is credited to the nodes that were on time, the prover and an ecosystem vault. It is in testing on {TESTNET.label} as {sym}, a test token with no
          value, and is not launched on mainnet.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel title="GERO" tag={<Badge tone={net === "mainnet" ? "good" : "warn"}>{net}</Badge>}>
          {gero.status === "rejected" ? (
            <ErrorPanel error={gero.reason} />
          ) : (
            <KV
              rows={[
                [
                  "Status",
                  <span key="s" className="inline-flex items-center gap-2">
                    <Dot tone={statusOf(gero.value.v).tone} />
                    {statusOf(gero.value.v).text}
                  </span>,
                ],
                ["Requests", `${int(gero.value.v.totalRequests)} requested · ${int(gero.value.v.totalFulfillments)} served`],
                ["Request fee", `${xnt(gero.value.v.requestFeeLamports)} per request`],
                ["Nodes online", `${gero.value.v.nodesOnline} / ${gero.value.v.nodesListed}`],
                ["Line record", gero.value.v.hasLineRecord ? "on" : `not on ${net} yet`],
              ]}
            />
          )}
          <CardLink href={`/${net}/oracle`}>Oracle status →</CardLink>
        </Panel>

        <Panel title="ENTROPY" tag={<Badge tone={net === "mainnet" ? "muted" : "warn"}>{net === "mainnet" ? "not launched" : sym}</Badge>}>
          {net === "mainnet" ? (
            <>
              <p className="text-[15px] text-term-text">ENTROPY is not launched on mainnet yet.</p>
              <CardLink href="/testnet">Try it on Testnet →</CardLink>
            </>
          ) : gero.status === "rejected" ? (
            <ErrorPanel error={gero.reason} />
          ) : entropy === null ? (
            <p className="text-[15px] text-term-text">The minter is not initialized on testnet.</p>
          ) : (
            <>
              <KV
                rows={[
                  [
                    "Minted / cap",
                    `${entropy.supply === null ? "?" : amountShort(entropy.supply)} / ${amountShort(CAP, 0)}`,
                  ],
                  ["Era", entropy.era],
                  ["Rate", `${amount(entropy.ratePerLine)} ${sym} per line`],
                  [
                    "Next halving",
                    `line ${int(entropy.nextHalvingLine)} (≈ ${linesToDuration(entropy.linesToHalving)})`,
                  ],
                ]}
              />
              <CardLink href="/testnet/entropy">Token &amp; supply →</CardLink>
            </>
          )}
        </Panel>
      </div>

      <Panel
        className="mt-3"
        title="Recent activity"
        tag={<Badge tone={net === "mainnet" ? "good" : "warn"}>{net}</Badge>}
        note={net === "mainnet" ? `Fulfilled requests under the GERO program on ${cfg.label}. Claims are not on mainnet yet.` : undefined}
      >
        {gero.status === "rejected" || gero.value.feed === null ? (
          <p className="font-mono text-sm text-term-text3">Activity unavailable.</p>
        ) : gero.value.feed.length === 0 ? (
          <p className="font-mono text-sm text-term-text3">Nothing recent.</p>
        ) : (
          <ul className="divide-y divide-term-line">
            {gero.value.feed.map((f) => (
              <li key={f.ref} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2 font-mono text-[13px]">
                <span className="text-term-text">{f.what}</span>
                <span className="flex items-baseline gap-3 text-term-text3">
                  {f.time !== null && <span title={utc(f.time)}>{timeAgo(f.time)}</span>}
                  <a className="underline decoration-term-line" href={f.href} target="_blank" rel="noreferrer" title={f.ref}>
                    {short(f.ref, 6)}
                  </a>
                </span>
              </li>
            ))}
          </ul>
        )}
        <CardLink href={`/${net}/activity`}>View all →</CardLink>
      </Panel>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/learn/how-to-test" className={btnPrimary}>
          How to test
        </Link>
        <a href={WHITE_PAPER_URL} target="_blank" rel="noreferrer" className={btnPlain}>
          White paper (PDF)
        </a>
        <Link href="/testnet/claim" className={btnPlain}>
          Claim {sym} (testnet)
        </Link>
        <a href={TELEGRAM_URL} target="_blank" rel="noreferrer" className={btnPlain}>
          Telegram
        </a>
      </div>
    </>
  );
}
