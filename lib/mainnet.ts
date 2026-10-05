/**
 * lib/mainnet.ts — read-only view of GERO v8.1 on X1 mainnet.
 *
 * Ported from the v8.1 dashboard (index.html before the hub replaced it): the
 * same accounts, discriminators, offsets and instruction labels. lib/chain.ts
 * decodes the v9.1b layouts on X1 testnet and is not used here.
 *
 * JSON-RPC getters only (getSlot, getAccountInfo, getProgramAccounts,
 * getSignaturesForAddress, getTransaction). Server-side; the browser never
 * talks to the mainnet RPC.
 */

import { MAINNET_ORACLE } from "./config";

// Anchor account discriminators (first 8 bytes, base58) for getProgramAccounts memcmp filters.
const DISC_ENTROPY_NODE = "AgqNVQJwzA7"; // sha256("account:EntropyNode")[..8]
const DISC_RANDOMNESS_REQUEST = "hxtpFJ1UcTH"; // sha256("account:RandomnessRequest")[..8]
const RANDOMNESS_REQUEST_SIZE = 138;
/** Fulfil is allowed while slot <= request_slot + 138; after that the request is cancel-only. */
export const CANCEL_WINDOW_SLOTS = 138;
/** Pool-age bound used when OracleState is too short to carry it. */
const DEFAULT_MAX_POOL_AGE_SLOTS = 1500;
/** A node counts as online if its last submission is younger than this. */
export const ONLINE_THRESHOLD_S = 3600;
/** Measured X1 mainnet average slot time, seconds. */
export const SLOT_S = 0.3675;
const POOL_SEEDS = 32;
const FEED_LIMIT = 20;

export class MainnetError extends Error {}

export interface MainnetOracle {
  length: number;
  totalNodes: number;
  totalRequests: number;
  totalFulfillments: number;
  paused: boolean;
  /** Fulfil is refused once the pool is older than this many slots. */
  maxPoolAgeSlots: number;
}

export interface MainnetPool {
  /** Next write index (the contract writes seeds[head % 32], then head += 1). */
  head: number;
  totalSubmissions: number;
  filled: number;
  /** Most recent writes, newest first: head-1, head-2, ... */
  recent: { index: number; hex: string | null }[];
}

export interface MainnetRequest {
  address: string;
  requestSlot: number;
}

export interface MainnetNode {
  address: string;
  submissions: number;
  reputation: number;
  active: boolean;
  approved: boolean;
  lastSubmission: number; // unix seconds
  online: boolean;
}

export type FeedLabel = "Finalize" | "Reveal + Commit" | "Reveal" | "Commit" | "Fulfill" | "Request" | "tx";

export interface MainnetTx {
  signature: string;
  blockTime: number | null;
  failed: boolean;
  label: FeedLabel;
  feeLamports: number | null;
}

export type Freshness = "fresh" | "warning" | "stale" | "unknown";

export interface MainnetView {
  slot: number | null;
  oracle: MainnetOracle;
  pool: MainnetPool | null;
  /** Status 0 and still inside the fulfil window; null if the read failed. */
  pending: MainnetRequest[] | null;
  /** Status 0 but past the fulfil window (cancel-only). */
  expired: MainnetRequest[];
  nodes: MainnetNode[] | null;
  txs: MainnetTx[] | null;
  /** Newest FinalizeEntropy among the recent operator transactions (unix seconds). */
  lastFinalize: number | null;
  freshness: Freshness;
  freshnessAgeS: number | null;
  poolAgeBoundS: number;
}

// ─── RPC ─────────────────────────────────────────────────────────────────────

let rpcId = 0;

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(MAINNET_ORACLE.rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
    cache: "no-store",
  });
  if (!res.ok) throw new MainnetError(`${method}: HTTP ${res.status}`);
  const body = (await res.json()) as { result?: T; error?: { message?: string } };
  if (body.error) throw new MainnetError(`${method}: ${body.error.message ?? JSON.stringify(body.error)}`);
  return body.result as T;
}

function decode(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}

function u64(d: Uint8Array, o: number): number {
  return Number(new DataView(d.buffer, d.byteOffset, d.byteLength).getBigUint64(o, true));
}

function u32(d: Uint8Array, o: number): number {
  return new DataView(d.buffer, d.byteOffset, d.byteLength).getUint32(o, true);
}

