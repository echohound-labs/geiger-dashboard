/**
 * lib/tx.ts — the hub's only write path. lib/chain.ts stays read-only.
 *
 * Every transaction goes through the same four steps, in order:
 *   1. build       compute-budget limit + the instructions, a v0 message with a
 *                  fresh blockhash, the connected wallet as fee payer
 *   2. simulate    simulateTransaction (sigVerify off) with the accounts the
 *                  caller wants to see afterwards; the result is shown to the
 *                  user BEFORE the wallet is asked to sign
 *   3. sign        only after a successful simulation; the signed message must
 *                  be byte-identical to the simulated one or nothing is sent
 *   4. send        sendRawTransaction, then confirm against the blockhash's
 *                  last valid block height
 *
 * Mirrors ~/entropy-token/scripts/minter_init.py send_or_simulate / error_name.
 * The instruction builders follow minter_init.py ix_* and the program's
 * Accounts structs (programs/entropy-minter/src/instructions/*.rs); the
 * source of each layout is named next to it.
 */

import {
  ComputeBudgetProgram,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  type Connection,
} from "@solana/web3.js";
import { Buffer } from "buffer";
import { sha256 } from "js-sha256";
import { ATA_PROGRAM, NETWORK, TOKEN_2022, writesAllowed, type NetworkConfig } from "./config";

// errors.rs, in order from 6000 (minter_init.py PROGRAM_ERRORS).
const PROGRAM_ERRORS = [
  "UnauthorizedUpgradeAuthority", "InvalidProgramData", "InvalidMint", "InvalidMintAuthority",
  "MintHasFreezeAuthority", "MintSupplyNotZero", "InvalidMintExtensions", "InvalidLineLogAddress",
  "InvalidLineLog", "InvalidStartLine", "StartLineAlreadyWritten", "NoLaunchSlots", "LaunchSlotNotActive",
  "LaunchSlotNoPayout", "LaunchSlotNoClaim", "MissingClaimAccount", "ClaimAccountNotWritable",
  "InvalidDestination", "NothingToClaim", "CapExceeded", "MathOverflow",
];

/**
 * Compute-unit limits from minter_init.py CU (tests/README.md LiteSVM table:
 * open_claim 10,625; claim 43,483 with the ATA to create).
 */
export const CU = { open_claim: 50_000, claim: 100_000 } as const;

/** state.rs Claimable::LEN; open_claim allocates exactly this. */
export const CLAIMABLE_LEN = 64;

export class TxError extends Error {}

/** Throws unless the selected network allows writes (testnet only, see config.ts). */
export function assertWritable(cfg: NetworkConfig = NETWORK): void {
  if (!writesAllowed(cfg)) throw new TxError(`${cfg.label}: transactions are disabled (not before launch)`);
}

/** minter_init.py error_name: the Anchor log line first, then a Custom code, then the raw error. */
export function errorName(logs: string[] | null | undefined, err: unknown): string | null {
  for (const line of logs ?? []) {
    const m = /Error Code: (\w+)\. Error Number: (\d+)/.exec(line);
    if (m) return `${m[1]} (${m[2]})`;
  }
  if (err === null || err === undefined) return null;
  if (typeof err === "object" && err !== null && "InstructionError" in err) {
    const e = (err as { InstructionError: [number, unknown] }).InstructionError[1];
    if (typeof e === "object" && e !== null && "Custom" in e) {
      const code = (e as { Custom: number }).Custom;
      const name = code >= 6000 && code < 6000 + PROGRAM_ERRORS.length ? PROGRAM_ERRORS[code - 6000] : "custom";
      return `${name} (${code})`;
    }
    return typeof e === "string" ? e : JSON.stringify(e);
  }
  return typeof err === "string" ? err : JSON.stringify(err);
}

// ─── Minter instructions ─────────────────────────────────────────────────────

