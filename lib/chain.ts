/**
 * lib/chain.ts — the ONE typed data boundary of the hub. Every RPC read goes
 * through this module; pages and components never call the RPC themselves.
 *
 * Read-only: JSON-RPC getters only (getAccountInfo, getMultipleAccounts,
 * getProgramAccounts, getSlot, getSignaturesForAddress, getTransaction).
 * Nothing here builds, signs or sends a transaction.
 *
 * Isomorphic (no node:* imports) so the My node page can derive and read the
 * caller's claim PDA from the browser through the same code.
 *
 * Every offset below is taken from these sources, never guessed (nothing is
 * copied from them; the paths are for review):
 *   GERO      ~/geiger-entropy-oracle/entropy-contract/programs/geiger-entropy/src/lib.rs
 *             (OracleState, NodeStream + NodeStreamExt, LineLog / LineEntry, LineBatch,
 *              RandomnessRequest; LL_O_* / LE_O_* / NS_* constants)
 *   minter    ~/entropy-token/programs/entropy-minter/src/{state.rs,constants.rs,line_log.rs}
 *   scripts   ~/entropy-token/scripts/supply_check.py (S2–S6, vault ATA, mint supply @36)
 *             ~/entropy-token/scripts/settle_crank.py (LineLog header checks, lag)
 *             ~/entropy-token/scripts/minter_init.py (claim PDA, Claimed / EcosystemClaimed events)
 * Only the fields the hub displays are decoded.
 */

import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { sha256 } from "js-sha256";
import { ATA_PROGRAM, LOADER_V3, NETWORK, TOKEN_2022, missingConfig, type NetworkConfig } from "./config";
import {
  CAP,
  GENESIS,
  LINE_SLOTS,
  SETTLE_DELAY,
  eraOf,
  nextHalvingLine,
  rewardForLine,
  scheduleSum,
} from "./schedule";

// ─── Constants from the sources ──────────────────────────────────────────────

// GERO lib.rs
const ORACLE_STATE_V91B_LEN = 550; // v9.1a (502) + slash_prev + slash_from_line + pending_authority
const MAX_NODES = 8;
const LINE_LOG_HEADER_LEN = 640;
const LINE_ENTRY_LEN = 48;
const LL_O_ABI_MAJOR = 8;
const LL_O_ABI_MINOR = 9;
const LL_O_H = 10;
const LL_O_NODE_OPERATOR = 16;
const LL_O_NODE_ACTIVE_FROM_LINE = 272;
const LL_O_NODE_PAYOUT = 336;
const LE_O_LINE = 0;
const LE_O_ON_TIME_MASK = 8;
const LE_O_ELIGIBLE_MASK = 9;
const LE_O_FLAGS = 10;
const LE_O_PROVER = 16;
export const LINE_FLAG_FINAL = 1 << 0;
export const LINE_FLAG_VERIFIED = 1 << 1;
export const LINE_FLAG_DEAD = 1 << 2;
export const LINE_FLAG_HAS_REQUESTS = 1 << 3;
const LINE_LOG_EMPTY_SLOT = 2n ** 64n - 1n; // node_active_from_line of an empty slot or a shadow node
const LINE_LOG_WRITE_CUTOFF_LINES = 32; // LINE_LOG_WRITE_CUTOFF_SLOTS 256 / GRID_SLOTS 8
const H_MIN = 8_192;
const H_MAX = 32_768;
const NS_LEN = 2_888; // 8 + size_of::<NodeStream>() (2,880)
const NS_LEN_V91 = 3_336; // NS_LEN + NS_EXT_LEN (448)
const NS_EXT_VERSION = 1;
export const PAYOUT_DELAY_SLOTS = 720_000; // 72 h at GERO's 0.36 s/slot assumption
const LINE_BATCH_LEN = 382;
const REQUEST_LEN = 138;
const REQUEST_STATUS_FULFILLED = 1;
const LINE_MASK_BITS = (1n << 56n) - 1n;

// minter state.rs
const STATE_LEN = 200;
const CLAIM_LEN = 64;
const ACCOUNT_VERSION = 1;

// eco_init.py EVENT_IX_TAG (Anchor emit_cpi tag) and minter_init.py EVENTS
const EVENT_IX_TAG = le64(0x1d9acb512ea545e4n);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RawAccount {
  address: string;
  owner: string;
  lamports: number;
  data: Uint8Array;
}

export interface MinterState {
  address: string;
  version: number;
  mint: string;
  startLine: bigint;
  settledThrough: bigint;
  totalAccrued: bigint;
  ecoAccrued: bigint;
  ecoClaimed: bigint;
  claimed: bigint;
  linesPaid: bigint;
  linesZeroNode: bigint;
  linesLost: bigint;
  linesMalformed: bigint;
  linesOverCap: bigint;
  linesNoReward: bigint;
  sharesUnminted: bigint;
  amountUnminted: bigint;
  initializedSlot: bigint;
}

export interface ClaimAccount {
  address: string;
  payee: string;
  accrued: bigint;
  totalClaimed: bigint;
}

export interface OracleState {
  address: string;
  length: number;
  layout: string;
  totalNodes: bigint;
  totalRequests: bigint;
  totalFulfillments: bigint;
  paused: boolean;
  nodes: { operator: string; committedThroughLine: bigint; active: boolean }[];
  shadowMask: number;
  nodeStakeLamports: bigint;
  revealSlashLamports: bigint;
}

export interface LineLogHeader {
  address: string;
  abiMajor: number;
  abiMinor: number;
  h: number;
  /** null when usable, else the first failing check (settle_crank.py LineLog). */
  defect: string | null;
  nodeOperator: string[];
  nodeActiveFromLine: bigint[];
  nodePayout: string[];
}

