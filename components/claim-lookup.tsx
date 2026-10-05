"use client";

import { PublicKey } from "@solana/web3.js";
import { useState, type FormEvent } from "react";
import { Addr, Badge, ErrorPanel, KV, Panel } from "./ui";
import { getMyNodeView, type MyNodeView } from "@/lib/chain";
import { NETWORK, explorerAddress } from "@/lib/config";
import { amount } from "@/lib/format";

/** Read-only: derives ["claim", address] under the minter and reads it. No wallet, nothing signed. */
export function ClaimLookup() {
  const [input, setInput] = useState("");
  const [view, setView] = useState<MyNodeView | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [invalid, setInvalid] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const a = input.trim();
    setView(null);
    setError(null);
    setInvalid(false);
    try {
      new PublicKey(a);
    } catch {
      setInvalid(true);
      return;
    }
    setLoading(true);
    try {
      setView(await getMyNodeView(a));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  const c = view?.claim ?? null;
  return (
    <Panel
      title="Look up any address"
      note="Read-only: nothing is connected or signed. Shows the claim account of a payout address on X1 testnet. Lines not yet settled are not included."
    >
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="lookup" className="sr-only">
          Payout address
        </label>
        <input
          id="lookup"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Payout address"
          spellCheck={false}
          autoComplete="off"
          className="min-w-0 flex-1 rounded border border-term-lineStrong bg-term-bg px-3 py-2 font-mono text-sm text-term-text placeholder:text-term-text3 focus:border-term-green focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || input.trim() === ""}
          className="rounded border border-term-green/50 px-4 py-2 font-mono text-sm text-term-green hover:bg-term-green/10 disabled:opacity-50"
        >
          {loading ? "Reading…" : "Look up"}
        </button>
      </form>
      {invalid && <p className="mt-3 font-mono text-sm text-term-amber">That is not a valid X1 address.</p>}
      {error ? <div className="mt-3"><ErrorPanel error={error} /></div> : null}
      {view && (
        <div className="mt-3">
          <KV
            rows={[
              ["Address", <Addr key="a" value={view.wallet} />],
              [
                "Claim account",
                <a key="c" className="underline decoration-term-line" href={explorerAddress(view.claimAddress)} target="_blank" rel="noreferrer">
                  <Addr value={view.claimAddress} />
                </a>,
              ],
              ["Status", c ? <Badge key="s" tone="good">open</Badge> : <Badge key="s" tone="muted">no claim account</Badge>],
              [`Accrued (claimable, ${NETWORK.symbol})`, c ? amount(c.accrued) : "—"],
              [`Claimed (${NETWORK.symbol})`, c ? amount(c.totalClaimed) : "—"],
              ["Payout address of node slot", view.payoutSlots.length ? view.payoutSlots.join(", ") : "none"],
            ]}
          />
        </div>
      )}
    </Panel>
  );
}