/** Anchor instruction discriminator: sha256("global:<name>")[..8] (minter_init.py sighash). */
function sighash(name: string): Buffer {
  return Buffer.from(sha256.array(`global:${name}`).slice(0, 8));
}

const utf8 = (s: string) => Buffer.from(s, "utf8");

function minterPda(seeds: Buffer[], cfg: NetworkConfig): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, new PublicKey(cfg.minterProgram))[0];
}

/** ["claim", payee] under the minter (constants.rs CLAIM_SEED, minter_init.py Addrs.claim). */
export function claimPda(payee: PublicKey, cfg: NetworkConfig = NETWORK): PublicKey {
  return minterPda([utf8("claim"), payee.toBuffer()], cfg);
}

/**
 * A minter instruction: the Accounts struct's accounts, then the #[event_cpi]
 * pair (["__event_authority"] PDA, the program itself) (minter_init.py _mix).
 */
function minterIx(name: string, keys: TransactionInstruction["keys"], cfg: NetworkConfig): TransactionInstruction {
  const program = new PublicKey(cfg.minterProgram);
  return new TransactionInstruction({
    programId: program,
    keys: [
      ...keys,
      { pubkey: minterPda([utf8("__event_authority")], cfg), isSigner: false, isWritable: false },
      { pubkey: program, isSigner: false, isWritable: false },
    ],
    data: sighash(name),
  });
}

/**
 * open_claim, no args (instructions/open_claim.rs OpenClaim; minter_init.py ix_open_claim):
 *   payer (signer, writable) · payee (signer) · claimable ["claim", payee] (writable, init) · system_program
 */
export function ixOpenClaim(payer: PublicKey, payee: PublicKey, cfg: NetworkConfig = NETWORK): TransactionInstruction {
  return minterIx(
    "open_claim",
    [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: payee, isSigner: true, isWritable: false },
      { pubkey: claimPda(payee, cfg), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    cfg,
  );
}

/** Canonical Token-2022 ATA: [owner, token program, mint] under the ATA program. */
export function token2022Ata(owner: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), new PublicKey(TOKEN_2022).toBuffer(), mint.toBuffer()],
    new PublicKey(ATA_PROGRAM),
  )[0];
}

/**
 * Associated-token program CreateIdempotent (tag 1) for a Token-2022 mint
 * (minter_init.py ix_create_ata_idempotent):
 *   payer (signer, writable) · ata (writable) · owner · mint · system_program · token_program
 */
export function ixCreateAtaIdempotent(payer: PublicKey, owner: PublicKey, mint: PublicKey): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(ATA_PROGRAM),
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: token2022Ata(owner, mint), isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: new PublicKey(TOKEN_2022), isSigner: false, isWritable: false },
    ],
    data: Buffer.from([1]),
  });
}

/**
 * claim, no args (instructions/claim.rs Claim; minter_init.py ix_claim):
 *   payer (signer, writable) · state ["state"] (writable) · payee · claimable ["claim", payee] (writable) ·
 *   mint (writable, == state.mint) · mint_authority ["mint_authority"] · destination = payee's Token-2022 ATA
 *   (writable) · token_program · associated_token_program · system_program
 * Mints the payee's whole `accrued` to the destination.
 */
