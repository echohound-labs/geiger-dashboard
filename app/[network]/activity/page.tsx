import { AutoRefresh } from "@/components/auto-refresh";
import { Addr, Badge, ErrorPanel, PageTitle, Panel, Table } from "@/components/ui";
import {
  LINE_FLAG_DEAD,
  LINE_FLAG_HAS_REQUESTS,
  LINE_FLAG_VERIFIED,
  getActivityView,
  type ActivityView,
} from "@/lib/chain";
import { explorerAddress, networkConfig } from "@/lib/config";
import { amount, int, short, timeAgo, utc } from "@/lib/format";
import { netMetadata, netParam, type NetParams } from "@/lib/networks";

export const dynamic = "force-dynamic";
export const generateMetadata = netMetadata("Activity");

function mask(m: number): string {
  return m.toString(2).padStart(8, "0").split("").reverse().join("");
}

export default async function Page(p: NetParams) {
  const net = netParam(p);
  const cfg = networkConfig(net);
  let v: ActivityView;
  try {
    v = await getActivityView(32, cfg);
  } catch (e) {
    return (
      <>
        <PageTitle title="Activity" network={net} />
        <ErrorPanel error={e} />
      </>
    );
  }
  const now = Date.now() / 1000;
  return (
    <>
      <PageTitle
        title="Activity"
        network={net}
        sub={
          v.hasEntropy
            ? `Recent lines, fulfilled requests and claims on ${cfg.label}. Open requests are on Oracle status.`
            : `Open line batches and fulfilled requests on ${cfg.label}. Open requests are on Oracle status.`
        }
        right={<AutoRefresh renderedAt={Date.now()} />}
      />
      <div className="grid grid-cols-1 gap-3">
        {v.lines ? (
          <Panel
            title="Recent lines"
            note="On-time bits are listed slot 0 → 7. The newest lines may not have their reveals yet; an entry can still change until the line is 32 lines old."
          >
            <Table
              head={["Line", "On time (slot 0→7)", "Flags", "Prover"]}
              rows={v.lines.map((l) =>
                "missing" in l
                  ? [int(l.line), <span key="m" className="text-term-text3">no entry</span>, "", ""]
                  : [
                      int(l.line),
                      <span key="o" className={l.onTimeMask ? "text-term-green" : "text-term-text3"}>
                        {mask(l.onTimeMask)}
                      </span>,
                      <span key="f" className="flex gap-1">
                        {l.flags & LINE_FLAG_VERIFIED ? <Badge tone="good">verified</Badge> : null}
                        {l.flags & LINE_FLAG_HAS_REQUESTS ? <Badge>requests</Badge> : null}
                        {l.flags & LINE_FLAG_DEAD ? <Badge tone="bad">dead</Badge> : null}
                      </span>,
                      l.prover ? <Addr key="p" value={l.prover} /> : <span key="p" className="text-term-text3">—</span>,
                    ],
              )}
            />
          </Panel>
        ) : (
          <Panel title="Recent lines">
            <p className="text-sm text-term-text2">
              The line record is not on {net} yet. Until it is, the open line batches below are the per-line view: a batch is
              opened for every line that has requests and stays open about a day.
            </p>
          </Panel>
        )}

        <Panel
          title={`Open line batches · ${v.batches.length}`}
          note="One batch per line with requests: the node mask it was opened with, the nodes whose reveals were used (slot 0 → 7), and whether the line is dead (no on-time reveal). Closed about a day after the line."
        >
          <Table
            head={["Line", "Bound slot", "Mask (slot 0→7)", "Used", "Slashed", "Dead"]}
            rows={v.batches.map((b) => [
              int(b.line),
              int(b.boundSlot),
              <span key="m" className="text-term-text">{mask(b.mask)}</span>,
              <span key="u" className={b.usedMask ? "text-term-green" : "text-term-text3"}>{mask(b.usedMask)}</span>,
              <span key="s" className={b.slashedMask ? "text-term-red" : "text-term-text3"}>{mask(b.slashedMask)}</span>,
              b.dead ? <Badge key="d" tone="bad">dead</Badge> : <span key="d" className="text-term-text3">—</span>,
            ])}
            empty="No open line batches."
          />
        </Panel>

        <Panel title={`Fulfilled requests · ${int(v.totalFulfillments)} total`} note="The newest 50 fulfilled request accounts under the GERO program.">
          <Table
            head={["Fulfilled", "Took", "Line", "Request", "Requester"]}
            rows={v.fulfillments.map((f) => [
              <span key="t" title={utc(f.fulfilledAt)}>
                {timeAgo(f.fulfilledAt, now)}
              </span>,
              f.requestedAt > 0 && f.fulfilledAt >= f.requestedAt ? `${f.fulfilledAt - f.requestedAt} s` : "—",
              int(f.line),
              <a key="r" className="underline decoration-term-line" href={explorerAddress(f.address, cfg)} target="_blank" rel="noreferrer" title={f.address}>
                {short(f.address, 6)}
              </a>,
              <span key="q" title={f.requester}>{short(f.requester, 6)}</span>,
            ])}
            empty="No fulfilled requests."
          />
        </Panel>

        {v.hasEntropy ? (
          <Panel
            title="Claims"
            note={
              v.historyFromSlot !== null
                ? `Claim transactions are read from RPC history, which this endpoint keeps from slot ${int(v.historyFromSlot)} (current ${int(v.slot)}). Older claims show only in the totals.`
                : undefined
            }
          >
            <Table
              head={["Slot", "Kind", "Amount", "To"]}
              rows={v.claims.map((c) => [
                int(c.slot),
                c.kind === "Claimed" ? "claim" : "ecosystem",
                amount(c.amount),
                <span key="d" title={c.destination}>{short(c.destination, 6)}</span>,
              ])}
              empty="No claim transactions in the RPC's history window."
            />
            <h3 className="mb-2 mt-5 font-mono text-xs uppercase tracking-[0.14em] text-term-text2">Claimed to date</h3>
            <Table
              head={["Payee", `Claimed (${cfg.symbol})`, "Claimable"]}
              rows={[
                ...v.claimTotals.map((c) => [<Addr key="p" value={c.payee} />, amount(c.totalClaimed), amount(c.accrued)]),
                ...(v.ecoClaimed !== null ? [["ecosystem vault", amount(v.ecoClaimed), "—"]] : []),
              ]}
              empty="No claim accounts."
            />
          </Panel>
        ) : (
          <Panel title="Claims">
            <p className="text-sm text-term-text2">ENTROPY is not on {net} yet, so there are no claims.</p>
          </Panel>
        )}
      </div>
    </>
  );
}