export interface LineEntry {
  line: bigint;
  onTimeMask: number;
  eligibleMask: number;
  flags: number;
  prover: string | null;
}

export interface NodeStream {
  address: string;
  operator: string;
  stakeLamports: bigint;
  committedThroughLine: bigint;
  /** null until grow_node_stream (2,888 → 3,336 B). */
  ext: {
    owner: string;
    payout: string;
    pendingPayout: string | null;
    payoutApplySlot: bigint;
    approvedSlot: bigint;
    activeFromLine: bigint;
  } | null;
}

export interface LineBatchSummary {
  address: string;
  line: bigint;
  operators: string[];
  mask: number;
  usedMask: number;
  slashedMask: number;
  dead: boolean;
}

export interface FulfilledRequest {
  address: string;
  requester: string;
  fulfilledAt: number; // unix seconds
  requestSlot: bigint;
  line: bigint;
}

export interface ClaimEvent {
  signature: string;
  slot: number;
  blockTime: number | null;
  kind: "Claimed" | "EcosystemClaimed";
  payee: string | null;
  destination: string;
  amount: bigint;
  total: bigint;
}

export class ChainError extends Error {}

// ─── Bytes ───────────────────────────────────────────────────────────────────

function le64(n: bigint): Uint8Array {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, n, true);
  return out;
}

function u64(d: Uint8Array, o: number): bigint {
  return new DataView(d.buffer, d.byteOffset, d.byteLength).getBigUint64(o, true);
}

function i64(d: Uint8Array, o: number): bigint {
  return new DataView(d.buffer, d.byteOffset, d.byteLength).getBigInt64(o, true);
}

function u16(d: Uint8Array, o: number): number {
  return new DataView(d.buffer, d.byteOffset, d.byteLength).getUint16(o, true);
}

function key(d: Uint8Array, o: number): string {
  return bs58.encode(d.subarray(o, o + 32));
}

function isZero(d: Uint8Array, o: number, n = 32): boolean {
  for (let i = o; i < o + n; i++) if (d[i] !== 0) return false;
  return true;
}

function optKey(d: Uint8Array, o: number): string | null {
  return isZero(d, o) ? null : key(d, o);
}

function eq(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function b64(s: string): Uint8Array {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(s, "base64"));
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const utf8 = (s: string) => new TextEncoder().encode(s);

/** Anchor account discriminator: sha256("account:<Name>")[..8]. */
export function disc(name: string): Uint8Array {
  return new Uint8Array(sha256.array(`account:${name}`).slice(0, 8));
}

function eventDisc(name: string): Uint8Array {
  return new Uint8Array(sha256.array(`event:${name}`).slice(0, 8));
}

// ─── PDAs ────────────────────────────────────────────────────────────────────

function pda(seeds: Uint8Array[], program: string): string {
  return PublicKey.findProgramAddressSync(seeds, new PublicKey(program))[0].toBase58();
}

const pk = (s: string) => new PublicKey(s).toBytes();

export function addresses(cfg: NetworkConfig = NETWORK) {
  const ecoAuthority = pda([utf8("eco_vault")], cfg.ecoVaultProgram);
  return {
    minterState: pda([utf8("state")], cfg.minterProgram),
    mintAuthority: pda([utf8("mint_authority")], cfg.minterProgram),
    oracleState: pda([utf8("oracle_state")], cfg.geroProgram),
    lineLog: pda([utf8("line_log")], cfg.geroProgram),
    ecoAuthority,
    /** Token-2022 ATA of the ["eco_vault"] PDA for the mint (supply_check.py S10). */
    ecoVault: (mint: string) => pda([pk(ecoAuthority), pk(TOKEN_2022), pk(mint)], ATA_PROGRAM),
  };
}

/** ["claim", payee] under the minter (state.rs Claimable, minter_init.py Addrs.claim). */
export function claimAddress(payee: string, cfg: NetworkConfig = NETWORK): string {
  return pda([utf8("claim"), pk(payee)], cfg.minterProgram);
}

/** ["stream", operator] under GERO (STREAM_SEED). */
export function streamAddress(operator: string, cfg: NetworkConfig = NETWORK): string {
  return pda([utf8("stream"), pk(operator)], cfg.geroProgram);
}

// ─── RPC ─────────────────────────────────────────────────────────────────────

const COMMITMENT = "confirmed"; // the scripts' default

let rpcId = 0;

async function rpc<T>(method: string, params: unknown[], cfg: NetworkConfig = NETWORK): Promise<T> {
  const missing = missingConfig(cfg);
  if (missing.length) throw new ChainError(`${cfg.label} is not configured yet (missing: ${missing.join(", ")})`);
  const res = await fetch(cfg.rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
    cache: "no-store",
  });
  if (!res.ok) throw new ChainError(`${method}: HTTP ${res.status}`);
  const body = (await res.json()) as { result?: T; error?: { message?: string } };
  if (body.error) throw new ChainError(`${method}: ${body.error.message ?? JSON.stringify(body.error)}`);
  return body.result as T;
}

interface RpcAccount {
  owner: string;
  lamports: number;
  data: [string, string];
}

function toRaw(address: string, v: RpcAccount | null): RawAccount | null {
  return v ? { address, owner: v.owner, lamports: v.lamports, data: b64(v.data[0]) } : null;
}

export async function getSlot(): Promise<number> {
  return rpc<number>("getSlot", [{ commitment: COMMITMENT }]);
}

async function getAccount(address: string, slice?: { offset: number; length: number }): Promise<RawAccount | null> {
  const opts: Record<string, unknown> = { encoding: "base64", commitment: COMMITMENT };
  if (slice) opts.dataSlice = slice;
  const r = await rpc<{ value: RpcAccount | null }>("getAccountInfo", [address, opts]);
  return toRaw(address, r.value);
}

