import { PageTitle, Panel } from "@/components/ui";
import { WHITE_PAPER_URL } from "@/lib/config";

export const metadata = { title: "White paper" };

// Summary of ENTROPY_WHITEPAPER_v0.1.md (the public paper); figures are copied from it.

const figures: [string, string][] = [
  ["Maximum supply", "21,000,000 ENTROPY, fixed in the minter"],
  ["Genesis liquidity", "10% · 2,100,000, minted once, paired with 2,000 XNT on Forge Swap"],
  ["Mined", "90% · 18,900,000, paid line by line to on-time nodes, provers and the ecosystem vault"],
  ["Halving", "every 16,089,796 lines (about 18 months at the measured slot time)"],
  ["First-era reward", "0.587328764 ENTROPY per line"],
  ["Per-line split", "80 / 10 / 10 with a verified prover, 90 / 0 / 10 without"],
  ["Mint key", "none: the mint authority belongs to the minter program"],
];

const contents = [
  "Executive summary and design principles",
  "Token specification, supply and allocation",
  "Emission schedule, with the era table",
  "How mining works, and the three programs",
  "Genesis liquidity and the ecosystem vault",
  "Node operators: joining, keys, bond and slashing",
  "Utility, and the relationship to FORGE",
  "Security and transparency, keys and trust",
  "Regulatory design considerations and risks",
  "Launch sequence",
];

export default function WhitePaperPage() {
  return (
    <>
      <PageTitle title="White paper" network="both" sub="ENTROPY white paper v0.1 · draft, October 4, 2026" />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[2fr_1fr]">
        <Panel title="Summary">
          <div className="space-y-3 text-[15px] leading-relaxed text-term-text">
            <p>
              ENTROPY is a mined, hard-capped utility token for the GERO physical-randomness oracle on X1. Every non-genesis
              token is paid out, line by line, to the node operators and provers whose work produced that line, by a minter
              program that nobody holds a key to and that becomes immutable before trading opens.
            </p>
            <p>
              The paper describes the token, its fixed supply and halving schedule, how the minter reads GERO&apos;s line
              record, the genesis liquidity and its lock, the ecosystem vault&apos;s spending limits, what node operators
              need, every key and what it can do, the risks, and the steps left before a mainnet launch.
            </p>
            <p className="text-term-text2">
              It is a draft, public for testnet testing; mainnet is not launched and parameters may be revised before
              deployment. It is not an offer to sell anything and promises no return or value.
            </p>
          </div>
          <a
            href={WHITE_PAPER_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center rounded border border-term-green/50 px-4 py-2 font-mono text-sm text-term-green hover:bg-term-green/10"
          >
            Read the white paper (PDF) →
          </a>
        </Panel>

        <Panel title="What it covers">
          <ul className="list-inside list-disc space-y-1 text-sm text-term-text2">
            {contents.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Key figures" className="mt-3">
        <dl className="divide-y divide-term-line text-sm">
          {figures.map(([k, v]) => (
            <div key={k} className="grid grid-cols-1 gap-0.5 py-2 sm:grid-cols-[12rem_1fr] sm:gap-4">
              <dt className="text-term-text2">{k}</dt>
              <dd className="font-mono text-term-text">{v}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </>
  );
}
