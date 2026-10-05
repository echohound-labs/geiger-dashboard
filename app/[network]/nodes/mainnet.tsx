import { AutoRefresh } from "@/components/auto-refresh";
import { ErrorPanel, PageTitle, Panel, Table } from "@/components/ui";
import { mainnetAddress } from "@/lib/config";
import { int, short, timeAgo, utc } from "@/lib/format";
import { ONLINE_THRESHOLD_S, getMainnetView, type MainnetView } from "@/lib/mainnet";

export async function MainnetNodes() {
  let v: MainnetView;
  try {
    v = await getMainnetView();
  } catch (e) {
    return (
      <>
        <PageTitle title="Nodes" network="mainnet" />
        <ErrorPanel error={e} />
      </>
    );
  }
  const now = Date.now() / 1000;
  return (
    <>
      <PageTitle title="Nodes" network="mainnet" sub="Registered GERO v8.1 nodes on X1 mainnet, read from their EntropyNode accounts." right={<AutoRefresh renderedAt={Date.now()} />} />
      <div className="grid grid-cols-1 gap-3">
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
      </div>
    </>
  );
}
