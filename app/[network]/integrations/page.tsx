import { Addr, Badge, PageTitle, Panel } from "@/components/ui";
import { CANCEL_WINDOW_SLOTS, TYPICAL_FULFIL_SLOTS } from "@/lib/chain";
import { MAINNET, TESTNET, explorerAddress } from "@/lib/config";
import { slotsToDuration } from "@/lib/format";
import { netMetadata, netParam, type NetParams } from "@/lib/networks";

export const generateMetadata = netMetadata("Integrations");

type Integration = { name: string; network: "mainnet" | "testnet"; url: string; what: string };

// Projects whose programs call GERO's request_randomness. Static; nothing is read from the chain.
const INTEGRATIONS: Integration[] = [
  {
    name: "RISE Phoenix",
    network: "mainnet",
    url: "https://rise-phoenix-nft.vercel.app",
    what: "A collection of 500 NFTs on X1. Each mint requests randomness from GERO and completes once the request is fulfilled.",
  },
  {
    name: "Capy Warriors",
    network: "mainnet",
    url: "https://capy-nft-mint.vercel.app",
    what: "A collection of 500 NFTs on X1. Each mint requests randomness from GERO and completes once the request is fulfilled.",
  },
  // Pending permission from X1City; uncomment once they agree to be listed.
  // {
  //   name: "X1City",
  //   network: "mainnet",
  //   url: "",
  //   what: "",
  // },
];

const programs = [
  { net: MAINNET.label, version: `GERO ${MAINNET.geroVersion}: oracle and request fee`, id: MAINNET.geroProgram, href: explorerAddress(MAINNET.geroProgram, MAINNET) },
  { net: TESTNET.label, version: `GERO ${TESTNET.geroVersion}: oracle, request fee, line record and ${TESTNET.symbol}`, id: TESTNET.geroProgram, href: explorerAddress(TESTNET.geroProgram, TESTNET) },
];

export default function Page(p: NetParams) {
  const net = netParam(p);
  const here = INTEGRATIONS.filter((i) => i.network === net);
  return (
    <>
      <PageTitle title="Integrations" network={net} sub="Projects that request randomness from GERO, and how to add GERO to yours." />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {here.map((i) => (
          <Panel key={i.name}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-term-text">{i.name}</h2>
              <Badge tone={i.network === "mainnet" ? "good" : "warn"}>{i.network}</Badge>
            </div>
            <p className="text-sm leading-relaxed text-term-text2">{i.what}</p>
            <a href={i.url} target="_blank" rel="noreferrer" className="mt-3 inline-block font-mono text-sm text-term-green underline">
              Visit {i.name} →
            </a>
          </Panel>
        ))}
        {here.length === 0 && (
          <Panel className="md:col-span-2">
            <p className="text-sm text-term-text2">
              No testnet integrations are listed yet. {INTEGRATIONS.length} project{INTEGRATIONS.length === 1 ? "" : "s"} use
              GERO on mainnet; switch to Mainnet to see them.
            </p>
          </Panel>
        )}
      </div>

      <Panel title="Use GERO in your project" className="mt-3">
        <div className="space-y-3 text-[15px] leading-relaxed text-term-text">
          <p>
            Your program asks GERO for a random value, waits for it, then uses it. Randomness comes from radioactive decay
            measured by the Geiger counters of GERO&apos;s node operators, and every result comes with a VDF proof that is
            checked on-chain before the request is fulfilled.
          </p>
          <ol className="list-inside list-decimal space-y-2 text-term-text2">
            <li>
              <span className="text-term-text">Request.</span> Your program calls GERO&apos;s{" "}
              <span className="font-mono text-term-text">request_randomness</span> with a seed of its own and pays the
              request fee in XNT (the current fee is on Oracle status). This creates a request account bound to the next
              grid line.
            </li>
            <li>
              <span className="text-term-text">Fulfil.</span> GERO fulfils the request, typically {TYPICAL_FULFIL_SLOTS.min}–
              {TYPICAL_FULFIL_SLOTS.max} slots (≈ {slotsToDuration(TYPICAL_FULFIL_SLOTS.max)}) later, with a result built from the
              nodes&apos; entropy and a VDF proof checked on chain. There is no fulfil deadline: a late fulfil is allowed. A
              request can be cancelled for a refund only after {CANCEL_WINDOW_SLOTS} slots, and only once it demonstrably
              cannot be served any more (its line&apos;s batch never opened, is dead with no rollover, or does not cover its
              nodes).
            </li>
            <li>
              <span className="text-term-text">Use.</span> Your program reads the result from the request account, for
              example to pick an NFT&apos;s traits, and finishes its own step.
            </li>
          </ol>
          <p className="text-term-text2">
            Build and test on X1 testnet first. Both networks run GERO {MAINNET.geroVersion} with the same account layouts;
            only the request fee differs (see Oracle status on each network).
          </p>
        </div>
        <div className="mt-4 space-y-2">
          {programs.map((g) => (
            <div key={g.net} className="flex flex-col gap-1 rounded border border-term-line p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-mono text-xs uppercase tracking-wider text-term-text2">{g.net}</div>
                <div className="text-sm text-term-text3">{g.version}</div>
              </div>
              <a className="break-all font-mono text-sm text-term-text underline decoration-term-line" href={g.href} target="_blank" rel="noreferrer">
                <Addr value={g.id} />
              </a>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
