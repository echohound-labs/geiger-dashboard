import { AutoRefresh } from "@/components/auto-refresh";
import { ErrorPanel, PageTitle, Panel, Table } from "@/components/ui";
import { mainnetTx } from "@/lib/config";
import { short, timeAgo, utc, xnt } from "@/lib/format";
import { getMainnetFeed, type MainnetFeed } from "@/lib/mainnet";

const FEED = 50;

// Reads the node operator's transaction feed only.
export async function MainnetActivity() {
  let feed: MainnetFeed;
  try {
    feed = await getMainnetFeed(FEED);
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
      <PageTitle
        title="Activity"
        network="mainnet"
        sub="The node operator's recent transactions on X1 mainnet. Pending requests are on Oracle status."
        right={<AutoRefresh renderedAt={Date.now()} />}
      />
      <Panel
        title={`Recent transactions · newest ${feed.txs.length}`}
        note="Labelled from the program logs. A cycle is one reveal + commit and one finalize."
      >
        <Table
          head={["Time", "Instruction", "Fee", "Signature"]}
          rows={feed.txs.map((t) => [
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
      </Panel>
    </>
  );
}
