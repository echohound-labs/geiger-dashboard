import Link from "next/link";
import type { ReactNode } from "react";
import { EntropyBanner } from "@/components/network";
import { Badge, PageTitle, Panel } from "@/components/ui";
import { TESTNET } from "@/lib/config";

export const metadata = { title: "How to test" };

/** X1's documentation page for its testnet faucet. */
const FAUCET_DOCS = "https://docs.x1.xyz/validating/testnet-faucet";

const link = "text-term-green underline";

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <Panel>
      <div className="flex gap-4">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-term-green/50 font-mono text-sm text-term-green">
          {n}
        </span>
        <div className="min-w-0 space-y-2 text-[15px] leading-relaxed text-term-text">
          <h2 className="font-semibold">{title}</h2>
          {children}
        </div>
      </div>
    </Panel>
  );
}

const Code = ({ children }: { children: ReactNode }) => (
  <code className="inline-block max-w-full break-all rounded bg-term-raised px-1.5 py-0.5 font-mono text-[13px] text-term-text">{children}</code>
);

export default function HowToTestPage() {
  return (
    <>
      <PageTitle title="How to test" network="testnet" sub={`Trying GERO and ${TESTNET.symbol} on ${TESTNET.label}. Nothing here has value.`} />
      <EntropyBanner />

      <div className="grid grid-cols-1 gap-3">
        <Step n={1} title="Set your wallet to X1 testnet">
          <p className="text-term-text2">
            The Claim page connects with Backpack. In the wallet&apos;s network settings choose X1 and switch it to
            testnet, or set the RPC endpoint to <Code>{TESTNET.rpcUrl}</Code>. The page only ever sends transactions to X1
            testnet.
          </p>
        </Step>

        <Step n={2} title="Get testnet XNT">
          <p className="text-term-text2">
            Testnet XNT has no value and pays the network fees and the one-time claim-account rent. X1 documents a testnet
            faucet on its{" "}
            <a className={link} href={FAUCET_DOCS} target="_blank" rel="noreferrer">
              Testnet faucet
            </a>{" "}
            page. With the Solana CLI you can also request an airdrop from the testnet endpoint:
          </p>
          <pre className="overflow-x-auto rounded border border-term-line bg-term-raised p-3 font-mono text-[13px] text-term-text">
            solana airdrop 1 YOUR_ADDRESS --url {TESTNET.rpcUrl}
          </pre>
          <p className="text-sm text-term-text3">Browsing and looking up addresses need no XNT and no wallet.</p>
        </Step>

        <Step n={3} title="What you can do today">
          <ul className="list-inside list-disc space-y-1.5 text-term-text2">
            <li>
              <span className="text-term-text">Browse.</span> Every page under the Testnet switch reads X1 testnet live:{" "}
              <Link className={link} href="/testnet/oracle">
                Oracle status
              </Link>
              ,{" "}
              <Link className={link} href="/testnet/nodes">
                Nodes
              </Link>
              ,{" "}
              <Link className={link} href="/testnet/activity">
                Activity
              </Link>{" "}
              and{" "}
              <Link className={link} href="/testnet/entropy">
                Token &amp; supply
              </Link>{" "}
              with its live supply check.
            </li>
            <li>
              <span className="text-term-text">Look up any address.</span> On{" "}
              <Link className={link} href="/testnet/claim">
                Claim
              </Link>
              , enter a payout address to see its claim account (accrued and claimed) without connecting a wallet.
            </li>
            <li>
              <span className="text-term-text">Claim, if you run a node.</span> Connect the node&apos;s payout wallet on{" "}
              <Link className={link} href="/testnet/claim">
                Claim
              </Link>
              , open its claim account once, then claim its {TESTNET.symbol}. Every transaction is simulated and shown before
              the wallet signs.
            </li>
          </ul>
        </Step>

        <Step n={4} title="What's coming">
          <p className="text-term-text2">
            <Badge tone="muted">soon</Badge> A request-randomness demo: send a request to GERO on testnet from this site and
            watch it get fulfilled. Until then,{" "}
            <Link className={link} href="/testnet/integrations">
              Integrations
            </Link>{" "}
            describes how a program requests randomness.
          </p>
        </Step>
      </div>
    </>
  );
}