async function getAccounts(addrs: string[]): Promise<(RawAccount | null)[]> {
  const out: (RawAccount | null)[] = [];
  for (let i = 0; i < addrs.length; i += 100) {
    const chunk = addrs.slice(i, i + 100);
    const r = await rpc<{ value: (RpcAccount | null)[] }>("getMultipleAccounts", [
      chunk,
      { encoding: "base64", commitment: COMMITMENT },
    ]);
    r.value.forEach((v, j) => out.push(toRaw(chunk[j], v)));
  }
  return out;
}

async function getProgramAccounts(program: string, filters: unknown[]): Promise<RawAccount[]> {
  const r = await rpc<{ pubkey: string; account: RpcAccount }[]>("getProgramAccounts", [
    program,
    { encoding: "base64", commitment: COMMITMENT, filters },
  ]);
  return r.map((x) => toRaw(x.pubkey, x.account)!);
}

const memcmp = (offset: number, bytes: Uint8Array) => ({ memcmp: { offset, bytes: bs58.encode(bytes) } });

// ─── Minter ──────────────────────────────────────────────────────────────────

/** MinterState, state.rs (200 B). Null if the minter is not initialized. */
export async function getMinterState(cfg: NetworkConfig = NETWORK): Promise<MinterState | null> {
  const address = addresses(cfg).minterState;
  const a = await getAccount(address);
  if (!a) return null;
  const d = a.data;
  if (a.owner !== cfg.minterProgram || d.length !== STATE_LEN || !eq(d.subarray(0, 8), disc("MinterState"))) {
    throw new ChainError(`MinterState ${address} has the wrong owner, length or discriminator`);
  }
  return {
    address,
    version: d[8],
    mint: key(d, 16),
    startLine: u64(d, 80),
    settledThrough: u64(d, 88),
    totalAccrued: u64(d, 96),
    ecoAccrued: u64(d, 104),
    ecoClaimed: u64(d, 112),
    claimed: u64(d, 120),
    linesPaid: u64(d, 128),
    linesZeroNode: u64(d, 136),
    linesLost: u64(d, 144),
    linesMalformed: u64(d, 152),
    linesOverCap: u64(d, 160),
    linesNoReward: u64(d, 168),
    sharesUnminted: u64(d, 176),
    amountUnminted: u64(d, 184),
    initializedSlot: u64(d, 192),
  };
}

function decodeClaim(a: RawAccount | null, cfg: NetworkConfig, payee?: string): ClaimAccount | null {
  if (!a || a.owner !== cfg.minterProgram) return null;
  const d = a.data;
  if (d.length !== CLAIM_LEN || !eq(d.subarray(0, 8), disc("Claimable")) || d[8] !== ACCOUNT_VERSION) return null;
  const p = key(d, 16);
  if (payee && p !== payee) return null;
  return { address: a.address, payee: p, accrued: u64(d, 48), totalClaimed: u64(d, 56) };
}

/** Every Claimable (supply_check.py claim_accounts: dataSize 64 + discriminator). */
export async function getClaimAccounts(cfg: NetworkConfig = NETWORK): Promise<ClaimAccount[]> {
  const accts = await getProgramAccounts(cfg.minterProgram, [{ dataSize: CLAIM_LEN }, memcmp(0, disc("Claimable"))]);
  const out: ClaimAccount[] = [];
  for (const a of accts) {
    const c = decodeClaim(a, cfg);
    // supply_check.py S11: the account must sit at ["claim", payee]
    if (c && claimAddress(c.payee, cfg) === c.address) out.push(c);
  }
  return out;
}

/** The claim account of `payee` at its canonical PDA, or null if none exists yet. */
export async function getClaim(payee: string, cfg: NetworkConfig = NETWORK): Promise<{ address: string; claim: ClaimAccount | null }> {
  const address = claimAddress(payee, cfg);
  return { address, claim: decodeClaim(await getAccount(address), cfg, payee) };
}

async function getClaimsFor(payees: string[], cfg: NetworkConfig): Promise<Map<string, ClaimAccount | null>> {
  const uniq = Array.from(new Set(payees));
  const accts = await getAccounts(uniq.map((p) => claimAddress(p, cfg)));
  return new Map(uniq.map((p, i) => [p, decodeClaim(accts[i], cfg, p)]));
}

/** Token-2022 mint: supply @36, decimals @44 (supply_check.py S7). */
export async function getMintSupply(mint: string): Promise<{ supply: bigint; decimals: number; owner: string } | null> {
  const a = await getAccount(mint);
  if (!a || a.data.length < 82) return null;
  return { supply: u64(a.data, 36), decimals: a.data[44], owner: a.owner };
}

/** Token account amount @64, or null if the account does not exist. */
async function getTokenBalance(address: string): Promise<bigint | null> {
  const a = await getAccount(address);
  return a && a.owner === TOKEN_2022 && a.data.length >= 72 ? u64(a.data, 64) : null;
}

// ─── GERO ────────────────────────────────────────────────────────────────────

/**
 * OracleState (Borsh, lib.rs). Offsets: authority 8, total_nodes 40,
 * total_requests 48, total_fulfillments 56, paused 64, nodes 98 (8 × 41 B:
 * operator, committed_through_line, active), shadow mask ("reserved") 429,
 * node_stake_lamports 430, reveal_slash_lamports 438, verifier_program 454.
 */