export function ixClaim(payer: PublicKey, payee: PublicKey, mint: PublicKey, cfg: NetworkConfig = NETWORK): TransactionInstruction {
  return minterIx(
    "claim",
    [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: minterPda([utf8("state")], cfg), isSigner: false, isWritable: true },
      { pubkey: payee, isSigner: false, isWritable: false },
      { pubkey: claimPda(payee, cfg), isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: minterPda([utf8("mint_authority")], cfg), isSigner: false, isWritable: false },
      { pubkey: token2022Ata(payee, mint), isSigner: false, isWritable: true },
      { pubkey: new PublicKey(TOKEN_2022), isSigner: false, isWritable: false },
      { pubkey: new PublicKey(ATA_PROGRAM), isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    cfg,
  );
}

/** u64 LE at `o`, for reading simulated account data (Claimable.accrued @48, token amount @64). */
export function readU64(d: Uint8Array, o: number): bigint | null {
  return d.length >= o + 8 ? new DataView(d.buffer, d.byteOffset, d.byteLength).getBigUint64(o, true) : null;
}

// ─── Build ───────────────────────────────────────────────────────────────────

export interface BuiltTx {
  tx: VersionedTransaction;
  blockhash: string;
  lastValidBlockHeight: number;
  feeLamports: number | null;
}

export async function buildTx(
  connection: Connection,
  payer: PublicKey,
  ixs: TransactionInstruction[],
  cuLimit: number,
): Promise<BuiltTx> {
  assertWritable();
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions: [ComputeBudgetProgram.setComputeUnitLimit({ units: cuLimit }), ...ixs],
  }).compileToV0Message();
  const fee = await connection.getFeeForMessage(message, "confirmed").catch(() => ({ value: null }));
  return { tx: new VersionedTransaction(message), blockhash, lastValidBlockHeight, feeLamports: fee.value };
}

// ─── Simulate ────────────────────────────────────────────────────────────────

export interface SimAccount {
  address: string;
  /** null: the account does not exist after the simulated transaction. */
  after: { lamports: number; owner: string; data: Uint8Array } | null;
}

export interface SimResult {
  ok: boolean;
  error: string | null;
  logs: string[];
  unitsConsumed: number | null;
  accounts: SimAccount[];
}

/** Simulates the unsigned transaction and returns the post-state of `watch`. */
export async function simulate(connection: Connection, built: BuiltTx, watch: PublicKey[]): Promise<SimResult> {
  const r = await connection.simulateTransaction(built.tx, {
    sigVerify: false,
    replaceRecentBlockhash: false,
    commitment: "confirmed",
    accounts: { encoding: "base64", addresses: watch.map((w) => w.toBase58()) },
  });
  const v = r.value;
  const logs = v.logs ?? [];
  return {
    ok: v.err === null,
    error: v.err === null ? null : errorName(logs, v.err),
    logs,
    unitsConsumed: v.unitsConsumed ?? null,
    accounts: watch.map((w, i) => {
      const a = v.accounts?.[i] ?? null;
      return {
        address: w.toBase58(),
        after: a ? { lamports: a.lamports, owner: a.owner, data: new Uint8Array(Buffer.from(a.data[0], "base64")) } : null,
      };
    }),
  };
}

// ─── Sign, send, confirm ─────────────────────────────────────────────────────

export type SignFn = (tx: VersionedTransaction) => Promise<VersionedTransaction>;

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Signs and sends a transaction that has already simulated cleanly. Refuses if
 * `sim` is not a successful simulation of this exact transaction, or if the
 * wallet returns a different message than the one simulated.
 */
export async function signAndSend(connection: Connection, built: BuiltTx, sim: SimResult, sign: SignFn): Promise<string> {
  assertWritable();
  if (!sim.ok) throw new TxError("refusing to send: the simulation failed");
  const simulated = built.tx.message.serialize();
  const signed = await sign(built.tx);
  if (!sameBytes(signed.message.serialize(), simulated)) {
    throw new TxError(
      "refusing to send: the wallet changed the transaction after it was simulated (nothing was sent). " +
        "Turn off any wallet setting that edits transactions (priority fees, compute limits) and try again.",
    );
  }
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
    maxRetries: 3,
  });
  const res = await connection.confirmTransaction(
    { signature, blockhash: built.blockhash, lastValidBlockHeight: built.lastValidBlockHeight },
    "confirmed",
  );
  if (res.value.err) {
    const tx = await connection
      .getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 })
      .catch(() => null);
    throw new TxError(`failed on-chain: ${errorName(tx?.meta?.logMessages, res.value.err)} (signature ${signature})`);
  }
  return signature;
}
