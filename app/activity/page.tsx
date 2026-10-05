import { AutoRefresh } from "@/components/auto-refresh";
import { Addr, Badge, ErrorPanel, PageTitle, Panel, Table } from "@/components/ui";
import {
  LINE_FLAG_DEAD,
  LINE_FLAG_HAS_REQUESTS,
  LINE_FLAG_VERIFIED,
  getActivityView,
  type ActivityView,
} from "@/lib/chain";
import { NETWORK } from "@/lib/config";
import { amount, int, short, timeAgo, utc } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Activity" };

function mask(m: number): string {
  return m.toString(2).padStart(8, "0").split("").reverse().join("");
}

export default async function ActivityPage() {
  let v: ActivityView;
  try {
    v = await getActivityView();
  } catch (e) {
    return (
      <>
        <PageTitle title="Activity" />
        <ErrorPanel error={e} />
      </>
    );
  }
  const now = Date.now() / 1000;
  return (
    <>
      <PageTitle title="Activity" sub="Recent lines, fulfilled requests and claims." right={<AutoRefresh renderedAt={Date.now()} />} />
      <div className="grid grid-cols-1 gap-3">
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

        <Panel title={`Fulfilled requests · ${int(v.totalFulfillments)} total`}>
          <Table
            head={["Fulfilled", "Line", "Request", "Requester"]}
            rows={v.fulfillments.map((f) => [
              <span key="t" title={utc(f.fulfilledAt)}>
                {timeAgo(f.fulfilledAt, now)}
              </span>,
              int(f.line),
              <span key="r" title={f.address}>{short(f.address, 6)}</span>,
              <span key="q" title={f.requester}>{short(f.requester, 6)}</span>,
            ])}
            empty="No fulfilled requests."
          />
        </Panel>

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
            head={["Payee", `Claimed (${NETWORK.symbol})`, "Claimable"]}
            rows={[
              ...v.claimTotals.map((c) => [<Addr key="p" value={c.payee} />, amount(c.totalClaimed), amount(c.accrued)]),
              ...(v.ecoClaimed !== null ? [["ecosystem vault", amount(v.ecoClaimed), "—"]] : []),
            ]}
            empty="No claim accounts."
          />
        </Panel>
      </div>
    </>
  );
}