export async function getOracleState(cfg: NetworkConfig = NETWORK): Promise<OracleState> {
  const address = addresses(cfg).oracleState;
  const a = await getAccount(address);
  if (!a || a.owner !== cfg.geroProgram || !eq(a.data.subarray(0, 8), disc("OracleState"))) {
    throw new ChainError(`OracleState ${address} not found or not a GERO OracleState`);
  }
  const d = a.data;
  if (d.length < 486) throw new ChainError(`OracleState is ${d.length} B: pre-v9 layout, not supported`);
  const nodes = [];
  for (let i = 0; i < MAX_NODES; i++) {
    const o = 98 + 41 * i;
    nodes.push({ operator: key(d, o), committedThroughLine: u64(d, o + 32), active: d[o + 40] === 1 });
  }
  const layout =
    d.length === ORACLE_STATE_V91B_LEN ? "v9.1b" : d.length === 502 ? "v9.1a" : d.length === 486 ? "v9" : `unknown (${d.length} B)`;
  return {
    address,
    length: d.length,
    layout,
    totalNodes: u64(d, 40),
    totalRequests: u64(d, 48),
    totalFulfillments: u64(d, 56),
    paused: d[64] === 1,
    nodes,
    shadowMask: d[429],
    nodeStakeLamports: u64(d, 430),
    revealSlashLamports: u64(d, 438),
  };
}

/** Last deploy slot and upgrade authority of an upgradeable program (loader v3 ProgramData). */
export async function getProgramInfo(program: string): Promise<{ deploySlot: bigint; upgradeAuthority: string | null } | null> {
  const p = await getAccount(program);
  if (!p || p.owner !== LOADER_V3 || p.data.length < 36) return null;
  const pd = await getAccount(key(p.data, 4), { offset: 0, length: 45 });
  if (!pd || pd.data.length < 13) return null;
  return { deploySlot: u64(pd.data, 4), upgradeAuthority: pd.data[12] === 0 ? null : key(pd.data, 13) };
}

/** LineLog header (640 B) with the settle_crank.py / line_log.rs checks. */
export async function getLineLogHeader(cfg: NetworkConfig = NETWORK): Promise<LineLogHeader | null> {
  const address = addresses(cfg).lineLog;
  const r = await rpc<{ value: (RpcAccount & { space?: number }) | null }>("getAccountInfo", [
    address,
    { encoding: "base64", commitment: COMMITMENT, dataSlice: { offset: 0, length: LINE_LOG_HEADER_LEN } },
  ]);
  if (!r.value) return null;
  const d = b64(r.value.data[0]);
  const h = d.length >= 12 ? u16(d, LL_O_H) : 0;
  let defect: string | null = null;
  if (r.value.owner !== cfg.geroProgram) defect = "owner";
  else if (d.length < LINE_LOG_HEADER_LEN) defect = "too short";
  else if (!eq(d.subarray(0, 8), disc("LineLog"))) defect = "discriminator";
  else if (d[LL_O_ABI_MAJOR] !== 1) defect = "abi_major";
  else if (!((h & (h - 1)) === 0 && h >= H_MIN && h <= H_MAX)) defect = "ring size";
  else if (r.value.space !== undefined && r.value.space !== LINE_LOG_HEADER_LEN + LINE_ENTRY_LEN * h) defect = "length";
  const nodeOperator: string[] = [];
  const nodeActiveFromLine: bigint[] = [];
  const nodePayout: string[] = [];
  if (d.length >= LINE_LOG_HEADER_LEN) {
    for (let i = 0; i < MAX_NODES; i++) {
      nodeOperator.push(key(d, LL_O_NODE_OPERATOR + 32 * i));
      nodeActiveFromLine.push(u64(d, LL_O_NODE_ACTIVE_FROM_LINE + 8 * i));
      nodePayout.push(key(d, LL_O_NODE_PAYOUT + 32 * i));
    }
  }
  return { address, abiMajor: d[LL_O_ABI_MAJOR], abiMinor: d[LL_O_ABI_MINOR], h, defect, nodeOperator, nodeActiveFromLine, nodePayout };
}

/**
 * LineLog entries for lines [first, last] (≤ H lines), read with dataSlice so
 * only the needed part of the 1.5 MB account crosses the wire. An entry is
 * returned only if it holds that line (the ring slot may hold an older one).
 */
export async function getLineEntries(header: LineLogHeader, first: bigint, last: bigint): Promise<Map<bigint, LineEntry>> {
  const out = new Map<bigint, LineEntry>();
  if (header.defect || last < first) return out;
  const H = BigInt(header.h);
  if (last - first + 1n > H) first = last - H + 1n;
  const count = Number(last - first + 1n);
  const startIdx = Number(first % H);
  const ranges: { idx: number; n: number; firstLine: bigint }[] = [];
  const n1 = Math.min(count, header.h - startIdx);
  ranges.push({ idx: startIdx, n: n1, firstLine: first });
  if (n1 < count) ranges.push({ idx: 0, n: count - n1, firstLine: first + BigInt(n1) });
  for (const r of ranges) {
    const a = await getAccount(header.address, { offset: LINE_LOG_HEADER_LEN + LINE_ENTRY_LEN * r.idx, length: LINE_ENTRY_LEN * r.n });
    if (!a) continue;
    for (let k = 0; k < r.n; k++) {
      const o = LINE_ENTRY_LEN * k;
      const want = r.firstLine + BigInt(k);
      const line = u64(a.data, o + LE_O_LINE);
      if (line !== want) continue;
      const flags = a.data[o + LE_O_FLAGS];
      out.set(line, {
        line,
        onTimeMask: a.data[o + LE_O_ON_TIME_MASK],
        eligibleMask: a.data[o + LE_O_ELIGIBLE_MASK],
        flags,
        prover: flags & LINE_FLAG_VERIFIED ? optKey(a.data, o + LE_O_PROVER) : null,
      });
    }
  }
  return out;
}

