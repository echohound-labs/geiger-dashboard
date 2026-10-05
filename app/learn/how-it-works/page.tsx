import Link from "next/link";
import type { ReactNode } from "react";
import { EntropyBanner } from "@/components/network";
import { PageTitle, Panel, Table } from "@/components/ui";
import { MAINNET_ORACLE, TESTNET, WHITE_PAPER_URL } from "@/lib/config";

export const metadata = { title: "How it works" };

// Content ceiling: ENTROPY_WHITEPAPER_v0.1.md (the public paper). Nothing here goes beyond what it states; figures are
// copied from it.

const link = "text-term-green underline";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="mb-3 font-mono text-xl tracking-wide text-term-green">{title}</h2>
      <div className="grid grid-cols-1 gap-3 text-[15px] leading-relaxed text-term-text">{children}</div>
    </section>
  );
}

const P = ({ children }: { children: ReactNode }) => <p className="mt-3 first:mt-0">{children}</p>;

export default function HowItWorksPage() {
  return (
    <>
      <PageTitle title="How it works" network="both" sub="GERO, ENTROPY and the node operators, at the level of the white paper (v0.1, draft)." />

      <EntropyBanner />

      <nav aria-label="On this page" className="mb-6 flex flex-wrap gap-2 font-mono text-sm">
        {[
          ["#gero", "GERO"],
          ["#entropy", "ENTROPY"],
          ["#nodes", "Nodes"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="rounded border border-term-lineStrong px-3 py-1 text-term-text2 hover:text-term-text">
            {label}
          </a>
        ))}
      </nav>

      <div className="space-y-10">
        <Section id="gero" title="GERO">
          <Panel title="The oracle">
            <P>
              GERO is a randomness oracle on X1 whose entropy comes from physical radioactive decay measured by Geiger
              counters run by independent node operators. Every 8 slots it produces one <em>line</em>: one random result,
              verified on-chain, that consumers such as Forge Launch use for NFT mints.
            </P>
          </Panel>
          <Panel title="Lines">
            <P>
              For every line each node commits to a hidden seed ahead of time and reveals it in a short window after the
              line&apos;s bound slot; a reveal inside the window is <em>on time</em>. The seeds are combined into the
              line&apos;s result, which a <em>prover</em> proves and a separate on-chain verifier checks. A line with no
              reveal at all is <em>dead</em>.
            </P>
            <P>
              GERO writes one on-chain record per line, in a ring of 32,768 lines (about 26.8 hours): which nodes were on
              time, whether the line had requests, and whether a proof was verified and by which prover. Its header names
              each node&apos;s payout address.
            </P>
          </Panel>
          <Panel title="Two networks">
            <P>
              <span className="font-mono text-term-green">{MAINNET_ORACLE.label}</span> runs GERO {MAINNET_ORACLE.version},
              the live oracle. <span className="font-mono text-term-amber">{TESTNET.label}</span> runs the next version,
              with the line record, together with the ENTROPY minter and its test token {TESTNET.symbol}, which has no
              value.
            </P>
          </Panel>
        </Section>

        <Section id="entropy" title="ENTROPY">
          <Panel title="A mined token">
            <P>
              ENTROPY is the token that pays for GERO&apos;s work. It is mined, not pre-minted: a separate minter program
              reads the line record and credits each line&apos;s reward to the nodes that were on time, to the prover whose
              proof was verified, and to an ecosystem vault. Nobody holds a mint key, and the minter becomes immutable
              before trading opens. ENTROPY is not launched on mainnet; it is in testing on {TESTNET.label}.
            </P>
          </Panel>
          <Panel title="Supply">
            <P>
              The supply is capped at 21,000,000 ENTROPY. 10% (2,100,000) is minted once as genesis liquidity and paired
              with 2,000 XNT on Forge Swap. The other 90% (18,900,000) is mined on a schedule that halves every 16,089,796
              lines, about 18 months at the measured X1 slot time. Halvings count lines, not time, and are published as line
              numbers. The first era pays 0.587328764 ENTROPY per line.
            </P>
            <P>There is no team, investor, treasury or airdrop allocation and no vesting schedule.</P>
          </Panel>
          <Panel title="Who earns what, per line">
            <Table
              head={["Line type", "On-time nodes", "Prover", "Ecosystem vault"]}
              rows={[
                ["With a verified prover", "80%, split equally", "10%", "10%"],
                ["No verified proof", "90%, split equally", "0", "10%"],
                ["Dead, or zero on-time nodes", "0", "0", "0 (nothing minted)"],
                ["Shadow node", "0", "—", "—"],
              ]}
            />
          </Panel>
          <Panel title="Settling and claiming">
            <P>
              A line is paid once it is 64 lines old and can no longer change. Anyone can run the settlement, which credits
              each payee&apos;s claimable balance. Each payee opens its own claim account once and can then claim at any
              time; tokens are minted only to that payee&apos;s own token account. On testnet this happens on the{" "}
              <Link className={link} href="/testnet/claim">
                Claim
              </Link>{" "}
              page.
            </P>
          </Panel>
          <Panel title="Uses and limits">
            <P>
              Planned uses include paying GERO request fees and letting creators prepay the oracle&apos;s share of Forge
              Launch mints. Both keep working in XNT, so nobody has to hold ENTROPY to use GERO.
            </P>
            <P>
              The ecosystem vault&apos;s 10% funds projects that use GERO randomness, under spending limits, with larger
              payments going through a 7-day public proposal and every withdrawal recorded on-chain.
            </P>
            <P>ENTROPY carries no share of any revenue, pays nothing for holding, and is not staked.</P>
          </Panel>
        </Section>

        <Section id="nodes" title="Nodes">
          <Panel title="Joining">
            <P>
              Nodes are approved by GERO&apos;s governance key, held on a hardware wallet. Approval starts a 7-day{" "}
              <em>shadow</em> period: the node commits and reveals on the real network but affects no result, sets no bits
              in the line record, is not slashable and earns nothing. After that it can be activated.
            </P>
          </Panel>
          <Panel title="Keys and payouts">
            <P>
              Each node has a hot node key in its daemon and a cold owner key that is never on the node machine. Only the
              owner key can change the node&apos;s payout address, and only after a 72-hour public delay, so a stolen hot
              key can cause misses but cannot redirect anything. On mainnet every payout address must be a cold wallet that
              can connect to a browser, separate from the node key.
            </P>
          </Panel>
          <Panel title="Bond and slashing">
            <P>
              Nodes post a bond in XNT, never in ENTROPY. A node that misses its reveal window is slashable and earns nothing
              for that line. The current values are a stake of 10 XNT and a slash of 1 XNT per missed line.
            </P>
            <P>
              See the{" "}
              <Link className={link} href="/testnet/nodes">
                Nodes
              </Link>{" "}
              page for every node and what it takes to run one.
            </P>
          </Panel>
        </Section>

        <p className="text-sm text-term-text2">
          Full details, figures and risks are in the{" "}
          <a className={link} href={WHITE_PAPER_URL} target="_blank" rel="noreferrer">
            white paper (PDF)
          </a>
          .
        </p>
      </div>
    </>
  );
}
