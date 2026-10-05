import { AutoRefresh } from "@/components/auto-refresh";
import { RequestTable } from "@/components/requests";
import { Addr, Badge, Details, Dot, ErrorPanel, Grid, KV, PageTitle, Panel, Stat, SubHead } from "@/components/ui";
import { CANCEL_WINDOW_SLOTS, getNetworkView, getOpenRequests } from "@/lib/chain";
import { NETWORK, explorerAddress } from "@/lib/config";
import { int, linesToDuration } from "@/lib/format";

async function load() {
  const v = await getNetworkView();
  const req = await getOpenRequests(v.slot).catch(() => null);
  return { v, req };
}

export async function TestnetOracle() {
  let data: Awaited<ReturnType<typeof load>>;
  try {
    data = await load();
  } catch (e) {
    return (
      <>
        <PageTitle title="Oracle status" network="testnet" />
        <ErrorPanel error={e} />
      </>
    );
  }
  const { v, req } = data;
  const ring = v.ringWindow;
  const ringLines = Number(ring.last - ring.first + 1n);
  const pending = req?.pending ?? [];
  const expired = req?.expired ?? [];
  const href = (a: string) => explorerAddress(a);
  return (
    <>
      <PageTitle
        network="testnet"
        title="Oracle status"
        sub={`GERO ${NETWORK.geroVersion}, the next version, in testing on X1 testnet.`}
        right={<AutoRefresh renderedAt={Date.now()} />}
      />
      <Grid>
        <Stat
          label="Live"
          value={
            <span className="flex items-center gap-2">
              <Dot tone={v.live ? "good" : "bad"} />
              {v.live ? "LIVE" : v.oracle.paused ? "PAUSED" : "STALE"}
            </span>
          }
          tone={v.live ? "good" : "bad"}
          sub={`${v.nodesOnline} of ${v.nodesListed} nodes online`}
        />
        <Stat
          label="Freshness"
          value={v.freshnessLines === null ? "—" : `${int(v.freshnessLines)} lines`}
          tone={v.live ? "good" : "bad"}
          sub={
            v.freshnessLines === null
              ? "no on-time line in the record"
              : `since the newest on-time line (≈ ${linesToDuration(v.freshnessLines)})`
          }
        />
        <Stat label="Requests" value={int(v.oracle.totalRequests)} sub="total requested" />
        <Stat label="Fulfilled" value={int(v.oracle.totalFulfillments)} sub="total fulfilled" />
      </Grid>

      {pending.length > 0 && (
        <Panel
          className="mt-3"
          title={`Pending requests · ${pending.length}`}
          note={`A request can be fulfilled until ${CANCEL_WINDOW_SLOTS} slots after it was made; after that it can only be cancelled.`}
        >
          <RequestTable requests={pending} href={href} slot={v.slot} window={CANCEL_WINDOW_SLOTS} />
        </Panel>
      )}

      <Details className="mt-3">
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-2">
          <div>
            <SubHead>Oracle</SubHead>
            <KV
              rows={[
                ["Status", v.oracle.paused ? <Badge tone="bad">paused</Badge> : <Badge tone="good">running</Badge>],
                ["Version", v.oracle.layout.startsWith("unknown") ? `OracleState ${v.oracle.length} B` : `${v.oracle.layout} (OracleState ${v.oracle.length} B)`],
                ["Program", <a key="p" className="underline decoration-term-line" href={href(NETWORK.geroProgram)} target="_blank" rel="noreferrer"><Addr value={NETWORK.geroProgram} /></a>],
                ["Program last deployed", v.program ? `slot ${int(v.program.deploySlot)}` : "—"],
                ["Current slot / line", `${int(v.slot)} / ${int(v.currentLine)}`],
                ["Newest on-time line", v.newestLine === null ? "—" : int(v.newestLine)],
              ]}
            />
          </div>
          <div>
            <SubHead>Line record</SubHead>
            <KV
              rows={[
                [
                  "Record",
                  v.lineLog
                    ? v.lineLog.defect
                      ? <Badge key="d" tone="bad">unusable: {v.lineLog.defect}</Badge>
                      : `ABI ${v.lineLog.abiMajor}.${v.lineLog.abiMinor}, ring of ${int(v.lineLog.h)} lines`
                    : "not created",
                ],
                ["Window", `lines ${int(ring.first)} – ${int(ring.last)} (≈ ${linesToDuration(ringLines)})`],
                ["With an on-time reveal", int(ring.produced)],
                ["With a verified proof", int(ring.verified)],
                ["With requests", int(ring.withRequests)],
                ["Dead (no on-time reveal at batch open)", int(ring.dead)],
                ["Settled and paid by the minter (all time)", v.linesPaidSettled === null ? "minter not initialized" : int(v.linesPaidSettled)],
              ]}
            />
            <p className="mt-2 text-xs leading-relaxed text-term-text3">
              Counted from line-record entries whose stored line matches. A line pays nodes only if at least one node was on time.
            </p>
          </div>
        </div>
        <div>
          <SubHead>Expired requests (cancel-only) · {req ? expired.length : "?"}</SubHead>
          {req === null ? (
            <p className="font-mono text-sm text-term-text3">Request accounts unavailable.</p>
          ) : expired.length === 0 ? (
            <p className="font-mono text-sm text-term-text3">None.</p>
          ) : (
            <>
              <p className="mb-2 text-xs text-term-text3">
                Open requests past the {CANCEL_WINDOW_SLOTS}-slot fulfil window. They can no longer be fulfilled; the
                requester can cancel them.
              </p>
              <RequestTable requests={expired} href={href} />
            </>
          )}
        </div>
      </Details>
    </>
  );
}
