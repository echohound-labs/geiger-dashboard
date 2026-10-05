import { AutoRefresh } from "@/components/auto-refresh";
import { BecomeOperator, LineStrip, NodeCard } from "@/components/node-card";
import { Addr, Badge, ErrorPanel, HOT_PAYOUT_NOTE, HotPayoutBadge, PageTitle, Panel, type Tone } from "@/components/ui";
import { PAYOUT_DELAY_SLOTS, getNodesView, type NodeView, type NodesView } from "@/lib/chain";
import { NETWORK, NODE_NAMES } from "@/lib/config";
import { amount, int, linesToDuration, pct, slotsToDuration, xnt } from "@/lib/format";

function statusBadge(n: NodeView): { tone: Tone; text: string } {
  if (n.legacy) return { tone: "muted", text: "legacy" };
  if (n.status === "active") return { tone: "good", text: "active" };
  if (n.status === "shadow")
    return {
      tone: "warn",
      text: n.shadowEnds
        ? n.shadowEnds.slotsLeft > 0
          ? `shadow · ${slotsToDuration(n.shadowEnds.slotsLeft)} left`
          : "shadow · week over, can be activated"
        : "shadow",
    };
  return { tone: "bad", text: "offline" };
}

function Card({ n, required }: { n: NodeView; required: bigint }) {
  const s = statusBadge(n);
  const hot = n.payout === n.operator;
  const sym = NETWORK.symbol;
  const earned = n.claim ? n.claim.accrued + n.claim.totalClaimed : null;
  const recentHits = n.recent.filter((r) => r.onTime).length;
  return (
    <NodeCard
      legacy={n.legacy}
      name={NODE_NAMES[n.operator] ?? `Node ${n.index}`}
      sub={<>slot {n.index} · {n.statusNote || "—"}</>}
      badges={
        <>
          <Badge tone={s.tone}>{s.text}</Badge>
          {hot ? <HotPayoutBadge /> : <Badge tone="good">separate payout key</Badge>}
        </>
      }
      left={[
        [
          "On time",
          n.onTime ? (
            <span key="ot">
              {pct(n.onTime.hits, n.onTime.lines)}{" "}
              <span className="text-term-text3">
                ({int(n.onTime.hits)} / {int(n.onTime.lines)} lines)
              </span>
            </span>
          ) : (
            "— (not earning yet)"
          ),
        ],
        [
          `Last ${n.recent.length || "—"} lines`,
          n.recent.length ? (
            <span key="sp" className="inline-flex flex-wrap items-center justify-end gap-2">
              <LineStrip lines={n.recent} />
              <span className="text-term-text3">
                {recentHits}/{n.recent.length}
              </span>
            </span>
          ) : (
            "—"
          ),
        ],
        ["Current streak", n.onTime ? `${int(n.streak)} line${n.streak === 1 ? "" : "s"} on time` : "—"],
        [
          "Stake / required",
          n.stakeLamports === null ? (
            "no stream account"
          ) : (
            <span key="st" className={n.stakeLamports < required ? "text-term-amber" : undefined}>
              {xnt(n.stakeLamports)} / {xnt(required)}
            </span>
          ),
        ],
        ["Missed / slashed (open batches)", `${n.missesOpen} / ${n.slashesOpen}`],
      ]}
      right={[
        [`${sym} earned`, earned === null ? "no claim account yet" : amount(earned)],
        ["Claimed", n.claim ? amount(n.claim.totalClaimed) : "—"],
        ["Claimable", n.claim ? amount(n.claim.accrued) : "—"],
        ["Payout address", <Addr key="p" value={n.payout} />],
        [
          "Pending payout change",
          n.pendingPayout ? (
            <span key="pp" className="text-term-amber">
              <Addr value={n.pendingPayout.to} />
              <br />
              {n.pendingPayout.slotsLeft > 0
                ? `applies in ≈ ${slotsToDuration(n.pendingPayout.slotsLeft)} (${int(n.pendingPayout.slotsLeft)} slots)`
                : "72 h delay over; anyone can apply it"}
            </span>
          ) : (
            "none"
          ),
        ],
      ]}
      footer={hot ? <p className="font-mono text-xs text-term-amber">⚠ {HOT_PAYOUT_NOTE}</p> : undefined}
      details={[
        ["On-chain name", `none (GERO ${NETWORK.geroVersion} stores no node names)`],
        ["Node slot", String(n.index)],
        ["Node key", <Addr key="k" value={n.operator} />],
        ["Claim account", <Addr key="c" value={n.claimAddress} />],
      ]}
    />
  );
}

export async function TestnetNodes() {
  let v: NodesView;
  try {
    v = await getNodesView();
  } catch (e) {
    return (
      <>
        <PageTitle title="Nodes" network="testnet" />
        <ErrorPanel error={e} />
      </>
    );
  }
  const nodes = [...v.nodes].sort((a, b) => Number(a.legacy) - Number(b.legacy) || a.index - b.index);
  return (
    <>
      <PageTitle
        network="testnet"
        title="Nodes"
        sub={`Every node in GERO's table. On-time rate over the last ${int(v.window)} final lines (≈ ${linesToDuration(v.window)}).`}
        right={<AutoRefresh renderedAt={Date.now()} />}
      />
      {v.lineLogDefect && (
        <div className="mb-3 rounded-md border border-term-amber/40 p-3 font-mono text-sm text-term-amber">
          Line record unusable ({v.lineLogDefect}): on-time rates and payouts below are incomplete.
        </div>
      )}
      <div className="grid grid-cols-1 gap-3">
        {nodes.length === 0 && <Panel>No nodes in the table.</Panel>}
        {nodes.map((n) => (
          <Card key={n.index} n={n} required={v.requiredStakeLamports} />
        ))}
        <BecomeOperator stake={xnt(v.requiredStakeLamports)} slash={xnt(v.slashLamports)} />
      </div>
      <p className="mt-4 text-xs leading-relaxed text-term-text3">
        <span className="text-term-text2">Active</span> = in the table and committing;{" "}
        <span className="text-term-text2">shadow</span> = in its 7-day probation, earns nothing and sets no line bits;{" "}
        <span className="text-term-text2">offline</span> = inactive, or no commit within the last few lines;{" "}
        <span className="text-term-text2">legacy</span> = inactive and not seen for 30+ days. Payout changes wait{" "}
        {int(PAYOUT_DELAY_SLOTS)} slots (72 h as designed). Missed and slashed lines are counted from line batches that are
        still open (about the last 64 lines). Earned = claimed + claimable; lines not yet settled are not included.
      </p>
    </>
  );
}
