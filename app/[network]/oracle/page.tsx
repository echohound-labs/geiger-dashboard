import { AutoRefresh } from "@/components/auto-refresh";
import { RequestTable } from "@/components/requests";
import { Addr, Badge, Details, Dot, ErrorPanel, Grid, KV, PageTitle, Panel, Stat, SubHead, type Tone } from "@/components/ui";
import { CANCEL_WINDOW_SLOTS, TYPICAL_FULFIL_SLOTS, getNetworkView, getOpenRequests, type NetworkView, type OpenRequests } from "@/lib/chain";
import { explorerAddress, networkConfig, type NetworkConfig } from "@/lib/config";
import { int, linesToDuration, slotsToDuration, xnt } from "@/lib/format";
import { netMetadata, netParam, type NetParams, type NetSlug } from "@/lib/networks";

export const dynamic = "force-dynamic";
export const generateMetadata = netMetadata("Oracle status");

// OracleState, the program, the fee pool, the newest fulfilled requests, open requests and, where one exists, the
// line record; nothing else.
async function load(cfg: NetworkConfig) {
  const v = await getNetworkView(cfg);
  const req = await getOpenRequests(v.slot, cfg).catch(() => null);
  return { v, req };
}

function freshness(v: NetworkView): { value: string; sub: string; tone: Tone } {
  if (v.lineLog) {
    return v.freshnessLines === null
      ? { value: "—", sub: "no on-time line in the record", tone: "bad" }
      : { value: `${int(v.freshnessLines)} lines`, sub: `since the newest on-time line (≈ ${linesToDuration(v.freshnessLines)})`, tone: v.live ? "good" : "bad" };
  }
  // No line record: the node table's commit position. Nodes commit a few lines ahead, so the lead is ≥ 0 when up.
  if (v.commitLead === null) return { value: "—", sub: "no active node in the table", tone: "bad" };
  const ahead = v.commitLead >= 0n;
  return {
    value: ahead ? `${int(v.commitLead)} lines ahead` : `${int(-v.commitLead)} lines behind`,
    sub: "newest committed line against the current line (no line record on mainnet yet)",
    tone: ahead ? "good" : "bad",
  };
}

function Requests({ req, net, slot }: { req: OpenRequests | null; net: NetSlug; slot: number }) {
  const cfg = networkConfig(net);
  const href = (a: string) => explorerAddress(a, cfg);
  if (!req) return <p className="font-mono text-sm text-term-text3">Request accounts unavailable.</p>;
  const total = req.recent.length + req.late.length + req.legacy.length;
  if (total === 0) return <p className="font-mono text-sm text-term-text3">No open requests.</p>;
  return (
    <div className="space-y-4">
      {req.recent.length > 0 && (
        <div>
          <SubHead>Being served · {req.recent.length}</SubHead>
          <p className="mb-2 text-xs text-term-text3">
            Inside the first {CANCEL_WINDOW_SLOTS} slots. A request is normally fulfilled {TYPICAL_FULFIL_SLOTS.min}–{TYPICAL_FULFIL_SLOTS.max} slots
            (≈ {slotsToDuration(TYPICAL_FULFIL_SLOTS.max)}) after it was made, once its line&apos;s VDF proof has been checked on chain.
          </p>
          <RequestTable requests={req.recent} href={href} slot={slot} />
        </div>
      )}
      {req.late.length > 0 && (
        <div>
          <SubHead>Older than {CANCEL_WINDOW_SLOTS} slots · {req.late.length}</SubHead>
          <p className="mb-2 text-xs text-term-text3">
            Still served, late, while the batch of their line can be served. The requester can cancel one for a refund only once it
            demonstrably cannot be served (its batch never opened, is dead with no rollover, or does not cover its node mask).
          </p>
          <RequestTable requests={req.late} href={href} slot={slot} />
        </div>
      )}
      {req.legacy.length > 0 && (
        <div>
          <SubHead>Pre-v9 requests · {req.legacy.length}</SubHead>
          <p className="mb-2 text-xs text-term-text3">
            Made before the v9 upgrade (no line binding). v9 can never serve them; the requester can cancel each one for its refund.
          </p>
          <RequestTable requests={req.legacy} href={href} slot={slot} />
        </div>
      )}
    </div>
  );
}

