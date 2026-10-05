import { PageTitle, Panel, Table } from "@/components/ui";
import { NETWORK } from "@/lib/config";

export const metadata = { title: "About" };

// Content ceiling: ENTROPY_WHITEPAPER_v0.1.md. Nothing here goes beyond what the
// white paper states; figures are copied from it.

export default function AboutPage() {
  return (
    <>
      <PageTitle title="About" sub="What GERO and ENTROPY are, at the level of the white paper (v0.1, draft)." />

      <div
        role="note"
        className="mb-6 rounded-md border border-term-amber/50 bg-term-amber/5 p-4 text-sm leading-relaxed text-term-amber"
      >
        <p className="font-semibold">No third-party audit and no legal review have been performed.</p>
        <p className="mt-2">
          No third-party audit, no legal review. A defect missed by every review pass would be permanent in the immutable
          programs.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 text-[15px] leading-relaxed text-term-text">
        <Panel title="GERO">
          <p>
            GERO is a randomness oracle on X1 whose entropy comes from physical radioactive decay measured by Geiger
            counters run by node operators. Every 8 slots it produces one <em>line</em>: one random result, verified
            on-chain, that consumers such as Forge Launch use for NFT mints.
          </p>
          <p className="mt-3">
            For every line each node commits to a hidden seed ahead of time and reveals it in a short window after the
            line&apos;s bound slot; a reveal inside the window is <em>on time</em>. The seeds are combined into the
            line&apos;s result, which a <em>prover</em> proves and a separate on-chain verifier checks. A line with no
            reveal at all is <em>dead</em>.
          </p>
          <p className="mt-3">
            GERO writes one on-chain record per line, in a ring of 32,768 lines (about 26.8 hours): which node slots were on
            time, whether the line had requests, and whether a proof was verified and by which prover. Its header names each
            node&apos;s payout address.
          </p>
        </Panel>

        <Panel title="Node operators">
          <p>
            Nodes are approved by GERO&apos;s governance key. Approval starts a 7-day <em>shadow</em> period: the node
            commits and reveals on the real network but affects no result, sets no bits in the line record, is not slashable
            and earns nothing.
          </p>
          <p className="mt-3">
            Each node has a hot node key in the daemon and a cold owner key that is never on the node machine. Only the owner
            key can change the node&apos;s payout address, and only after a 72-hour public delay.
          </p>
          <p className="mt-3">
            Nodes post a bond in XNT, never in ENTROPY. A node that misses its reveal window is slashable and earns nothing
            for that line. The current values are a stake of 10 XNT and a slash of 1 XNT per missed line.
          </p>
        </Panel>

        <Panel title="ENTROPY">
          <p>
            ENTROPY is a mined, hard-capped utility token for GERO. A separate minter program reads the line record and
            credits each line&apos;s emission to the nodes that were on time, to the prover whose proof was verified, and to
            an ecosystem vault. Nobody holds a mint key: the mint authority is a PDA of the minter.
          </p>
          <p className="mt-3">
            The supply is capped at 21,000,000 ENTROPY. 10% (2,100,000) is minted once as genesis liquidity; the remaining
            90% (18,900,000) is mined on a schedule that halves every 16,089,796 lines, about 18 months at the measured X1
            slot time. Halvings count lines, not time, and are published as line numbers. The era-0 emission is
            0.587328764 ENTROPY per line.
          </p>
          <div className="mt-4">
            <Table
              head={["Line type", "On-time nodes", "Prover", "Ecosystem vault"]}
              rows={[
                ["With a verified prover", "80%, split equally", "10%", "10%"],
                ["No verified proof", "90%, split equally", "0", "10%"],
                ["Dead, or zero on-time nodes", "0", "0", "0 (nothing minted)"],
              ]}
            />
          </div>
          <p className="mt-4">
            A line is settled once it is 64 lines old and can no longer change. Anyone can run the settle crank. Each payee
            opens its own claim account once and can then claim at any time; tokens are minted only to that payee&apos;s own
            token account.
          </p>
          <p className="mt-3">ENTROPY carries no share of any revenue and is not staked.</p>
        </Panel>

        <Panel title="This hub">
          <p>
            A read-only view of {NETWORK.label}: every figure is read from chain accounts on each page load. The testnet
            token is {NETWORK.symbol}, used for testing. Claiming from the browser is planned for a later stage.
          </p>
        </Panel>
      </div>
    </>
  );
}
