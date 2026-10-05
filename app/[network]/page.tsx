import Link from "next/link";
import type { ReactNode } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { Badge, Dot, ErrorPanel, KV, PageTitle, Panel, type Tone } from "@/components/ui";
import { getEntropyView, getNetworkView } from "@/lib/chain";
import { MAINNET_ORACLE, TESTNET, WHITE_PAPER_URL } from "@/lib/config";
import { amount, amountShort, int, linesToDuration } from "@/lib/format";
import { getMainnetView, type Freshness } from "@/lib/mainnet";
import { netMetadata, netParam, type NetParams, type NetSlug } from "@/lib/networks";
import { CAP } from "@/lib/schedule";

export const dynamic = "force-dynamic";
export const generateMetadata = netMetadata("Overview");

const freshTone: Record<Freshness, Tone> = { fresh: "good", warning: "warn", stale: "bad", unknown: "muted" };

type GeroSummary = { status: string; tone: Tone; requests: string; nodes: string; nodesTone: Tone };

async function geroSummary(net: NetSlug): Promise<GeroSummary> {
  if (net === "mainnet") {
    const v = await getMainnetView();
    const online = v.nodes?.filter((n) => n.online).length ?? 0;
    return {
      status: v.oracle.paused ? "PAUSED" : v.freshness.toUpperCase(),
      tone: v.oracle.paused ? "bad" : freshTone[v.freshness],
      requests: `${int(v.oracle.totalRequests)} requested · ${int(v.oracle.totalFulfillments)} fulfilled`,
      nodes: v.nodes === null ? "?" : `${online} / ${v.nodes.length}`,
      nodesTone: online > 0 ? "good" : "bad",
    };
  }
  const v = await getNetworkView();
  return {
    status: v.live ? "LIVE" : v.oracle.paused ? "PAUSED" : "STALE",
    tone: v.live ? "good" : "bad",
    requests: `${int(v.oracle.totalRequests)} requested · ${int(v.oracle.totalFulfillments)} served`,
    nodes: `${v.nodesOnline} / ${v.nodesListed}`,
    nodesTone: v.nodesOnline > 0 ? "good" : "bad",
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
  const [gero, entropy] = await Promise.allSettled([
    geroSummary(net),
    net === "testnet" ? getEntropyView() : Promise.resolve(null),
  ]);
  const sym = TESTNET.symbol;
  return (
    <>
      <PageTitle title="Overview" network={net} right={<AutoRefresh renderedAt={Date.now()} />} />

      <div className="mb-6 max-w-3xl space-y-3 text-[15px] leading-relaxed text-term-text">
        <p>
          <span className="font-mono text-term-green">GERO</span> is a randomness oracle on X1 whose entropy comes from
          physical radioactive decay measured by Geiger counters run by node operators. {MAINNET_ORACLE.label} runs GERO{" "}
          {MAINNET_ORACLE.version}; {TESTNET.label} runs the next version, GERO v9.1b.
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
          ) : entropy.status === "rejected" ? (
            <ErrorPanel error={entropy.reason} />
          ) : entropy.value ? (
            <>
              <KV
                rows={[
                  [
                    "Minted / cap",
                    `${entropy.value.supply === null ? "?" : amountShort(entropy.value.supply)} / ${amountShort(CAP, 0)}`,
                  ],
                  ["Era", entropy.value.era],
                  ["Rate", `${amount(entropy.value.ratePerLine)} ${sym} per line`],
                  [
                    "Next halving",
                    `line ${int(entropy.value.nextHalvingLine)} (≈ ${linesToDuration(entropy.value.linesToHalving)})`,
                  ],
                ]}
              />
              <CardLink href="/testnet/entropy">Token &amp; supply →</CardLink>
            </>
          ) : null}
        </Panel>
      </div>

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
      </div>
    </>
  );
}
