import { AutoRefresh } from "@/components/auto-refresh";
import { Addr, ErrorPanel, PageTitle, Panel, Table } from "@/components/ui";
import { mainnetAddress, mainnetTx } from "@/lib/config";
import { int, short, timeAgo, utc, xnt } from "@/lib/format";
import { CANCEL_WINDOW_SLOTS, getMainnetFeed, getMainnetRequests } from "@/lib/mainnet";

export async function MainnetActivity() {
  let v;
  try {
    const [req, feed] = await Promise.all([getMainnetRequests().catch(() => null), getMainnetFeed()]);
    v = { pending: req?.pending ?? null, expired: req?.expired ?? [], txs: feed.txs };
  } catch (e) {
    return (
      <>
        <PageTitle title="Activity" network="mainnet" />
        <ErrorPanel error={e} />
      </>
    );
  }
  const now = Date.now() / 1000;
  return (
    <>
      <PageTitle title="Activity" network="mainnet" sub="Pending requests and the node operator's recent transactions on X1 mainnet." right={<AutoRefresh renderedAt={Date.now()} />} />
      <div className="grid grid-cols-1 gap-3">
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
