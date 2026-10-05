"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";
import { TxRunner } from "./tx-runner";
import { Addr, Badge, ErrorPanel, HOT_PAYOUT_NOTE, HotPayoutBadge, KV, Panel } from "./ui";
import { WalletButton } from "./wallet-button";
import { getMinterState, getMyNodeView, type MyNodeView } from "@/lib/chain";
import { NETWORK, explorerAddress, explorerTx } from "@/lib/config";
import { amount, xnt } from "@/lib/format";
import {
  CLAIMABLE_LEN,
  CU,
  TxError,
  claimPda,
  ixClaim,
  ixCreateAtaIdempotent,
  ixOpenClaim,
  readU64,
  token2022Ata,
} from "@/lib/tx";

export function MyNodePanel() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58() ?? null;
  const [view, setView] = useState<MyNodeView | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [reload, setReload] = useState(0);
  const [claimRent, setClaimRent] = useState<number | null>(null);
  // Kept here, not in TxRunner: the refresh after a confirm can unmount the runner (open_claim disappears once the account exists).
  const [lastTx, setLastTx] = useState<{ name: string; signature: string } | null>(null);

  useEffect(() => setLastTx(null), [wallet]);

  useEffect(() => {
    if (!wallet) {
      setView(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getMyNodeView(wallet)
      .then((v) => !cancelled && setView(v))
      .catch((e) => !cancelled && setError(e))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [wallet, reload]);

  useEffect(() => {
    connection
      .getMinimumBalanceForRentExemption(CLAIMABLE_LEN)
      .then(setClaimRent)
      .catch(() => setClaimRent(null));
  }, [connection]);

  const done = useCallback((name: string, signature: string) => {
    setLastTx({ name, signature });
    setReload((n) => n + 1);
  }, []);

  if (!wallet || !publicKey) {
    return (
      <Panel>
        <p className="mb-4 text-sm text-term-text2">
          Connect the wallet that is (or will be) a node&apos;s payout address. The hub derives its claim account
          <span className="font-mono"> [&quot;claim&quot;, wallet]</span> under the minter and reads it.
        </p>
        <WalletButton />
      </Panel>
    );
  }

  const c = view?.claim ?? null;
  const notPayout = view !== null && view.payoutSlots.length === 0;
  // Slots that pay this wallet while this wallet is also their operator (hot node) key.
  const hotSlots = view ? view.nodes.filter((n) => n.payout === wallet && n.operator === wallet) : [];
  const operatorOnly = view ? view.operatorSlots.filter((i) => !view.payoutSlots.includes(i)) : [];
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <Panel title="Acting for" className="lg:col-span-2">
        <p className="text-sm text-term-text2">
          The hub acts for <span className="font-mono text-term-text"><Addr value={wallet} /></span> only: it is the fee
          payer, the payee and the only signer of every transaction on this page. Claims go to this wallet&apos;s own claim
          account and its own token account; to act for another address, connect that wallet.
        </p>
        {hotSlots.length > 0 && (
          <div className="mt-3 space-y-1 rounded-md border border-term-amber/40 p-3 font-mono text-sm text-term-amber">
            <div className="flex flex-wrap items-center gap-2">
              <HotPayoutBadge />
              <span>node slot {hotSlots.map((n) => n.index).join(", ")}</span>
            </div>
            <div>⚠ {HOT_PAYOUT_NOTE}</div>
          </div>
        )}
        {operatorOnly.length > 0 && (
          <div className="mt-3 rounded-md border border-term-amber/40 p-3 font-mono text-sm text-term-amber">
            ⚠ This wallet is the operator (node) key of slot {operatorOnly.join(", ")}, which pays a different address. Rewards
            accrue to that payout address, not to this key.
          </div>
        )}
        {notPayout && (
          <div className="mt-3 rounded-md border border-term-amber/40 p-3 font-mono text-sm text-term-amber">
            ⚠ This wallet is not the payout address of any node. Nothing accrues to its claim account, so claim has nothing to
            pay. open_claim still works, but it only makes sense if this wallet is about to become a node&apos;s payout
            address.
          </div>
        )}
      </Panel>
      <Panel title="Claim account">
        {error ? <ErrorPanel error={error} /> : null}
        <KV
          rows={[
            ["Wallet", <Addr key="w" value={wallet} />],
            [
              "Claim PDA",
              view ? (
                <a key="c" className="underline decoration-term-line" href={explorerAddress(view.claimAddress)} target="_blank" rel="noreferrer">
                  <Addr value={view.claimAddress} />
                </a>
              ) : (
                "…"
              ),
            ],
            [
              "Status",
              loading && !view ? "reading…" : c ? <Badge key="s" tone="good">open</Badge> : <Badge key="s" tone="warn">no claim account yet</Badge>,
            ],
            ["Payee recorded in the claim account", c ? <Addr key="p" value={c.payee} /> : "—"],
            [`Accrued (claimable, ${NETWORK.symbol})`, c ? amount(c.accrued) : "—"],
            [`Total claimed (${NETWORK.symbol})`, c ? amount(c.totalClaimed) : "—"],
            [
              "Payout address of node slot",
              view ? (view.payoutSlots.length ? view.payoutSlots.join(", ") : "none") : "…",
            ],
          ]}
        />
      </Panel>
      <Panel
        title="Actions"
        note="Each action is simulated first; the result is shown before the wallet is asked to sign, and nothing is sent unless the simulation succeeded."
      >
        <div className="space-y-3">
          {lastTx && (
            <div className="space-y-1 rounded border border-term-green/40 p-3 font-mono text-xs">
              <div className="flex items-center gap-2">
                <Badge tone="good">confirmed</Badge>
                <span className="text-term-text2">{lastTx.name}; the figures on this page were re-read after it</span>
              </div>
              <a className="block break-all text-term-green underline" href={explorerTx(lastTx.signature)} target="_blank" rel="noreferrer">
                {lastTx.signature}
              </a>
            </div>
          )}
          {view && !c && (
            <div className="space-y-2">
              {notPayout && (
                <p className="font-mono text-xs text-term-amber">⚠ Not a payout address: the account will stay empty unless a node pays to this wallet.</p>
              )}
              <p className="text-sm text-term-text2">
                <span className="font-mono text-term-text">open_claim</span> creates this wallet&apos;s claim account (
                {CLAIMABLE_LEN} bytes at <span className="font-mono">[&quot;claim&quot;, wallet]</span>). The wallet signs as
                the payee and pays the rent,{" "}
                <span className="font-mono text-term-text">{claimRent === null ? "…" : xnt(BigInt(claimRent))}</span>, plus the
                transaction fee. The minter never closes a claim account, so the rent stays in it.
              </p>
              <TxRunner
                name="open_claim"
                cuLimit={CU.open_claim}
                disabledReason={null}
                prepare={async () => ({
                  ixs: [ixOpenClaim(publicKey, publicKey)],
                  watch: [claimPda(publicKey), publicKey],
                  ctx: { balanceBefore: await connection.getBalance(publicKey, "confirmed") },
                })}
                describe={(sim, built, ctx) => {
                  const [claimAcct, payer] = sim.accounts;
                  const spent = payer.after ? ctx.balanceBefore - payer.after.lamports : null;
                  return (
                    <ul className="space-y-0.5">
                      <li>
                        creates claim account {claimAcct.address} owned by{" "}
                        {claimAcct.after?.owner === NETWORK.minterProgram ? "the minter" : (claimAcct.after?.owner ?? "?")},{" "}
                        {claimAcct.after?.data.length ?? "?"} bytes
                      </li>
                      <li>rent locked in it: {claimAcct.after ? xnt(BigInt(claimAcct.after.lamports)) : "?"}</li>
                      <li>wallet balance change in the simulation (fee included): {spent === null ? "?" : `−${xnt(BigInt(spent))}`}</li>
                      <li>network fee: {built.feeLamports === null ? "unknown" : xnt(BigInt(built.feeLamports))}</li>
                    </ul>
                  );
                }}
                onDone={(signature) => done("open_claim", signature)}
              />
            </div>
          )}
          {view && c && <p className="text-sm text-term-text2">Claim account is open; open_claim is not needed.</p>}
          {c && c.accrued > 0n && (
            <div className="space-y-2">
              <p className="text-sm text-term-text2">
                <span className="font-mono text-term-text">claim</span> mints the whole claimable balance,{" "}
                <span className="font-mono text-term-text">
                  {amount(c.accrued)} {NETWORK.symbol}
                </span>
                , to this wallet&apos;s Token-2022 account for the {NETWORK.symbol} mint{" "}
                <span className="font-mono">
                  <Addr value={token2022Ata(publicKey, new PublicKey(NETWORK.entropyMint)).toBase58()} />
                </span>
                . If that account does not exist yet it is created in the same transaction and the wallet pays its rent.
              </p>
              <TxRunner
                name="claim"
                cuLimit={CU.claim}
                disabledReason={null}
                prepare={async () => {
                  const state = await getMinterState();
                  if (!state) throw new TxError("the minter is not initialized on this network");
                  if (state.mint !== NETWORK.entropyMint) {
                    throw new TxError(`MinterState.mint ${state.mint} differs from the configured mint ${NETWORK.entropyMint}; refusing`);
                  }
                  const mint = new PublicKey(state.mint);
                  const ata = token2022Ata(publicKey, mint);
                  const [ataInfo, balanceBefore] = await Promise.all([
                    connection.getAccountInfo(ata, "confirmed"),
                    connection.getBalance(publicKey, "confirmed"),
                  ]);
                  const ixs = ataInfo ? [] : [ixCreateAtaIdempotent(publicKey, publicKey, mint)];
                  ixs.push(ixClaim(publicKey, publicKey, mint));
                  return {
                    ixs,
                    watch: [claimPda(publicKey), ata, publicKey],
                    ctx: {
                      ataExisted: !!ataInfo,
                      tokensBefore: ataInfo ? (readU64(ataInfo.data, 64) ?? 0n) : 0n,
                      balanceBefore,
                    },
                  };
                }}
                describe={(sim, built, ctx) => {
                  const [claimAcct, ataAcct, payer] = sim.accounts;
                  const accruedAfter = claimAcct.after ? readU64(claimAcct.after.data, 48) : null;
                  const tokensAfter = ataAcct.after ? readU64(ataAcct.after.data, 64) : null;
                  const spent = payer.after ? ctx.balanceBefore - payer.after.lamports : null;
                  return (
                    <ul className="space-y-0.5">
                      <li>
                        mints {tokensAfter === null ? "?" : amount(tokensAfter - ctx.tokensBefore)} {NETWORK.symbol} to {ataAcct.address}
                      </li>
                      <li>
                        destination {ctx.ataExisted ? "exists" : `created in this transaction (rent ${ataAcct.after ? xnt(BigInt(ataAcct.after.lamports)) : "?"})`}
                      </li>
                      <li>claimable after: {accruedAfter === null ? "?" : amount(accruedAfter)}</li>
                      <li>wallet balance change in the simulation (fee included): {spent === null ? "?" : `−${xnt(BigInt(spent))}`}</li>
                      <li>network fee: {built.feeLamports === null ? "unknown" : xnt(BigInt(built.feeLamports))}</li>
                    </ul>
                  );
                }}
                onDone={(signature) => done("claim", signature)}
              />
            </div>
          )}
          {c && c.accrued === 0n && <p className="text-sm text-term-text2">Nothing claimable right now.</p>}
        </div>
      </Panel>
    </div>
  );
}