function hex(d: Uint8Array, o: number, n: number): string {
  return Buffer.from(d.subarray(o, o + n)).toString("hex");
}

type AccountInfo = { value: { data: [string, string] } | null };
type ProgramAccount = { pubkey: string; account: { data: [string, string] } };

// ─── Decoders (v8.1) ─────────────────────────────────────────────────────────

/**
 * OracleState (v8.1, 98 B): disc(8) + authority(32) + total_nodes(8) +
 * total_requests(8) + total_fulfillments(8) + paused(1) + bump(1) + appended
 * fields; max_pool_age_slots is the u64 at 66.
 */
function decodeOracle(d: Uint8Array): MainnetOracle {
  if (d.length < 66) throw new MainnetError(`OracleState is ${d.length} B, too short for v8.1`);
  return {
    length: d.length,
    totalNodes: u64(d, 40),
    totalRequests: u64(d, 48),
    totalFulfillments: u64(d, 56),
    paused: d[64] === 1,
    maxPoolAgeSlots: d.length >= 74 ? u64(d, 66) : DEFAULT_MAX_POOL_AGE_SLOTS,
  };
}

/** EntropyPool (v8.1, 1,305 B): disc(8) + seeds(32 × 32) + head(8) + total_submissions(8) + bump(1) + appended fields. */
function decodePool(d: Uint8Array): MainnetPool {
  const filledAt = (i: number) => d.subarray(8 + 32 * i, 8 + 32 * i + 32).some((b) => b !== 0);
  const head = u64(d, 1032);
  let filled = 0;
  for (let i = 0; i < POOL_SEEDS; i++) if (filledAt(i)) filled++;
  const recent = [];
  for (let k = 0; k < Math.min(8, head); k++) {
    const i = (head - 1 - k) % POOL_SEEDS;
    recent.push({ index: i, hex: filledAt(i) ? hex(d, 8 + 32 * i, 16) : null });
  }
  return { head, totalSubmissions: u64(d, 1040), filled, recent };
}

/**
 * RandomnessRequest (v8.1, 138 B): disc(8) + requester(32) + user_seed(32) +
 * result(32) + status(1) + requested_at(8) + fulfilled_at(8) + bump(1) +
 * request_slot(8) + bound_contribution_id(8). Status 0 = Pending at 104,
 * request_slot at 122.
 */
function decodeOpenRequest(a: ProgramAccount): MainnetRequest | null {
  const d = decode(a.account.data[0]);
  if (d.length < 130 || d[104] !== 0) return null;
  return { address: a.pubkey, requestSlot: u64(d, 122) };
}

/**
 * EntropyNode (pre-v7.1 167 B, v8.1 168 B): disc(8) + operator(32) +
 * node_pubkey(32) + name(4+N) + submissions(8) + reputation(1) + active(1) +
 * registered_at(8) + last_submission(8) + bump(1) + approved(1). Older accounts
 * read `approved` from zero padding (= false).
 */
function decodeNode(a: ProgramAccount, nowS: number): MainnetNode | null {
  const d = decode(a.account.data[0]);
  if (d.length < 76) return null;
  const base = 76 + u32(d, 72);
  if (d.length < base + 27) return null;
  const lastSubmission = u64(d, base + 18);
  return {
    address: a.pubkey,
    submissions: u64(d, base),
    reputation: d[base + 8],
    active: d[base + 9] === 1,
    approved: d.length > base + 27 && d[base + 27] === 1,
    lastSubmission,
    online: nowS - lastSubmission < ONLINE_THRESHOLD_S,
  };
}

