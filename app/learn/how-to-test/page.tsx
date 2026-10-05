import Link from "next/link";
import { PageTitle, Panel } from "@/components/ui";
import { TESTNET } from "@/lib/config";

export const metadata = { title: "How to test" };

export default function HowToTestPage() {
  return (
    <>
      <PageTitle title="How to test" network="testnet" sub={`Trying GERO v9.1b and ${TESTNET.symbol} on ${TESTNET.label}.`} />
      <Panel note="Placeholder. A step-by-step testing guide will be added here.">
        <ul className="list-inside list-disc space-y-1.5 text-[15px] text-term-text">
          <li>
            <Link className="text-term-green underline" href="/testnet/nodes">
              Nodes
            </Link>{" "}
            shows every node in GERO&apos;s table on testnet.
          </li>
          <li>
            <Link className="text-term-green underline" href="/testnet/claim">
              Claim
            </Link>{" "}
            opens a claim account for a payout wallet and claims {TESTNET.symbol}, a test token with no value.
          </li>
          <li>
            <Link className="text-term-green underline" href="/learn/how-it-works">
              How it works
            </Link>{" "}
            explains lines, nodes and ENTROPY at the level of the white paper.
          </li>
        </ul>
      </Panel>
    </>
  );
}
