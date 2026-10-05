import { MEASURED_SLOT_SECONDS } from "./config";

/** Base units (9 decimals) → "1,234.567890123". */
export function amount(n: bigint, decimals = 9): string {
  const neg = n < 0n;
  const v = neg ? -n : n;
  const d = 10n ** BigInt(decimals);
  const whole = (v / d).toLocaleString("en-US");
  const frac = (v % d).toString().padStart(decimals, "0");
  return `${neg ? "-" : ""}${whole}.${frac}`;
}

/** Same, cut to `places` decimals for headline figures. */
export function amountShort(n: bigint, places = 2): string {
  const full = amount(n);
  const [w, f] = full.split(".");
  return places > 0 ? `${w}.${f.slice(0, places)}` : w;
}

export function int(n: bigint | number): string {
  return typeof n === "bigint" ? n.toLocaleString("en-US") : n.toLocaleString("en-US");
}

export function xnt(lamports: bigint): string {
  return amount(lamports, 9).replace(/\.?0+$/, "") + " XNT";
}

export function short(addr: string, n = 4): string {
  return addr.length > 2 * n + 1 ? `${addr.slice(0, n)}…${addr.slice(-n)}` : addr;
}

/** Approximate duration of `slots` at the measured slot time. */
export function slotsToDuration(slots: number | bigint): string {
  const s = Number(slots) * MEASURED_SLOT_SECONDS;
  if (s < 90) return `${Math.round(s)} s`;
  if (s < 5400) return `${Math.round(s / 60)} min`;
  if (s < 2 * 86400) return `${(s / 3600).toFixed(1)} h`;
  return `${(s / 86400).toFixed(1)} d`;
}

export function linesToDuration(lines: number | bigint): string {
  return slotsToDuration(Number(lines) * 8);
}

export function pct(hits: number, total: number): string {
  return total === 0 ? "—" : `${((100 * hits) / total).toFixed(1)}%`;
}

export function timeAgo(unixSeconds: number, now = Date.now() / 1000): string {
  const d = Math.max(0, now - unixSeconds);
  if (d < 60) return `${Math.round(d)} s ago`;
  if (d < 3600) return `${Math.round(d / 60)} min ago`;
  if (d < 86400) return `${(d / 3600).toFixed(1)} h ago`;
  return `${(d / 86400).toFixed(1)} d ago`;
}

export function utc(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().replace("T", " ").slice(0, 19) + " UTC";
}