/** NodeStream (+ NodeStreamExt at 2,888 once grown), lib.rs. */
export async function getNodeStreams(operators: string[], cfg: NetworkConfig = NETWORK): Promise<Map<string, NodeStream | null>> {
  const addrs = operators.map((o) => streamAddress(o, cfg));
  const accts = await getAccounts(addrs);
  const out = new Map<string, NodeStream | null>();
  operators.forEach((op, i) => {
    const a = accts[i];
    if (!a || a.owner !== cfg.geroProgram || a.data.length < NS_LEN || !eq(a.data.subarray(0, 8), disc("NodeStream"))) {
      out.set(op, null);
      return;
    }
    const d = a.data;
    const e = NS_LEN;
    const grown = d.length >= NS_LEN_V91 && d[e] === NS_EXT_VERSION;
    out.set(op, {
      address: a.address,
      operator: key(d, 8),
      stakeLamports: u64(d, 40),
      committedThroughLine: u64(d, 56),
      ext: grown
        ? {
            owner: key(d, e + 8),
            payout: key(d, e + 40),
            pendingPayout: optKey(d, e + 104),
            payoutApplySlot: u64(d, e + 144),
            approvedSlot: u64(d, e + 152),
            activeFromLine: u64(d, e + 160),
          }
        : null,
    });
  });
  return out;
}

/**
 * Open LineBatch accounts (382 B; closed LINE_CLOSE_DELAY_SLOTS = 512 slots
 * after the line, so this only covers the most recent ~64 lines). Borsh: line 8,
 * operators 120 (8 × 32), mask 376, used_mask 377, slashed_mask 379, dead 380.
 */
export async function getOpenLineBatches(cfg: NetworkConfig = NETWORK): Promise<LineBatchSummary[]> {
  const accts = await getProgramAccounts(cfg.geroProgram, [{ dataSize: LINE_BATCH_LEN }, memcmp(0, disc("LineBatch"))]);
  return accts.map((a) => {
    const d = a.data;
    const operators = [];
    for (let i = 0; i < MAX_NODES; i++) operators.push(key(d, 120 + 32 * i));
    return { address: a.address, line: u64(d, 8), operators, mask: d[376], usedMask: d[377], slashedMask: d[379], dead: d[380] === 1 };
  });
}

/**
 * Fulfilled RandomnessRequest accounts (138 B, status byte 104 == 1). Borsh:
 * requester 8, status 104, fulfilled_at 113 (i64), request_slot 122,
 * binding 130 (line = low 56 bits).
 */
export async function getFulfilledRequests(limit: number, cfg: NetworkConfig = NETWORK): Promise<FulfilledRequest[]> {
  const accts = await getProgramAccounts(cfg.geroProgram, [
    { dataSize: REQUEST_LEN },
    memcmp(0, disc("RandomnessRequest")),
    memcmp(104, new Uint8Array([REQUEST_STATUS_FULFILLED])),
  ]);
  return accts
    .map((a) => ({
      address: a.address,
      requester: key(a.data, 8),
      fulfilledAt: Number(i64(a.data, 113)),
      requestSlot: u64(a.data, 122),
      line: u64(a.data, 130) & LINE_MASK_BITS,
    }))
    .sort((x, y) => y.fulfilledAt - x.fulfilledAt)
    .slice(0, limit);
}

// ─── Minter events (claims) ──────────────────────────────────────────────────

interface RpcTx {
  slot: number;
  blockTime: number | null;
  meta: {
    err: unknown;
    innerInstructions?: { instructions: { programIdIndex: number; data: string }[] }[];
    loadedAddresses?: { writable: string[]; readonly: string[] };
  } | null;
  transaction: { message: { accountKeys: string[] } };
}

const CLAIMED = eventDisc("Claimed");
const ECO_CLAIMED = eventDisc("EcosystemClaimed");

/** Claimed { payee, destination, amount, total_claimed } and EcosystemClaimed { destination, amount, eco_claimed }. */
function claimEventsFrom(tx: RpcTx, signature: string, cfg: NetworkConfig): ClaimEvent[] {
  if (!tx.meta || tx.meta.err) return [];
  const keys = [
    ...tx.transaction.message.accountKeys,
    ...(tx.meta.loadedAddresses?.writable ?? []),
    ...(tx.meta.loadedAddresses?.readonly ?? []),
  ];
  const out: ClaimEvent[] = [];
  for (const group of tx.meta.innerInstructions ?? []) {
    for (const ix of group.instructions) {
      if (keys[ix.programIdIndex] !== cfg.minterProgram) continue;
      const d = bs58.decode(ix.data);
      if (d.length < 16 || !eq(d.subarray(0, 8), EVENT_IX_TAG)) continue;
      const tag = d.subarray(8, 16);
      const base = { signature, slot: tx.slot, blockTime: tx.blockTime };
      if (eq(tag, CLAIMED) && d.length >= 16 + 80) {
        out.push({ ...base, kind: "Claimed", payee: key(d, 16), destination: key(d, 48), amount: u64(d, 80), total: u64(d, 88) });
      } else if (eq(tag, ECO_CLAIMED) && d.length >= 16 + 48) {
        out.push({ ...base, kind: "EcosystemClaimed", payee: null, destination: key(d, 16), amount: u64(d, 48), total: u64(d, 56) });
      }
    }
  }
  return out;
}

async function mapLimit<T, R>(items: T[], n: number, f: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await f(items[i]);
      }
    }),
  );
  return out;
}