/** Feed label from the v8.1 instruction names in the program logs. */
function labelOf(logs: string[]): FeedLabel {
  const ixs = logs.filter((l) => l.startsWith("Program log: Instruction: ")).map((l) => l.slice(26));
  const has = (n: string) => ixs.includes(n);
  const reveal = has("RevealEntropyV6") || has("RevealEntropy");
  if (has("FinalizeEntropy")) return "Finalize";
  if (reveal && has("CommitEntropy")) return "Reveal + Commit";
  if (reveal) return "Reveal";
  if (has("CommitEntropy")) return "Commit";
  if (has("FulfillRandomness")) return "Fulfill";
  if (has("RequestRandomness")) return "Request";
  return "tx";
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

async function getRecentTxs(): Promise<MainnetTx[]> {
  const sigs = await rpc<{ signature: string; blockTime: number | null; err: unknown }[]>("getSignaturesForAddress", [
    MAINNET_ORACLE.operator,
    { limit: FEED_LIMIT, commitment: "confirmed" },
  ]);
  const details = await mapLimit(sigs, 8, (s) =>
    rpc<{ blockTime: number | null; meta: { fee: number; logMessages?: string[] } | null } | null>("getTransaction", [
      s.signature,
      { encoding: "json", commitment: "confirmed", maxSupportedTransactionVersion: 0 },
    ]).catch(() => null),
  );
  // Newest first, as the RPC returns them.
  return sigs.map((s, i) => ({
    signature: s.signature,
    blockTime: s.blockTime ?? details[i]?.blockTime ?? null,
    failed: s.err !== null && s.err !== undefined,
    label: labelOf(details[i]?.meta?.logMessages ?? []),
    feeLamports: details[i]?.meta?.fee ?? null,
  }));
}

// ─── Page view ───────────────────────────────────────────────────────────────

export async function getMainnetView(): Promise<MainnetView> {
  const soft = <T,>(p: Promise<T>) => p.catch(() => null);
  const [oracleRes, poolRes, requestRes, nodeRes, slot, txs] = await Promise.all([
    rpc<AccountInfo>("getAccountInfo", [MAINNET_ORACLE.oracleState, { encoding: "base64" }]),
    soft(rpc<AccountInfo>("getAccountInfo", [MAINNET_ORACLE.entropyPool, { encoding: "base64" }])),
    soft(
      rpc<ProgramAccount[]>("getProgramAccounts", [
        MAINNET_ORACLE.program,
        {
          filters: [{ memcmp: { offset: 0, bytes: DISC_RANDOMNESS_REQUEST } }, { dataSize: RANDOMNESS_REQUEST_SIZE }],
          encoding: "base64",
        },
      ]),
    ),
    soft(
      rpc<ProgramAccount[]>("getProgramAccounts", [
        MAINNET_ORACLE.program,
        { filters: [{ memcmp: { offset: 0, bytes: DISC_ENTROPY_NODE } }], encoding: "base64" },
      ]),
    ),
    soft(rpc<number>("getSlot", [{ commitment: "confirmed" }])),
    soft(getRecentTxs()),
  ]);
  if (!oracleRes.value) throw new MainnetError("OracleState not found");
  const oracle = decodeOracle(decode(oracleRes.value.data[0]));
  const pool = poolRes?.value ? decodePool(decode(poolRes.value.data[0])) : null;

  // Only requests still inside their fulfil window count as pending; older ones
  // are cancel-only. Without the current slot every open request counts.
  const open = requestRes ? requestRes.map(decodeOpenRequest).filter((r): r is MainnetRequest => r !== null) : null;
  const inWindow = (r: MainnetRequest) => slot === null || r.requestSlot + CANCEL_WINDOW_SLOTS >= slot;
  const pending = open ? open.filter(inWindow) : null;
  const expired = open ? open.filter((r) => !inWindow(r)) : [];

  const nowS = Math.floor(Date.now() / 1000);
  const nodes = nodeRes
    ? nodeRes
        .map((a) => decodeNode(a, nowS))
        .filter((n): n is MainnetNode => n !== null)
        .sort((a, b) => b.submissions - a.submissions)
    : null;

  const finals = (txs ?? []).filter((t) => t.label === "Finalize" && !t.failed && t.blockTime !== null);
  const lastFinalize = finals.length ? Math.max(...finals.map((t) => t.blockTime as number)) : null;
  const poolAgeBoundS = oracle.maxPoolAgeSlots * SLOT_S;
  const freshnessAgeS = lastFinalize === null ? null : Math.max(0, nowS - lastFinalize);
  const freshness: Freshness =
    freshnessAgeS === null
      ? "unknown"
      : freshnessAgeS > poolAgeBoundS
        ? "stale"
        : freshnessAgeS > poolAgeBoundS / 2
          ? "warning"
          : "fresh";

  return { slot, oracle, pool, pending, expired, nodes, txs, lastFinalize, freshness, freshnessAgeS, poolAgeBoundS };
}
