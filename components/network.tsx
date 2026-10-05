import Link from "next/link";
import { MAINNET_ORACLE, TESTNET } from "@/lib/config";

export type Net = "mainnet" | "testnet" | "both";

const netText: Record<Net, string> = {
  mainnet: `${MAINNET_ORACLE.label} · GERO ${MAINNET_ORACLE.version}`,
  testnet: `${TESTNET.label} · GERO v9.1b + ${TESTNET.symbol}`,
  both: `${MAINNET_ORACLE.label} + ${TESTNET.label}`,
};

const netTone: Record<Net, string> = {
  mainnet: "border-term-green/50 text-term-green",
  testnet: "border-term-amber/50 text-term-amber",
  both: "border-term-lineStrong text-term-text2",
};

/** Which network a page reads. Rendered by PageTitle on every page. */
export function NetworkLabel({ net }: { net: Net }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider ${netTone[net]}`}
    >
      {netText[net]}
    </span>
  );
}

/** Shown on every page that shows ENTROPY. */
export function EntropyBanner() {
  return (
    <div
      role="note"
      className="mb-6 rounded-md border border-term-amber/50 bg-term-amber/5 p-3 font-mono text-sm text-term-amber"
    >
      tENTROPY is a test token with no value. ENTROPY is not launched on mainnet.
    </div>
  );
}

/** ENTROPY pages on mainnet: nothing to read yet, so point to the same page on testnet. */
export function NotOnMainnet({ title, testnetHref }: { title: string; testnetHref: string }) {
  return (
    <>
      <div className="mb-6">
        <div className="mb-2">
          <NetworkLabel net="mainnet" />
        </div>
        <h1 className="font-mono text-2xl tracking-wide text-term-green">{title}</h1>
      </div>
      <div className="rounded-md border border-term-lineStrong bg-term-panel p-5">
        <p className="text-[15px] text-term-text">ENTROPY is not launched on mainnet yet.</p>
        <Link href={testnetHref} className="mt-3 inline-block font-mono text-sm text-term-green underline">
          Try it on Testnet →
        </Link>
      </div>
    </>
  );
}
