import { Addr } from "./ui";
import { MAINNET_ORACLE, TESTNET, explorerAddress, mainnetAddress } from "@/lib/config";

export const REPO_URL = "https://github.com/echohound-labs/geiger-dashboard";

const networks = [
  {
    name: MAINNET_ORACLE.label,
    tone: "text-term-green",
    programs: [{ label: `GERO ${MAINNET_ORACLE.version}`, id: MAINNET_ORACLE.program, href: mainnetAddress(MAINNET_ORACLE.program) }],
    note: "ENTROPY not launched",
  },
  {
    name: TESTNET.label,
    tone: "text-term-amber",
    programs: [
      { label: "GERO", id: TESTNET.geroProgram, href: explorerAddress(TESTNET.geroProgram) },
      { label: "entropy-minter", id: TESTNET.minterProgram, href: explorerAddress(TESTNET.minterProgram) },
      { label: "eco-vault", id: TESTNET.ecoVaultProgram, href: explorerAddress(TESTNET.ecoVaultProgram) },
      { label: `${TESTNET.symbol} mint`, id: TESTNET.entropyMint, href: explorerAddress(TESTNET.entropyMint) },
    ],
    note: `${TESTNET.symbol} is a test token with no value`,
  },
];

/** On every page: the audit and legal-review warning, the repository, and the program addresses per network. */
export function Footer() {
  return (
    <footer className="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6">
      <div className="space-y-4 border-t border-term-line pt-5 font-mono text-xs text-term-text3">
        <p className="text-sm text-term-amber">No third-party audit, no legal review.</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {networks.map((n) => (
            <div key={n.name}>
              <div className={`mb-1 uppercase tracking-wider ${n.tone}`}>{n.name}</div>
              <ul className="space-y-0.5">
                {n.programs.map((p) => (
                  <li key={p.id} className="flex flex-wrap gap-x-2">
                    <span className="text-term-text2">{p.label}</span>
                    <a className="underline decoration-term-line hover:text-term-text" href={p.href} target="_blank" rel="noreferrer">
                      <Addr value={p.id} />
                    </a>
                  </li>
                ))}
              </ul>
              <div className="mt-1">{n.note}</div>
            </div>
          ))}
        </div>
        <a className="inline-block underline decoration-term-line hover:text-term-text" href={REPO_URL} target="_blank" rel="noreferrer">
          GitHub: echohound-labs/geiger-dashboard
        </a>
      </div>
    </footer>
  );
}
