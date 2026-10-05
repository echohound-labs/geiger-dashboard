import { AutoRefresh } from "@/components/auto-refresh";
import { Addr, Badge, Dot, ErrorPanel, Grid, KV, PageTitle, Panel, Stat, Table, type Tone } from "@/components/ui";
import { MAINNET_ORACLE, mainnetAddress, mainnetTx } from "@/lib/config";
import { int, short, timeAgo, utc, xnt } from "@/lib/format";
import { CANCEL_WINDOW_SLOTS, ONLINE_THRESHOLD_S, getMainnetView, type Freshness, type MainnetView } from "@/lib/mainnet";

export const dynamic = "force-dynamic";

const freshTone: Record<Freshness, Tone> = { fresh: "good", warning: "warn", stale: "bad", unknown: "muted" };

function minutes(s: number): string {
  return s < 600 ? `${(s / 60).toFixed(1)} min` : `${Math.round(s / 60)} min`;
}

export default async function OraclePage() {
  let v: MainnetView;
  try {
    v = await getMainnetView();
  } catch (e) {
    return (
      <>
        <PageTitle title="Oracle" network="mainnet" />
        <ErrorPanel error={e} />
      </>
    );
  }
  const now = Date.now() / 1000;
  const o = v.oracle;
  const online = v.nodes?.filter((n) => n.online).length ?? 0;
  return (
    <>
      <PageTitle
        title="Oracle"
        network="mainnet"
        sub={`GERO ${MAINNET_ORACLE.version}, the live randomness oracle on X1 mainnet, read from its program accounts and the node operator's transactions.`}
        right={<AutoRefresh renderedAt={Date.now()} />}
      />
      <Grid>
        <Stat label="Requests" value={int(o.totalRequests)} sub="total requested" />
        <Stat
          label="Fulfilled"
          value={int(o.totalFulfillments)}
          sub={v.pending === null ? "pending: unavailable" : `${v.pending.length} pending in the fulfil window`}
        />
        <Stat
          label="Nodes"
          value={v.nodes === null ? "?" : `${online} / ${v.nodes.length}`}
          tone={online > 0 ? "good" : "bad"}
          sub="online / registered"
        />
        <Stat
          label="Pool freshness"
          value={
            <span className="flex items-center gap-2">
              <Dot tone={freshTone[v.freshness]} />
              {o.paused ? "PAUSED" : v.freshness.toUpperCase()}
            </span>
          }
          tone={o.paused ? "bad" : freshTone[v.freshness]}
          sub={
            v.freshnessAgeS === null
              ? "no finalize among the recent transactions"
              : `last finalize ${minutes(v.freshnessAgeS)} ago · bound ${minutes(v.poolAgeBoundS)}`
          }
        />
      </Grid>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel
          title="Oracle state"
          note={`Fulfilment is refused once the entropy pool is older than the on-chain bound (${int(o.maxPoolAgeSlots)} slots, about ${minutes(v.poolAgeBoundS)} at 0.3675 s per slot). Freshness is the time since the operator's newest finalize: warning past half the bound, stale past it.`}
        >
          <KV
            rows={[
              ["Status", o.paused ? <Badge tone="bad">paused</Badge> : <Badge tone="good">running</Badge>],
              ["Version", `${MAINNET_ORACLE.version} (OracleState ${o.length} B)`],
              ["Registered nodes (OracleState)", int(o.totalNodes)],
              ["Requests / fulfilled", `${int(o.totalRequests)} / ${int(o.totalFulfillments)}`],
              ["Pool-age bound", `${int(o.maxPoolAgeSlots)} slots`],
              ["Current slot", v.slot === null ? "—" : int(v.slot)],
              [
                "Program",
                <a key="p" className="underline decoration-term-line" href={mainnetAddress(MAINNET_ORACLE.program)} target="_blank" rel="noreferrer">
                  <Addr value={MAINNET_ORACLE.program} />
                </a>,
              ],
            ]}
          />
        </Panel>
        <Panel
          title="Entropy pool"
          note="32 seed slots; each finalize writes the slot at the head and moves the head on."
        >
          {v.pool ? (
            <>
              <KV
                rows={[
                  ["Seeds filled", `${v.pool.filled} / 32`],
                  ["Head (next write slot)", `${v.pool.head % 32}`],
                  ["Total submissions", int(v.pool.totalSubmissions)],
                ]}
              />
              <ul className="mt-3 space-y-0.5 font-mono text-xs">
                {v.pool.recent.map((r, k) => (
                  <li key={r.index} className={k === 0 ? "text-term-green" : "text-term-text3"}>
                    [{String(r.index).padStart(2, "0")}] {r.hex ? `${r.hex}…` : "(empty)"} {k === 0 ? "← latest" : ""}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="font-mono text-sm text-term-text3">Entropy pool unavailable.</p>
          )}
        </Panel>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3">
        <Panel
          title="Nodes"
          note={`Online = last submission within ${ONLINE_THRESHOLD_S / 60} min. Sorted by submissions.`}
        >
          {v.nodes === null ? (
            <p className="font-mono text-sm text-term-text3">Node accounts unavailable.</p>
          ) : (
            <Table
              head={["Status", "Node", "Submissions", "Last submission", "Reputation", "Approved"]}
              rows={v.nodes.map((n) => [
                <span key="s" className={n.online ? "text-term-green" : "text-term-red"}>
                  {n.online ? "● online" : "○ offline"}
                </span>,
                <a key="a" className="underline decoration-term-line" href={mainnetAddress(n.address)} target="_blank" rel="noreferrer" title={n.address}>
                  {short(n.address, 8)}
                </a>,
                int(n.submissions),
                <span key="l" title={utc(n.lastSubmission)}>{timeAgo(n.lastSubmission, now)}</span>,
                `${n.reputation}/100`,
                n.approved ? <span key="ap" className="text-term-green">yes</span> : <span key="ap" className="text-term-text3">no</span>,
              ])}
              empty="No registered nodes found."
            />
          )}
        </Panel>

        <Panel
          title="Pending requests"
          note={`A request can be fulfilled until ${CANCEL_WINDOW_SLOTS} slots after it was made; after that it can only be cancelled.`}
        >
          {v.pending === null ? (
            <p className="font-mono text-sm text-term-text3">Request accounts unavailable.</p>
          ) : (
            <>
              <Table
                head={["Request", "Request slot"]}
                rows={v.pending.map((r) => [
                  <a key="r" className="underline decoration-term-line" href={mainnetAddress(r.address)} target="_blank" rel="noreferrer">
                    <Addr value={r.address} />
                  </a>,
                  int(r.requestSlot),
                ])}
                empty="No pending requests."
              />
              {v.expired.length > 0 && (
                <p className="mt-3 font-mono text-xs text-term-text3">
                  {v.expired.length} older open request{v.expired.length === 1 ? "" : "s"} past the fulfil window (cancel-only).
                </p>
              )}
            </>
          )}
        </Panel>

        <Panel title="Recent transactions" note="The node operator's newest transactions, labelled from the program logs. A cycle is one reveal + commit and one finalize.">
          {v.txs === null ? (
            <p className="font-mono text-sm text-term-text3">Transaction history unavailable.</p>
          ) : (
            <Table
              head={["Time", "Instruction", "Fee", "Signature"]}
              rows={v.txs.map((t) => [
                t.blockTime === null ? "—" : <span key="t" title={utc(t.blockTime)}>{timeAgo(t.blockTime, now)}</span>,
                <span key="l" className={t.failed ? "text-term-red" : t.label === "Finalize" ? "text-term-green" : "text-term-text"}>
                  {t.label}
                  {t.failed ? " (failed)" : ""}
                </span>,
                t.feeLamports === null ? "—" : xnt(BigInt(t.feeLamports)),
                <a key="s" className="underline decoration-term-line" href={mainnetTx(t.signature)} target="_blank" rel="noreferrer" title={t.signature}>
                  {short(t.signature, 10)}
                </a>,
              ])}
              empty="No recent transactions."
            />
          )}
        </Panel>
      </div>
    </>
  );
}
