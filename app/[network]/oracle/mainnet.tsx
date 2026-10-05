import { AutoRefresh } from "@/components/auto-refresh";
import { Addr, Badge, Dot, ErrorPanel, Grid, KV, PageTitle, Panel, Stat, type Tone } from "@/components/ui";
import { MAINNET_ORACLE, mainnetAddress } from "@/lib/config";
import { int } from "@/lib/format";
import { getMainnetView, type Freshness, type MainnetView } from "@/lib/mainnet";

const freshTone: Record<Freshness, Tone> = { fresh: "good", warning: "warn", stale: "bad", unknown: "muted" };

function minutes(s: number): string {
  return s < 600 ? `${(s / 60).toFixed(1)} min` : `${Math.round(s / 60)} min`;
}

export async function MainnetOracle() {
  let v: MainnetView;
  try {
    v = await getMainnetView();
  } catch (e) {
    return (
      <>
        <PageTitle title="Oracle status" network="mainnet" />
        <ErrorPanel error={e} />
      </>
    );
  }
  const o = v.oracle;
  const online = v.nodes?.filter((n) => n.online).length ?? 0;
  return (
    <>
      <PageTitle
        title="Oracle status"
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
    </>
  );
}
