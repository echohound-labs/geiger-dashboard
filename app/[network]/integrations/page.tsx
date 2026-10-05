import { Addr, Badge, PageTitle, Panel } from "@/components/ui";
import { MAINNET_ORACLE, TESTNET, explorerAddress, mainnetAddress } from "@/lib/config";
import { CANCEL_WINDOW_SLOTS } from "@/lib/mainnet";
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
  { net: "X1 Mainnet", version: `GERO ${MAINNET_ORACLE.version}`, id: MAINNET_ORACLE.program, href: mainnetAddress(MAINNET_ORACLE.program) },
  { net: "X1 Testnet", version: `GERO ${TESTNET.geroVersion} (next version, in testing)`, id: TESTNET.geroProgram, href: explorerAddress(TESTNET.geroProgram) },
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
            measured by the Geiger counters of GERO&apos;s node operators, and every result is verified on-chain.
          </p>
          <ol className="list-inside list-decimal space-y-2 text-term-text2">
            <li>
              <span className="text-term-text">Request.</span> Your program calls GERO&apos;s{" "}
              <span className="font-mono text-term-text">request_randomness</span> with a seed of its own. This creates a
              request account that belongs to your request.
            </li>
            <li>
              <span className="text-term-text">Fulfil.</span> GERO fulfils the request a few slots later with a result
              built from the nodes&apos; entropy. A request that is not fulfilled within {CANCEL_WINDOW_SLOTS} slots can no
              longer be fulfilled; it can only be cancelled.
            </li>
            <li>
              <span className="text-term-text">Use.</span> Your program reads the result from the request account, for
              example to pick an NFT&apos;s traits, and finishes its own step.
            </li>
          </ol>
          <p className="text-term-text2">
            Build and test on X1 testnet first; mainnet runs the current version. The two versions differ, so check the
            account layout of the one you target.
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
