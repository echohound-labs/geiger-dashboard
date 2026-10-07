import { Badge, PageTitle, Panel } from "@/components/ui";
import { GERO_WHITE_PAPER_URL, WHITE_PAPER_URL } from "@/lib/config";

export const metadata = { title: "White papers" };

// One-paragraph summaries of the two public papers (GERO_WHITEPAPER_v0.1.pdf, ENTROPY_WHITEPAPER_v0.1.md/.pdf).
// Nothing here goes beyond what they state.

const papers = [
  {
    title: "GERO White Paper v0.1",
    about: "the oracle",
    date: "draft, October 5, 2026",
    href: GERO_WHITE_PAPER_URL,
    file: "GERO_WHITEPAPER_v0.1.pdf",
    summary:
      "How GERO turns decay measured by a Geiger counter into on-chain randomness: nodes commit to hidden seeds before any request exists, the seeds are combined with the hash of a future slot and passed through a verifiable delay function, whose proof is checked on-chain from v9.1c. Both networks run v9.1c: mainnet has the oracle and the request fee, testnet additionally has the line record and tENTROPY. It covers what nodes stake and when they are slashed, and the security limits stated plainly: one operator and one node today, slashing that does not yet deter, a trusted setup for the RSA modulus, and upgrade keys that can change every rule.",
  },
  {
    title: "ENTROPY White Paper v0.1",
    about: "the token",
    date: "draft, October 4, 2026 · rebuilt October 5, 2026",
    href: WHITE_PAPER_URL,
    file: "ENTROPY_WHITEPAPER_v0.1.pdf",
    summary:
      "ENTROPY is a mined, hard-capped utility token for GERO. 10% of the 21,000,000 cap is minted once as genesis liquidity; the other 90% is paid out line by line, by a minter program nobody holds a key to, to the nodes that were on time, the prover and an ecosystem vault, halving every 16,089,796 lines. The paper covers the supply and schedule, how mining reads GERO's line record, the genesis pool and its lock, the vault's spending limits, every key and what it can do, the risks, and the launch sequence. Mainnet is not launched.",
  },
];

export default function WhitePaperPage() {
  return (
    <>
      <PageTitle
        title="White papers"
        network="both"
        sub="Both are drafts, public for testnet testing. Security review so far: Claude Code audit passes only; no legal review."
      />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {papers.map((p) => (
          <Panel key={p.title}>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-term-text">{p.title}</h2>
              <Badge tone="muted">{p.about}</Badge>
            </div>
            <div className="mb-3 font-mono text-xs text-term-text3">{p.date}</div>
            <p className="text-[15px] leading-relaxed text-term-text2">{p.summary}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={p.href}
                download={p.file}
                className="inline-flex items-center rounded border border-term-green/50 px-4 py-2 font-mono text-sm text-term-green hover:bg-term-green/10"
              >
                Download PDF
              </a>
              <a
                href={p.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded border border-term-lineStrong px-4 py-2 font-mono text-sm text-term-text2 hover:text-term-text"
              >
                Open in browser
              </a>
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}