export default async function Page(p: NetParams) {
  const net = netParam(p);
  const cfg = networkConfig(net);
  let data: Awaited<ReturnType<typeof load>>;
  try {
    data = await load(cfg);
  } catch (e) {
    return (
      <>
        <PageTitle title="Oracle status" network={net} />
        <ErrorPanel error={e} />
      </>
    );
  }
  const { v, req } = data;
  const ring = v.ringWindow;
  const ringLines = Number(ring.last - ring.first + 1n);
  const href = (a: string) => explorerAddress(a, cfg);
  const fresh = freshness(v);
  const openCount = req ? req.recent.length + req.late.length + req.legacy.length : null;
  const link = (addr: string) => (
    <a key={addr} className="underline decoration-term-line" href={href(addr)} target="_blank" rel="noreferrer">
      <Addr value={addr} />
    </a>
  );
  return (
    <>
      <PageTitle
        network={net}
        title="Oracle status"
        sub={
          net === "mainnet"
            ? `GERO ${cfg.geroVersion}, the live randomness oracle on X1 mainnet: one operator, one node.`
            : `GERO ${cfg.geroVersion} on X1 testnet, with the line record and ${cfg.symbol}.`
        }
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
        <Stat label="Freshness" value={fresh.value} tone={fresh.tone} sub={fresh.sub} />
        <Stat label="Requests" value={int(v.oracle.totalRequests)} sub="total requested" />
        <Stat label="Fulfilled" value={int(v.oracle.totalFulfillments)} sub="total fulfilled" />
      </Grid>
      <div className="mt-3">
        <Grid cols={3}>
          <Stat label="Request fee" value={xnt(v.oracle.requestFeeLamports)} sub={v.oracle.feeSetOnChain ? "per request, set on chain" : "per request (program default)"} />
          <Stat
            label="Fee pool (held by the program)"
            value={v.feePool ? xnt(v.feePool.heldLamports + v.oracle.unsweptFeeLamports) : "—"}
            sub={
              v.feePool
                ? v.oracle.unsweptFeeLamports > 0n
                  ? `${xnt(v.feePool.heldLamports)} in the pool + ${xnt(v.oracle.unsweptFeeLamports)} collected in OracleState, not yet swept · nothing can be withdrawn yet`
                  : "nothing can be withdrawn yet; node-operator payout comes in a later version"
                : "fee pool not created yet"
            }
          />
          <Stat
            label="Fulfilment time"
            value={v.fulfilSeconds ? `≈ ${Math.round(v.fulfilSeconds.median)} s` : "—"}
            sub={
              v.fulfilSeconds
                ? `median of the last ${v.fulfilSeconds.sample} fulfilled requests; typically ${TYPICAL_FULFIL_SLOTS.min}–${TYPICAL_FULFIL_SLOTS.max} slots`
                : "no fulfilled request yet"
            }
          />
        </Grid>
      </div>

      <Panel className="mt-3" title={`Open requests${openCount === null ? "" : ` · ${openCount}`}`}>
        <Requests req={req} net={net} slot={v.slot} />
      </Panel>

      <Details className="mt-3">
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-2">
          <div>
            <SubHead>Oracle</SubHead>
            <KV
              rows={[
                ["Status", v.oracle.paused ? <Badge tone="bad">paused</Badge> : <Badge tone="good">running</Badge>],
                [
                  "Version",
                  `GERO ${cfg.geroVersion}${cfg.geroBuild ? `, build ${cfg.geroBuild}` : ""} (OracleState ${v.oracle.length} B${v.oracle.layout.startsWith("unknown") ? ", unknown layout" : ""})`,
                ],
                ["Program", link(cfg.geroProgram)],
                ["Verifier program", link(v.oracle.verifierProgram)],
                ["Fee pool", v.feePool ? link(v.feePool.address) : "not created"],
                ["Fees swept into the pool (all time)", v.feePool ? xnt(v.feePool.collectedLamports) : "—"],
                ["Program last deployed", v.program ? `slot ${int(v.program.deploySlot)}` : "—"],
                ["Current slot / line", `${int(v.slot)} / ${int(v.currentLine)}`],
                ["Newest on-time line", v.lineLog ? (v.newestLine === null ? "—" : int(v.newestLine)) : "no line record"],
                ["Node stake / slash per missed line", `${xnt(v.oracle.nodeStakeLamports)} / ${xnt(v.oracle.revealSlashLamports)}`],
              ]}
            />
            <p className="mt-2 text-xs leading-relaxed text-term-text3">
              Every request is served with a VDF proof checked on chain by the verifier program. The request fee is charged into
              OracleState and swept into the fee pool by the authority; nothing is paid out of the pool yet.
            </p>
          </div>
          <div>
            <SubHead>Line record</SubHead>
            {v.lineLog ? (
              <>
                <KV
                  rows={[
                    [
                      "Record",
                      v.lineLog.defect ? (
                        <Badge key="d" tone="bad">
                          unusable: {v.lineLog.defect}
                        </Badge>
                      ) : (
                        `ABI ${v.lineLog.abiMajor}.${v.lineLog.abiMinor}, ring of ${int(v.lineLog.h)} lines`
                      ),
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
              </>
            ) : (
              <p className="text-sm text-term-text2">
                Not on {net} yet. The line record (which nodes were on time, per line) and ENTROPY come to mainnet in a later
                version; until then the figures above come from OracleState, the node table and the request accounts.
              </p>
            )}
          </div>
        </div>
      </Details>
    </>
  );
}
