import { AutoRefresh } from "@/components/auto-refresh";
import { BecomeOperator, NodeCard } from "@/components/node-card";
import { Addr, Badge, ErrorPanel, PageTitle, Panel, type Tone } from "@/components/ui";
import { MAINNET_ORACLE, mainnetAddress } from "@/lib/config";
import { int, timeAgo, utc } from "@/lib/format";
import { LEGACY_AFTER_S, ONLINE_THRESHOLD_S, getMainnetNodes, type MainnetNode } from "@/lib/mainnet";

function status(n: MainnetNode): { tone: Tone; text: string } {
  if (n.legacy) return { tone: "muted", text: "legacy" };
  if (n.online && n.active) return { tone: "good", text: "active" };
  return { tone: "bad", text: "offline" };
}

// Reads the EntropyNode accounts only.
export async function MainnetNodes() {
  let nodes: MainnetNode[];
  try {
    nodes = await getMainnetNodes();
  } catch (e) {
    return (
      <>
        <PageTitle title="Nodes" network="mainnet" />
        <ErrorPanel error={e} />
      </>
    );
  }
  const now = Date.now() / 1000;
  const sorted = [...nodes].sort((a, b) => Number(a.legacy) - Number(b.legacy));
  return (
    <>
      <PageTitle
        title="Nodes"
        network="mainnet"
        sub={`Registered GERO ${MAINNET_ORACLE.version} nodes on X1 mainnet.`}
        right={<AutoRefresh renderedAt={Date.now()} />}
      />
      <div className="grid grid-cols-1 gap-3">
        {sorted.length === 0 && <Panel>No registered nodes found.</Panel>}
        {sorted.map((n) => {
          const s = status(n);
          return (
            <NodeCard
              key={n.address}
              legacy={n.legacy}
              name={n.name || "Unnamed node"}
              sub={
                <a className="underline decoration-term-line" href={mainnetAddress(n.address)} target="_blank" rel="noreferrer">
                  <Addr value={n.address} />
                </a>
              }
              badges={
                <>
                  <Badge tone={s.tone}>{s.text}</Badge>
                  {n.approved ? <Badge tone="good">approved</Badge> : <Badge tone="muted">not approved</Badge>}
                </>
              }
              left={[
                ["Submissions", int(n.submissions)],
                [
                  "Last submission",
                  <span key="l" title={utc(n.lastSubmission)}>
                    {n.lastSubmission ? timeAgo(n.lastSubmission, now) : "never"}
                  </span>,
                ],
                ["Reputation", `${n.reputation}/100`],
              ]}
              right={[
                ["Operator", <Addr key="o" value={n.operator} />],
                ["Registered", n.registeredAt ? <span key="r" title={utc(n.registeredAt)}>{utc(n.registeredAt).slice(0, 10)}</span> : "—"],
                ["Active flag", n.active ? "yes" : "no"],
              ]}
            />
          );
        })}
        <BecomeOperator />
      </div>
      <p className="mt-4 text-xs leading-relaxed text-term-text3">
        <span className="text-term-text2">Active</span> = active flag set and a submission within the last{" "}
        {ONLINE_THRESHOLD_S / 60} min; <span className="text-term-text2">offline</span> otherwise;{" "}
        <span className="text-term-text2">legacy</span> = not approved and not seen for {LEGACY_AFTER_S / 86400}+ days.
        GERO {MAINNET_ORACLE.version} has no shadow period, line record or ENTROPY payouts.
      </p>
    </>
  );
}
