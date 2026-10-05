import { AutoRefresh } from "@/components/auto-refresh";
import { Addr, Badge, Dot, ErrorPanel, Grid, KV, PageTitle, Panel, Stat } from "@/components/ui";
import { getNetworkView, type NetworkView } from "@/lib/chain";
import { NETWORK } from "@/lib/config";
import { int, linesToDuration } from "@/lib/format";

export async function TestnetOracle() {
  let v: NetworkView;
  try {
    v = await getNetworkView();
  } catch (e) {
    return (
      <>
        <PageTitle title="Oracle status" network="testnet" />
        <ErrorPanel error={e} />
      </>
    );
  }
  const ring = v.ringWindow;
  const ringLines = Number(ring.last - ring.first + 1n);
  return (
    <>
      <PageTitle
        network="testnet"
        title="Oracle status"
        sub="GERO v9.1b, the next version, in testing on X1 testnet: status read from OracleState and the on-chain line record (LineLog)."
        right={<AutoRefresh renderedAt={Date.now()} />}
      />
      <Grid>
        <Stat
          label="Oracle"
          value={
            <span className="flex items-center gap-2">
              <Dot tone={v.live ? "good" : "bad"} />
              {v.live ? "LIVE" : v.oracle.paused ? "PAUSED" : "STALE"}
            </span>
          }
          tone={v.live ? "good" : "bad"}
          sub={
            v.freshnessLines === null
              ? "no on-time line in the record"
              : `newest on-time line ${int(v.freshnessLines)} lines ago`
          }
        />
        <Stat
          label="Lines produced"
          value={int(ring.produced)}
          sub={`with an on-time reveal, last ${int(ringLines)} lines (≈ ${linesToDuration(ringLines)})`}
        />
        <Stat label="Requests served" value={int(v.oracle.totalFulfillments)} sub={`of ${int(v.oracle.totalRequests)} requested`} />
        <Stat
          label="Nodes online"
          value={`${v.nodesOnline} / ${v.nodesListed}`}
          tone={v.nodesOnline > 0 ? "good" : "bad"}
          sub="active in the node table and committing"
        />
      </Grid>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel title="Oracle">
          <KV
            rows={[
              ["Status", v.oracle.paused ? <Badge tone="bad">paused</Badge> : <Badge tone="good">running</Badge>],
              ["Version", `${v.oracle.layout} (OracleState ${v.oracle.length} B)`],
              [
                "Line record",
                v.lineLog
                  ? v.lineLog.defect
                    ? <Badge tone="bad">unusable: {v.lineLog.defect}</Badge>
                    : `ABI ${v.lineLog.abiMajor}.${v.lineLog.abiMinor}, ring of ${int(v.lineLog.h)} lines`
                  : "not created",
              ],
              ["Program last deployed", v.program ? `slot ${int(v.program.deploySlot)}` : "—"],
              ["Current slot / line", `${int(v.slot)} / ${int(v.currentLine)}`],
              ["Newest on-time line", v.newestLine === null ? "—" : int(v.newestLine)],
              ["Program", <Addr key="p" value={NETWORK.geroProgram} />],
            ]}
          />
        </Panel>
        <Panel
          title="Line record, last ring"
          note="Counted from LineLog entries whose stored line matches. Lines with no entry had no node activity. A line pays nodes only if at least one node was on time."
        >
          <KV
            rows={[
              ["Window", `lines ${int(ring.first)} – ${int(ring.last)}`],
              ["With an on-time reveal", int(ring.produced)],
              ["With a verified proof", int(ring.verified)],
              ["With requests", int(ring.withRequests)],
              ["Dead (no on-time reveal at batch open)", int(ring.dead)],
              ["Settled and paid by the minter (all time)", v.linesPaidSettled === null ? "minter not initialized" : int(v.linesPaidSettled)],
            ]}
          />
        </Panel>
      </div>
    </>
  );
}
