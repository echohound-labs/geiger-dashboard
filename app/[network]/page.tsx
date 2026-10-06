import Link from "next/link";
import type { ReactNode } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { Badge, Dot, ErrorPanel, KV, PageTitle, Panel, type Tone } from "@/components/ui";
import { getTestnetOverview, type TestnetOverview } from "@/lib/chain";
import { MAINNET_ORACLE, TELEGRAM_URL, TESTNET, WHITE_PAPER_URL, explorerAddress, explorerTx, mainnetTx } from "@/lib/config";
import { amount, amountShort, int, linesToDuration, short, timeAgo, utc } from "@/lib/format";
import { freshnessOf, getMainnetFeed, getMainnetNodes, getMainnetOracle, type Freshness, type MainnetTx } from "@/lib/mainnet";
import { netMetadata, netParam, type NetParams, type NetSlug } from "@/lib/networks";
import { CAP } from "@/lib/schedule";

export const dynamic = "force-dynamic";
export const generateMetadata = netMetadata("Overview");

const freshTone: Record<Freshness, Tone> = { fresh: "good", warning: "warn", stale: "bad", unknown: "muted" };

type FeedRow = { time: number | null; what: ReactNode; href: string; ref: string };
type GeroSummary = {
  status: string;
  tone: Tone;
  requests: string;
  nodes: string;
  nodesTone: Tone;
  feed: FeedRow[] | null;
  /** Testnet only: the ENTROPY card's figures, from the same read. */
  entropy?: TestnetOverview["entropy"];
};

const FEED_ROWS = 6;

function mainnetRow(t: MainnetTx): FeedRow {
  return {
    time: t.blockTime,
    what: <span className={t.failed ? "text-term-red" : t.label === "Finalize" ? "text-term-green" : undefined}>{t.label}{t.failed ? " (failed)" : ""}</span>,
    href: mainnetTx(t.signature),
    ref: t.signature,
  };
}

async function geroSummary(net: NetSlug): Promise<GeroSummary> {
  if (net === "mainnet") {
    const [oracle, nodes, feed] = await Promise.all([
      getMainnetOracle(),
      getMainnetNodes().catch(() => null),
      getMainnetFeed().catch(() => null),
    ]);
    const { freshness } = freshnessOf(oracle, feed?.lastFinalize ?? null);
    const online = nodes?.filter((n) => n.online).length ?? 0;
    return {
      status: oracle.paused ? "PAUSED" : freshness.toUpperCase(),
      tone: oracle.paused ? "bad" : freshTone[freshness],
      requests: `${int(oracle.totalRequests)} requested · ${int(oracle.totalFulfillments)} fulfilled`,
      nodes: nodes === null ? "?" : `${online} / ${nodes.length}`,
      nodesTone: online > 0 ? "good" : "bad",
      feed: feed ? feed.txs.slice(0, FEED_ROWS).map(mainnetRow) : null,
    };
  }
  // One slim read: no full line record, no supply checks, no full request accounts.
  const v = await getTestnetOverview(FEED_ROWS);
  const sym = TESTNET.symbol;
  return {
    status: v.live ? "LIVE" : v.paused ? "PAUSED" : "STALE",
    tone: v.live ? "good" : "bad",
    requests: `${int(v.totalRequests)} requested · ${int(v.totalFulfillments)} served`,
    nodes: `${v.nodesOnline} / ${v.nodesListed}`,
    nodesTone: v.nodesOnline > 0 ? "good" : "bad",
    entropy: v.entropy,
    feed: v.events
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
          href: e.kind === "fulfilled" ? explorerAddress(e.ref) : explorerTx(e.ref),
          ref: e.ref,
        }))
      : null,
  };
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

export default async function OverviewPage(p: NetParams) {
  const net = netParam(p);
  const [gero] = await Promise.allSettled([geroSummary(net)]);
  const entropy = gero.status === "fulfilled" ? (gero.value.entropy ?? null) : null;
  const sym = TESTNET.symbol;
  return (
    <>
      <PageTitle title="Overview" network={net} right={<AutoRefresh renderedAt={Date.now()} />} />

      <div className="mb-6 max-w-3xl space-y-3 text-[15px] leading-relaxed text-term-text">
        <p>
          <span className="font-mono text-term-green">GERO</span> is a randomness oracle on X1 whose entropy comes from
          physical radioactive decay measured by Geiger counters run by node operators. {MAINNET_ORACLE.label} runs GERO{" "}
          {MAINNET_ORACLE.version}; {TESTNET.label} runs the next version, GERO {TESTNET.geroVersion}.
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
                    <Dot tone={gero.value.tone} />
                    {gero.value.status}
                  </span>,
                ],
                ["Requests", gero.value.requests],
                ["Nodes online", gero.value.nodes],
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