/**
 * Recent claim / claim_ecosystem events, found through the signatures of the
 * given accounts (claim PDAs and the vault token account), newest first.
 */
export async function getRecentClaimEvents(accounts: string[], perAccount: number, cfg: NetworkConfig = NETWORK): Promise<ClaimEvent[]> {
  const sigLists = await mapLimit(accounts, 4, (a) =>
    rpc<{ signature: string; err: unknown }[]>("getSignaturesForAddress", [a, { limit: perAccount, commitment: COMMITMENT }], cfg),
  );
  const sigs = Array.from(new Set(sigLists.flat().filter((s) => !s.err).map((s) => s.signature)));
  const txs = await mapLimit(sigs, 8, (s) =>
    rpc<RpcTx | null>("getTransaction", [s, { encoding: "json", commitment: COMMITMENT, maxSupportedTransactionVersion: 0 }], cfg),
  );
  const events = txs.flatMap((tx, i) => (tx ? claimEventsFrom(tx, sigs[i], cfg) : []));
  return events.sort((a, b) => b.slot - a.slot);
}

// ─── Page views ──────────────────────────────────────────────────────────────

export type CheckStatus = "PASS" | "WARN" | "FAIL";
export interface Check {
  id: string;
  status: CheckStatus;
  text: string;
}

export interface NetworkView {
  slot: number;
  currentLine: bigint;
  oracle: OracleState;
  program: { deploySlot: bigint; upgradeAuthority: string | null } | null;
  lineLog: LineLogHeader | null;
  newestLine: bigint | null;
  freshnessLines: bigint | null;
  live: boolean;
  ringWindow: { first: bigint; last: bigint; produced: number; verified: number; withRequests: number; dead: number };
  nodesOnline: number;
  nodesListed: number;
  linesPaidSettled: bigint | null;
}

const ONLINE_SLACK_LINES = 4n;

/** Node is online if active in the table and committed close to the current line. */
function isOnline(n: { active: boolean; committedThroughLine: bigint }, currentLine: bigint): boolean {
  return n.active && n.committedThroughLine + ONLINE_SLACK_LINES >= currentLine;
}

export async function getNetworkView(): Promise<NetworkView> {
  const [slot, oracle, program, lineLog, minter] = await Promise.all([
    getSlot(),
    getOracleState(),
    getProgramInfo(NETWORK.geroProgram),
    getLineLogHeader(),
    getMinterState(),
  ]);
  const currentLine = BigInt(slot) / BigInt(LINE_SLOTS);
  let newestLine: bigint | null = null;
  const ring = { first: 0n, last: 0n, produced: 0, verified: 0, withRequests: 0, dead: 0 };
  if (lineLog && !lineLog.defect) {
    ring.last = currentLine;
    ring.first = currentLine - BigInt(lineLog.h) + 1n;
    const entries = await getLineEntries(lineLog, ring.first, ring.last);
    entries.forEach((e) => {
      if (!(e.flags & LINE_FLAG_FINAL)) return;
      if (e.onTimeMask !== 0) {
        ring.produced++;
        if (newestLine === null || e.line > newestLine) newestLine = e.line;
      }
      if (e.flags & LINE_FLAG_VERIFIED) ring.verified++;
      if (e.flags & LINE_FLAG_HAS_REQUESTS) ring.withRequests++;
      if (e.flags & LINE_FLAG_DEAD) ring.dead++;
    });
  }
  const freshnessLines = newestLine === null ? null : currentLine - (newestLine as bigint);
  const listed = oracle.nodes.filter((n) => !isZeroKey(n.operator));
  return {
    slot,
    currentLine,
    oracle,
    program,
    lineLog,
    newestLine,
    freshnessLines,
    live: !oracle.paused && freshnessLines !== null && freshnessLines <= BigInt(LINE_LOG_WRITE_CUTOFF_LINES),
    ringWindow: ring,
    nodesOnline: listed.filter((n) => isOnline(n, currentLine)).length,
    nodesListed: listed.length,
    linesPaidSettled: minter?.linesPaid ?? null,
  };
}

export type NodeStatus = "active" | "shadow" | "offline";

export interface NodeView {
  index: number;
  operator: string;
  status: NodeStatus;
  statusNote: string;
  activeFromLine: bigint | null;
  payout: string;
  pendingPayout: { to: string; applySlot: bigint; slotsLeft: number } | null;
  stakeLamports: bigint | null;
  committedThroughLine: bigint;
  onTime: { hits: number; lines: number; first: bigint; last: bigint } | null;
  slashesOpen: number;
  missesOpen: number;
  claim: ClaimAccount | null;
  claimAddress: string;
}

export interface NodesView {
  slot: number;
  currentLine: bigint;
  window: number;
  requiredStakeLamports: bigint;
  slashLamports: bigint;
  lineLogDefect: string | null;
  nodes: NodeView[];
}

const isZeroKey = (k: string) => k === "11111111111111111111111111111111";

/**
 * Listed node slots with their operator and payout address: the LineLog header
 * payout (what the minter pays) when set, else the NodeStream payout, else the
 * operator itself.
 */
async function nodePayouts(oracle: OracleState, header: LineLogHeader | null) {
  const slots = oracle.nodes
    .map((n, i) => ({ ...n, index: i }))
    .filter((n) => !isZeroKey(n.operator) || (header && !isZeroKey(header.nodeOperator[n.index])));
  const operators = slots.map((n) => (isZeroKey(n.operator) ? header!.nodeOperator[n.index] : n.operator));
  const streams = await getNodeStreams(operators);
  const payouts = slots.map((n, k) => {
    const hp = header?.nodePayout[n.index];
    return hp && !isZeroKey(hp) ? hp : streams.get(operators[k])?.ext?.payout ?? operators[k];
  });
  return { slots, operators, streams, payouts };
}

