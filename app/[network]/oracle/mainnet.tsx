import { AutoRefresh } from "@/components/auto-refresh";
import { RequestTable } from "@/components/requests";
import { Addr, Badge, Details, Dot, ErrorPanel, Grid, KV, PageTitle, Panel, Stat, SubHead, type Tone } from "@/components/ui";
import { MAINNET_ORACLE, mainnetAddress } from "@/lib/config";
import { int } from "@/lib/format";
import {
  CANCEL_WINDOW_SLOTS,
  freshnessOf,
  getMainnetFeed,
  getMainnetOracle,
  getMainnetPool,
  getMainnetRequests,
  type Freshness,
} from "@/lib/mainnet";

const freshTone: Record<Freshness, Tone> = { fresh: "good", warning: "warn", stale: "bad", unknown: "muted" };

function minutes(s: number): string {
  return s < 600 ? `${(s / 60).toFixed(1)} min` : `${Math.round(s / 60)} min`;
}

const soft = <T,>(p: Promise<T>) => p.catch(() => null);

// OracleState, the entropy pool, open requests and the operator feed (for freshness); nothing else.
async function load() {
  const [o, pool, req, feed] = await Promise.all([getMainnetOracle(), soft(getMainnetPool()), soft(getMainnetRequests()), soft(getMainnetFeed())]);
  return { o, pool, req, feed };
}

export async function MainnetOracle() {
  let v: Awaited<ReturnType<typeof load>>;
  try {
    v = await load();
  } catch (e) {
    return (
      <>
        <PageTitle title="Oracle status" network="mainnet" />
        <ErrorPanel error={e} />
      </>
    );
  }
  const { o, pool, req, feed } = v;
  const f = freshnessOf(o, feed?.lastFinalize ?? null);
  const live = !o.paused && (f.freshness === "fresh" || f.freshness === "warning");
  const pending = req?.pending ?? [];
  const expired = req?.expired ?? [];
  return (
    <>
      <PageTitle
        title="Oracle status"
        network="mainnet"
        sub={`GERO ${MAINNET_ORACLE.version}, the live randomness oracle on X1 mainnet.`}
        right={<AutoRefresh renderedAt={Date.now()} />}
      />
      <Grid>
        <Stat
          label="Live"
          value={
            <span className="flex items-center gap-2">
              <Dot tone={o.paused ? "bad" : live ? "good" : freshTone[f.freshness]} />
              {o.paused ? "PAUSED" : live ? "LIVE" : f.freshness === "unknown" ? "UNKNOWN" : "STALE"}
            </span>
          }
          tone={o.paused ? "bad" : live ? "good" : freshTone[f.freshness]}
          sub={o.paused ? "the oracle is paused" : "running, entropy pool within its age bound"}
        />
        <Stat
          label="Freshness"
          value={f.freshnessAgeS === null ? "—" : minutes(f.freshnessAgeS)}
          tone={freshTone[f.freshness]}
          sub={f.freshnessAgeS === null ? "no recent finalize found" : `since the last finalize · bound ${minutes(f.poolAgeBoundS)}`}
        />
        <Stat label="Requests" value={int(o.totalRequests)} sub="total requested" />
        <Stat label="Fulfilled" value={int(o.totalFulfillments)} sub="total fulfilled" />
      </Grid>

      {pending.length > 0 && (
        <Panel
          className="mt-3"
          title={`Pending requests · ${pending.length}`}
          note={`A request can be fulfilled until ${CANCEL_WINDOW_SLOTS} slots after it was made; after that it can only be cancelled.`}
        >
          <RequestTable requests={pending} href={mainnetAddress} slot={req?.slot} window={CANCEL_WINDOW_SLOTS} />
        </Panel>
      )}

      <Details className="mt-3">
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-2">
          <div>
            <SubHead>Oracle</SubHead>
            <KV
              rows={[
                ["Status", o.paused ? <Badge tone="bad">paused</Badge> : <Badge tone="good">running</Badge>],
                ["Version", `${MAINNET_ORACLE.version} (OracleState ${o.length} B)`],
                [
                  "Program",
                  <a key="p" className="underline decoration-term-line" href={mainnetAddress(MAINNET_ORACLE.program)} target="_blank" rel="noreferrer">
                    <Addr value={MAINNET_ORACLE.program} />
                  </a>,
                ],
                ["Registered nodes (OracleState)", int(o.totalNodes)],
                ["Pool-age bound", `${int(o.maxPoolAgeSlots)} slots (≈ ${minutes(f.poolAgeBoundS)})`],
                ["Current slot", req?.slot == null ? "—" : int(req.slot)],
              ]}
            />
            <p className="mt-2 text-xs leading-relaxed text-term-text3">
              Fulfilment is refused once the entropy pool is older than the bound. Freshness is the time since the
              operator&apos;s newest finalize: warning past half the bound, stale past it.
            </p>
          </div>
          <div>
            <SubHead>Entropy pool</SubHead>
            {pool ? (
              <>
                <KV
                  rows={[
                    ["Seeds filled", `${pool.filled} / 32`],
                    ["Head (next write slot)", `${pool.head % 32}`],
                    ["Total submissions", int(pool.totalSubmissions)],
                  ]}
                />
                <SubHead>Newest seed hashes (first 16 bytes)</SubHead>
                <ul className="space-y-0.5 break-all font-mono text-xs">
                  {pool.recent.map((r, k) => (
                    <li key={r.index} className={k === 0 ? "text-term-green" : "text-term-text3"}>
                      [{String(r.index).padStart(2, "0")}] {r.hex ? `${r.hex}…` : "(empty)"} {k === 0 ? "← latest" : ""}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="font-mono text-sm text-term-text3">Entropy pool unavailable.</p>
            )}
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
              <RequestTable requests={expired} href={mainnetAddress} />
            </>
          )}
        </div>
      </Details>
    </>
  );
}
