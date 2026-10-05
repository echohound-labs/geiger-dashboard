/**
 * lib/schedule.ts — ENTROPY emission constants and schedule math. Pure, no RPC.
 *
 * Source: ~/entropy-token/programs/entropy-minter/src/constants.rs and
 * schedule_sum() in ~/entropy-token/scripts/supply_check.py.
 *   R0 = ⌊EMISSION / (2·N)⌋,  era(L) = ⌊(L − L0) / N⌋,  R(L) = R0 >> era (0 from era 64)
 */

export const ONE = 1_000_000_000n; // 9 decimals
export const CAP = 21_000_000n * ONE;
export const GENESIS = 2_100_000n * ONE;
export const EMISSION = CAP - GENESIS;
export const MAX_ERA = 64;
export const LINE_SLOTS = 8;
export const SETTLE_DELAY = 64;

export function r0(linesPerEra: number): bigint {
  return EMISSION / (2n * BigInt(linesPerEra));
}

export function eraOf(startLine: bigint, line: bigint, linesPerEra: number): number {
  if (line < startLine) return 0;
  return Number((line - startLine) / BigInt(linesPerEra));
}

export function rewardForLine(startLine: bigint, line: bigint, linesPerEra: number): bigint {
  const e = eraOf(startLine, line, linesPerEra);
  return e >= MAX_ERA ? 0n : r0(linesPerEra) >> BigInt(e);
}

/** First line of the next era: the next halving, as a line number. */
export function nextHalvingLine(startLine: bigint, line: bigint, linesPerEra: number): bigint {
  const e = eraOf(startLine, line, linesPerEra);
  return startLine + BigInt(e + 1) * BigInt(linesPerEra);
}

/** Σ R(L) for L in [first, last] (supply_check.py schedule_sum). */
export function scheduleSum(start: bigint, first: bigint, last: bigint, linesPerEra: number): bigint {
  if (last < first) return 0n;
  const n = BigInt(linesPerEra);
  const base = r0(linesPerEra);
  let total = 0n;
  let lo = first - start;
  const hi = last - start;
  while (lo <= hi) {
    const e = lo / n;
    if (e >= BigInt(MAX_ERA)) break;
    const eraEnd = hi < (e + 1n) * n - 1n ? hi : (e + 1n) * n - 1n;
    total += (eraEnd - lo + 1n) * (base >> e);
    lo = eraEnd + 1n;
  }
  return total;
}