export async function getNodesView(windowLines = 2048): Promise<NodesView> {
  const [slot, oracle, header, batches] = await Promise.all([getSlot(), getOracleState(), getLineLogHeader(), getOpenLineBatches()]);
  const currentLine = BigInt(slot) / BigInt(LINE_SLOTS);
  // Only lines past the write cutoff are final for on-time accounting.
  const last = currentLine - BigInt(LINE_LOG_WRITE_CUTOFF_LINES) - 1n;
  const first = last - BigInt(windowLines) + 1n;
  const entries = header ? await getLineEntries(header, first, last) : new Map<bigint, LineEntry>();

  const { slots, operators, streams, payouts } = await nodePayouts(oracle, header);
  const claims = await getClaimsFor(payouts, NETWORK);

  const nodes: NodeView[] = slots.map((n, k) => {
    const operator = operators[k];
    const stream = streams.get(operator) ?? null;
    const afl = header ? header.nodeActiveFromLine[n.index] : null;
    const shadow = afl === LINE_LOG_EMPTY_SLOT;
    let status: NodeStatus;
    let statusNote = "";
    if (!isOnline(n, currentLine)) {
      status = "offline";
      statusNote = n.active ? `last commit line ${n.committedThroughLine}` : "inactive in the node table";
    } else if (shadow) {
      status = "shadow";
      const approved = stream?.ext?.approvedSlot ?? 0n;
      statusNote = approved > 0n ? `shadow week from slot ${approved}` : "shadow";
    } else {
      status = "active";
      if (afl !== null && afl > currentLine) statusNote = `earns from line ${afl}`;
    }
    let onTime: NodeView["onTime"] = null;
    if (afl !== null && !shadow) {
      const from = afl > first ? afl : first;
      let lines = 0;
      let hits = 0;
      for (let L = from; L <= last; L++) {
        lines++;
        const e = entries.get(L);
        if (e && e.flags & LINE_FLAG_FINAL && e.onTimeMask & (1 << n.index)) hits++;
      }
      onTime = { hits, lines, first: from, last };
    }
    let slashesOpen = 0;
    let missesOpen = 0;
    for (const b of batches) {
      const i = b.operators.indexOf(operator);
      if (i < 0) continue;
      const bit = 1 << i;
      if (b.mask & bit && !(b.usedMask & bit)) missesOpen++;
      if (b.slashedMask & bit) slashesOpen++;
    }
    const ext = stream?.ext ?? null;
    const pendingPayout =
      ext && ext.pendingPayout
        ? { to: ext.pendingPayout, applySlot: ext.payoutApplySlot, slotsLeft: Math.max(0, Number(ext.payoutApplySlot) - slot) }
        : null;
    return {
      index: n.index,
      operator,
      status,
      statusNote,
      activeFromLine: afl === null || shadow ? null : afl,
      payout: payouts[k],
      pendingPayout,
      stakeLamports: stream?.stakeLamports ?? null,
      committedThroughLine: n.committedThroughLine,
      onTime,
      slashesOpen,
      missesOpen,
      claim: claims.get(payouts[k]) ?? null,
      claimAddress: claimAddress(payouts[k]),
    };
  });
  return {
    slot,
    currentLine,
    window: windowLines,
    requiredStakeLamports: oracle.nodeStakeLamports,
    slashLamports: oracle.revealSlashLamports,
    lineLogDefect: header ? header.defect : "missing",
    nodes,
  };
}

export interface EntropyView {
  slot: number;
  currentLine: bigint;
  state: MinterState;
  mintMatchesConfig: boolean;
  supply: bigint | null;
  minted: bigint;
  era: number;
  ratePerLine: bigint;
  nextHalvingLine: bigint;
  linesToHalving: bigint;
  settleLag: bigint;
  matureLag: bigint;
  ecoVault: string;
  ecoVaultBalance: bigint | null;
  claimAccounts: number;
  sumAccrued: bigint;
  sumClaimed: bigint;
  stillClaimable: bigint;
  checks: Check[];
}

/** supply_check.py S2–S6, the chain-data checks (S1/S7–S12 shape checks stay in the script). */
function supplyChecks(s: MinterState, supply: bigint | null, sumAccrued: bigint, sumClaimed: bigint, nClaims: number, currentLine: bigint, linesPerEra: number): Check[] {
  const c: Check[] = [];
  const add = (id: string, ok: boolean, text: string, fail: CheckStatus = "FAIL") => c.push({ id, status: ok ? "PASS" : fail, text });
  const minted = GENESIS + s.claimed + s.ecoClaimed;
  add("S2", sumClaimed === s.claimed, `Σ claimed over ${nClaims} claim accounts == MinterState.claimed`);
  if (supply === null) c.push({ id: "S2", status: "FAIL", text: "mint not found" });
  else if (supply === minted) c.push({ id: "S2", status: "PASS", text: "supply == genesis + claimed + eco_claimed" });
  else if (supply < minted) c.push({ id: "S2", status: "WARN", text: "supply below genesis + claimed + eco_claimed (burned)" });
  else c.push({ id: "S2", status: "FAIL", text: "supply exceeds genesis + claimed + eco_claimed" });
  add("S3", s.totalAccrued === sumAccrued + sumClaimed + s.ecoAccrued + s.ecoClaimed, "total_accrued == claimable + claimed + ecosystem");
  add("S4", GENESIS + s.totalAccrued <= CAP, "genesis + total_accrued ≤ cap");
  add("S4", (supply ?? 0n) + sumAccrued + s.ecoAccrued <= CAP, "supply + still claimable ≤ cap");
  const counted = s.linesPaid + s.linesZeroNode + s.linesLost + s.linesMalformed + s.linesOverCap + s.linesNoReward;
  const span = s.settledThrough + 1n - s.startLine;
  add("S5", counted === span, `${counted} lines counted == ${span} settled`);
  add("S5", s.settledThrough + BigInt(SETTLE_DELAY) <= currentLine || span === 0n, "nothing immature settled");
  const bound = scheduleSum(s.startLine, s.startLine, s.settledThrough, linesPerEra);
  add("S6", s.totalAccrued + s.amountUnminted <= bound, "accrued + unminted ≤ schedule over the settled lines");
  return c;
}

