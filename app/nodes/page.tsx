import { AutoRefresh } from "@/components/auto-refresh";
import { Addr, Badge, ErrorPanel, KV, PageTitle, Panel, type Tone } from "@/components/ui";
import { PAYOUT_DELAY_SLOTS, getNodesView, type NodeStatus, type NodesView } from "@/lib/chain";
import { NETWORK } from "@/lib/config";
import { amount, int, linesToDuration, pct, slotsToDuration, xnt } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nodes" };

const statusTone: Record<NodeStatus, Tone> = { active: "good", shadow: "warn", offline: "bad" };

export default async function NodesPage() {
  let v: NodesView;
  try {
    v = await getNodesView();
  } catch (e) {
    return (
      <>
        <PageTitle title="Nodes" />
        <ErrorPanel error={e} />
      </>
    );
  }
  return (
    <>
      <PageTitle
        title="Nodes"
        sub={`Every node in GERO's table. On-time rate is over the last ${int(v.window)} final lines (≈ ${linesToDuration(v.window)}) of the line record. Required stake ${xnt(v.requiredStakeLamports)}, slash ${xnt(v.slashLamports)} per missed line.`}
        right={<AutoRefresh renderedAt={Date.now()} />}
      />
      {v.lineLogDefect && (
        <div className="mb-3 rounded-md border border-term-amber/40 p-3 font-mono text-sm text-term-amber">
          Line record unusable ({v.lineLogDefect}): on-time rates and payouts below are incomplete.
        </div>
      )}
      {v.nodes.length === 0 && <Panel>No nodes in the table.</Panel>}
      <div className="grid grid-cols-1 gap-3">
        {v.nodes.map((n) => {
          const earned = n.claim ? n.claim.accrued + n.claim.totalClaimed : null;
          return (
            <Panel key={n.index}>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="font-mono text-sm text-term-text2">slot {n.index}</span>
                <Badge tone={statusTone[n.status]}>{n.status}</Badge>
                {n.statusNote && <span className="font-mono text-xs text-term-text3">{n.statusNote}</span>}
              </div>
              <div className="grid grid-cols-1 gap-x-8 lg:grid-cols-2">
                <KV
                  rows={[
                    ["Operator", <Addr key="o" value={n.operator} />],
                    ["Payout address", <Addr key="p" value={n.payout} />],
                    [
                      "Pending payout change",
                      n.pendingPayout ? (
                        <span key="pp" className="text-term-amber">
                          <Addr value={n.pendingPayout.to} />
                          <br />
                          {n.pendingPayout.slotsLeft > 0
                            ? `applies in ${int(n.pendingPayout.slotsLeft)} slots (≈ ${slotsToDuration(n.pendingPayout.slotsLeft)}), slot ${int(n.pendingPayout.applySlot)}`
                            : `delay over since slot ${int(n.pendingPayout.applySlot)}; anyone can apply it`}
                        </span>
                      ) : (
                        "none"
                      ),
                    ],
                    ["Earns from line", n.activeFromLine === null ? "—" : int(n.activeFromLine)],
                    ["Committed through line", int(n.committedThroughLine)],
                  ]}
                />
                <KV
                  rows={[
                    [
                      "On-time rate",
                      n.onTime ? (
                        <span key="ot">
                          {pct(n.onTime.hits, n.onTime.lines)}{" "}
                          <span className="text-term-text3">
                            ({int(n.onTime.hits)} / {int(n.onTime.lines)})
                          </span>
                        </span>
                      ) : (
                        "— (not earning yet)"
                      ),
                    ],
                    ["Stake", n.stakeLamports === null ? "no stream account" : xnt(n.stakeLamports)],
                    ["Missed / slashed (open batches)", `${n.missesOpen} / ${n.slashesOpen}`],
                    [`${NETWORK.symbol} earned`, earned === null ? "no claim account yet" : amount(earned)],
                    [
                      "  claimed · claimable",
                      n.claim ? `${amount(n.claim.totalClaimed)} · ${amount(n.claim.accrued)}` : "—",
                    ],
                  ]}
                />
              </div>
            </Panel>
          );
        })}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-term-text3">
        Status: <span className="text-term-text2">active</span> = in the table and committing;{" "}
        <span className="text-term-text2">shadow</span> = in its probation week, earns nothing and sets no line bits;{" "}
        <span className="text-term-text2">offline</span> = inactive, or no commit within the last few lines. Payout changes wait{" "}
        {int(PAYOUT_DELAY_SLOTS)} slots (72 h as designed). Slashes are counted from line batches that are still open (they
        close 512 slots after their line); a lifetime count needs an indexer. Earned = claimed + claimable on the payout
        address&apos;s claim account; lines not yet settled are not included.
      </p>
    </>
  );
}
