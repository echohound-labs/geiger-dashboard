"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import type { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { useState, type ReactNode } from "react";
import { Badge } from "./ui";
import { NETWORK, writesAllowed } from "@/lib/config";
import { buildTx, signAndSend, simulate, type BuiltTx, type SimResult } from "@/lib/tx";

export interface Prepared<C> {
  ixs: TransactionInstruction[];
  /** Accounts whose post-simulation state `describe` reads, in this order. */
  watch: PublicKey[];
  /** Whatever `describe` needs from before the simulation (balances read while preparing). */
  ctx: C;
}

type Step<C> =
  | { kind: "idle" }
  | { kind: "simulating" }
  | { kind: "simulated"; built: BuiltTx; sim: SimResult; ctx: C }
  | { kind: "signing"; built: BuiltTx; sim: SimResult; ctx: C }
  | { kind: "sending"; built: BuiltTx; sim: SimResult; ctx: C }
  | { kind: "done"; signature: string }
  | { kind: "error"; message: string; logs?: string[] };

const btn = "rounded border px-4 py-2 font-mono text-sm";
const btnOn = `${btn} border-term-green/50 text-term-green hover:bg-term-green/10`;
const btnOff = `${btn} cursor-not-allowed border-term-line text-term-text3`;

/**
 * One write action: Simulate → (show result) → Sign and send → confirm.
 * The sign button exists only after a successful simulation of the exact
 * transaction that will be signed.
 */
export function TxRunner<C>({
  name,
  cuLimit,
  disabledReason,
  prepare,
  describe,
  onDone,
}: {
  name: string;
  cuLimit: number;
  /** Non-null keeps the action disabled and shows the reason. */
  disabledReason: string | null;
  prepare: () => Promise<Prepared<C>>;
  /** What the simulation says will happen, read from the watched accounts. */
  describe: (sim: SimResult, built: BuiltTx, ctx: C) => ReactNode;
  /** Called with the signature once confirmed; the caller shows it (with an explorer link) and re-reads its numbers. */
  onDone: (signature: string) => void;
}) {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const [step, setStep] = useState<Step<C>>({ kind: "idle" });

  const blocked = !writesAllowed()
    ? `not before launch: transactions are enabled on X1 testnet only (selected: ${NETWORK.label})`
    : !publicKey
      ? "connect a wallet"
      : !signTransaction
        ? "this wallet cannot sign transactions"
        : disabledReason;
  const busy = step.kind === "simulating" || step.kind === "signing" || step.kind === "sending";

  async function runSimulation() {
    if (!publicKey) return;
    setStep({ kind: "simulating" });
    try {
      const p = await prepare();
      const built = await buildTx(connection, publicKey, p.ixs, cuLimit);
      const sim = await simulate(connection, built, p.watch);
      setStep({ kind: "simulated", built, sim, ctx: p.ctx });
    } catch (e) {
      setStep({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  async function runSend(built: BuiltTx, sim: SimResult, ctx: C) {
    if (!signTransaction) return;
    setStep({ kind: "signing", built, sim, ctx });
    try {
      const signature = await signAndSend(connection, built, sim, async (tx) => {
        const signed = await signTransaction(tx);
        setStep({ kind: "sending", built, sim, ctx });
        return signed;
      });
      setStep({ kind: "done", signature });
      onDone(signature);
    } catch (e) {
      // SendTransactionError (preflight refusal) carries the program logs.
      const logs = (e as { logs?: unknown }).logs;
      setStep({ kind: "error", message: e instanceof Error ? e.message : String(e), logs: Array.isArray(logs) ? logs : undefined });
    }
  }

  const shown = step.kind === "simulated" || step.kind === "signing" || step.kind === "sending" ? step : null;

  return (
    <div className="rounded border border-term-line p-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={blocked || busy ? btnOff : btnOn}
          disabled={!!blocked || busy}
          onClick={runSimulation}
          title={blocked ?? undefined}
        >
          {step.kind === "simulating" ? `Simulating ${name}…` : `Simulate ${name}`}
        </button>
        {blocked && <span className="font-mono text-xs text-term-text3">{blocked}</span>}
      </div>

      {shown && (
        <div className="mt-3 space-y-2 font-mono text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-term-text2">Simulation</span>
            {shown.sim.ok ? <Badge tone="good">ok</Badge> : <Badge tone="bad">failed</Badge>}
            <span className="text-term-text3">
              {shown.sim.unitsConsumed === null ? "" : `${shown.sim.unitsConsumed.toLocaleString("en-US")} CU of ${cuLimit.toLocaleString("en-US")}`}
            </span>
          </div>
          {shown.sim.error && <div className="text-term-red">Error: {shown.sim.error}</div>}
          {shown.sim.ok && <div className="text-term-text">{describe(shown.sim, shown.built, shown.ctx)}</div>}
          <Logs logs={shown.sim.logs} open={!shown.sim.ok} />
          <div className="flex flex-wrap gap-3 pt-1">
            {shown.sim.ok ? (
              <button
                type="button"
                className={busy ? btnOff : btnOn}
                disabled={busy}
                onClick={() => runSend(shown.built, shown.sim, shown.ctx)}
              >
                {step.kind === "signing" ? "Waiting for the wallet…" : step.kind === "sending" ? "Sending and confirming…" : `Sign and send ${name}`}
              </button>
            ) : null}
            <button type="button" className={busy ? btnOff : `${btn} border-term-line text-term-text2`} disabled={busy} onClick={() => setStep({ kind: "idle" })}>
              Cancel
            </button>
          </div>
          {step.kind === "simulated" && shown.sim.ok && (
            <p className="text-term-text3">Nothing has been signed or sent yet. The blockhash expires in about a minute; simulate again if the send is refused.</p>
          )}
        </div>
      )}

      {step.kind === "error" && (
        <div className="mt-3 space-y-1 font-mono text-xs text-term-red">
          <div className="break-words">{step.message}</div>
          {step.logs && <Logs logs={step.logs} open />}
        </div>
      )}
    </div>
  );
}

function Logs({ logs, open }: { logs: string[]; open: boolean }) {
  if (logs.length === 0) return null;
  return (
    <details open={open} className="text-term-text3">
      <summary className="cursor-pointer text-term-text2">Program logs ({logs.length})</summary>
      <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded border border-term-line p-2">{logs.join("\n")}</pre>
    </details>
  );
}