export async function getEntropyView(): Promise<EntropyView> {
  const [slot, state, claims] = await Promise.all([getSlot(), getMinterState(), getClaimAccounts()]);
  if (!state) throw new ChainError("the minter is not initialized on this network");
  const currentLine = BigInt(slot) / BigInt(LINE_SLOTS);
  const ecoVault = addresses().ecoVault(state.mint);
  const [mint, ecoVaultBalance] = await Promise.all([getMintSupply(state.mint), getTokenBalance(ecoVault)]);
  const n = NETWORK.linesPerEra;
  const sumAccrued = claims.reduce((a, c) => a + c.accrued, 0n);
  const sumClaimed = claims.reduce((a, c) => a + c.totalClaimed, 0n);
  const era = eraOf(state.startLine, currentLine, n);
  const nh = nextHalvingLine(state.startLine, currentLine, n);
  const supply = mint && mint.owner === TOKEN_2022 ? mint.supply : null;
  return {
    slot,
    currentLine,
    state,
    mintMatchesConfig: state.mint === NETWORK.entropyMint,
    supply,
    minted: GENESIS + state.claimed + state.ecoClaimed,
    era,
    ratePerLine: rewardForLine(state.startLine, currentLine < state.startLine ? state.startLine : currentLine, n),
    nextHalvingLine: nh,
    linesToHalving: nh - currentLine,
    settleLag: currentLine - state.settledThrough,
    matureLag: currentLine - BigInt(SETTLE_DELAY) - state.settledThrough,
    ecoVault,
    ecoVaultBalance,
    claimAccounts: claims.length,
    sumAccrued,
    sumClaimed,
    stillClaimable: sumAccrued + state.ecoAccrued,
    checks: supplyChecks(state, supply, sumAccrued, sumClaimed, claims.length, currentLine, n),
  };
}

export interface ActivityView {
  slot: number;
  currentLine: bigint;
  lines: (LineEntry | { line: bigint; missing: true })[];
  fulfillments: FulfilledRequest[];
  totalFulfillments: bigint;
  claims: ClaimEvent[];
  /** Oldest slot the RPC still serves transactions for; older claim events cannot be listed. */
  historyFromSlot: number | null;
  /** Cumulative per-payee totals from the claim accounts (independent of RPC history). */
  claimTotals: ClaimAccount[];
  ecoClaimed: bigint | null;
}

export async function getActivityView(lineCount = 16): Promise<ActivityView> {
  const [slot, header, oracle, state, claimAccts] = await Promise.all([
    getSlot(),
    getLineLogHeader(),
    getOracleState(),
    getMinterState(),
    getClaimAccounts(),
  ]);
  const currentLine = BigInt(slot) / BigInt(LINE_SLOTS);
  const last = currentLine;
  const first = last - BigInt(lineCount) + 1n;
  const entries = header ? await getLineEntries(header, first, last) : new Map<bigint, LineEntry>();
  const lines: ActivityView["lines"] = [];
  for (let L = last; L >= first; L--) lines.push(entries.get(L) ?? { line: L, missing: true });
  const watch = claimAccts.map((c) => c.address);
  if (state) watch.push(addresses().ecoVault(state.mint));
  const [fulfillments, claims, historyFromSlot] = await Promise.all([
    getFulfilledRequests(25),
    getRecentClaimEvents(watch, 40),
    rpc<number>("getFirstAvailableBlock", []).catch(() => null),
  ]);
  return {
    slot,
    currentLine,
    lines,
    fulfillments,
    totalFulfillments: oracle.totalFulfillments,
    claims: claims.slice(0, 25),
    historyFromSlot,
    claimTotals: [...claimAccts].sort((a, b) => (b.totalClaimed > a.totalClaimed ? 1 : b.totalClaimed < a.totalClaimed ? -1 : 0)),
    ecoClaimed: state?.ecoClaimed ?? null,
  };
}

export interface MyNodeView {
  wallet: string;
  claimAddress: string;
  claim: ClaimAccount | null;
  /** Node slots whose payout address (as on the Nodes page) is this wallet. */
  payoutSlots: number[];
  /** Node slots whose operator (node) key is this wallet. */
  operatorSlots: number[];
  /** Every listed node slot, for the payout checks. */
  nodes: { index: number; operator: string; payout: string }[];
}

/** Client-safe: derives ["claim", wallet] under the minter and reads it, plus the node payouts. */
export async function getMyNodeView(wallet: string): Promise<MyNodeView> {
  const [{ address, claim }, header, oracle] = await Promise.all([getClaim(wallet), getLineLogHeader(), getOracleState()]);
  const { slots, operators, payouts } = await nodePayouts(oracle, header);
  const nodes = slots.map((n, k) => ({ index: n.index, operator: operators[k], payout: payouts[k] }));
  return {
    wallet,
    claimAddress: address,
    claim,
    payoutSlots: nodes.filter((n) => n.payout === wallet).map((n) => n.index),
    operatorSlots: nodes.filter((n) => n.operator === wallet).map((n) => n.index),
    nodes,
  };
}
