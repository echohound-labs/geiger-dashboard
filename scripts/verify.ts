/**
 * npm run verify — prints, as plain text, every value the pages show: the X1
 * mainnet oracle through lib/mainnet.ts, then X1 testnet through lib/chain.ts. Compare its output with
 * ~/entropy-token/scripts/supply_check.py and settle_crank.py (--plan) on the same
 * cluster; the figures must agree up to the slots that pass between the runs.
 * Read-only.
 */
import { getActivityView, getEntropyView, getMyNodeView, getNetworkView, getNodesView } from "../lib/chain";
import { MAINNET_ORACLE, NETWORK } from "../lib/config";
import { freshnessOf, getMainnetFeed, getMainnetNodes, getMainnetOracle, getMainnetPool, getMainnetRequests } from "../lib/mainnet";
import { amount, int, pct, xnt } from "../lib/format";
import { CAP, GENESIS } from "../lib/schedule";

const row = (k: string, v: unknown) => console.log(`${k.padEnd(28)} ${v}`);

async function main() {
  console.log(`# ${MAINNET_ORACLE.label} (GERO ${MAINNET_ORACLE.version})  ${MAINNET_ORACLE.rpcUrl}\n`);
  const [oracle, pool, req, nodes0, feed] = await Promise.all([
    getMainnetOracle(),
    getMainnetPool(),
    getMainnetRequests(),
    getMainnetNodes(),
    getMainnetFeed(),
  ]);
  const f = freshnessOf(oracle, feed.lastFinalize);
  console.log("## Oracle");
  row("slot", req.slot ?? "?");
  row("requests / fulfilled", `${oracle.totalRequests} / ${oracle.totalFulfillments}  paused=${oracle.paused}`);
  row("pending / expired", `${req.pending.length} / ${req.expired.length}`);
  row("pool", pool ? `${pool.filled}/32 head ${pool.head % 32} submissions ${pool.totalSubmissions}` : "unavailable");
  row("freshness", `${f.freshness} (${f.freshnessAgeS ?? "?"} s, bound ${f.poolAgeBoundS.toFixed(0)} s)`);
  for (const n of nodes0)
    row(`  node ${n.address.slice(0, 8)}`, `${n.name || "(no name)"} ${n.online ? "online" : "offline"} subs ${n.submissions} approved=${n.approved}${n.legacy ? " legacy" : ""}`);
  for (const t of feed.txs.slice(0, 6)) row(`  ${t.signature.slice(0, 8)}`, `${t.label}${t.failed ? " (failed)" : ""} fee ${t.feeLamports ?? "?"}`);

  console.log(`\n# ${NETWORK.label}  ${NETWORK.rpcUrl}\n`);

  const net = await getNetworkView();
  console.log("## Network");
  row("slot / current line", `${net.slot} / ${net.currentLine}`);
  row("oracle", `${net.live ? "LIVE" : "NOT LIVE"}  paused=${net.oracle.paused}  layout ${net.oracle.layout} (${net.oracle.length} B)`);
  row("program deploy slot", net.program?.deploySlot ?? "?");
  row("LineLog", net.lineLog ? `ABI ${net.lineLog.abiMajor}.${net.lineLog.abiMinor} H=${net.lineLog.h} defect=${net.lineLog.defect}` : "missing");
  row("newest on-time line", `${net.newestLine} (freshness ${net.freshnessLines} lines)`);
  row("ring: produced/verified", `${net.ringWindow.produced} / ${net.ringWindow.verified}  (requests ${net.ringWindow.withRequests}, dead ${net.ringWindow.dead})`);
  row("requests / fulfillments", `${net.oracle.totalRequests} / ${net.oracle.totalFulfillments}`);
  row("nodes online / listed", `${net.nodesOnline} / ${net.nodesListed}`);
  row("minter lines_paid", net.linesPaidSettled ?? "—");

  const nodes = await getNodesView();
  console.log("\n## Nodes");
  for (const n of nodes.nodes) {
    row(`slot ${n.index} operator`, n.operator);
    row("  status", `${n.status} ${n.statusNote}`);
    row("  payout", n.payout);
    row("  pending payout", n.pendingPayout ? `${n.pendingPayout.to} at slot ${n.pendingPayout.applySlot}` : "none");
    row("  active from line", n.activeFromLine ?? "—");
    row("  on-time", n.onTime ? `${n.onTime.hits}/${n.onTime.lines} = ${pct(n.onTime.hits, n.onTime.lines)} (lines ${n.onTime.first}..${n.onTime.last})` : "—");
    row("  stake", n.stakeLamports === null ? "—" : xnt(n.stakeLamports));
    row("  open-batch misses/slashes", `${n.missesOpen} / ${n.slashesOpen}`);
    row("  claim", n.claim ? `accrued ${amount(n.claim.accrued)}  claimed ${amount(n.claim.totalClaimed)}` : `none (${n.claimAddress})`);
  }

  const e = await getEntropyView();
  const s = e.state;
  console.log("\n## ENTROPY");
  row("cap / genesis", `${amount(CAP)} / ${amount(GENESIS)}`);
  row("mint supply", e.supply === null ? "?" : amount(e.supply));
  row("genesis+claimed+eco_claimed", amount(e.minted));
  row("total_accrued", amount(s.totalAccrued));
  row("claimable (claims + eco)", amount(e.stillClaimable));
  row("claimed / eco_claimed", `${amount(s.claimed)} / ${amount(s.ecoClaimed)}`);
  row("eco_accrued", amount(s.ecoAccrued));
  row("start_line / settled_through", `${s.startLine} / ${s.settledThrough}`);
  row("settle lag (current − settled)", int(e.settleLag));
  row("era / per-line", `${e.era} / ${amount(e.ratePerLine)}`);
  row("next halving line", `${e.nextHalvingLine} (${int(e.linesToHalving)} lines away)`);
  row("eco vault", `${e.ecoVault} balance ${e.ecoVaultBalance === null ? "none" : amount(e.ecoVaultBalance)}`);
  row("claim accounts", e.claimAccounts);
  row("lines paid/zero/lost", `${s.linesPaid} / ${s.linesZeroNode} / ${s.linesLost}  malformed ${s.linesMalformed} over_cap ${s.linesOverCap} no_reward ${s.linesNoReward}`);
  row("mint matches config", e.mintMatchesConfig);
  for (const c of e.checks) console.log(`  ${c.status.padEnd(4)} ${c.id.padEnd(4)} ${c.text}`);

  const a = await getActivityView(12);
  console.log("\n## Activity");
  for (const l of a.lines) row(`line ${l.line}`, "missing" in l ? "no entry" : `on_time ${l.onTimeMask.toString(2).padStart(8, "0")} flags ${l.flags.toString(2).padStart(4, "0")} prover ${l.prover ?? "—"}`);
  row("fulfillments (total)", a.totalFulfillments);
  for (const f of a.fulfillments.slice(0, 5)) row(`  ${f.address.slice(0, 8)}`, `line ${f.line} at ${new Date(f.fulfilledAt * 1000).toISOString()}`);
  for (const c of a.claims.slice(0, 10)) row(`  ${c.kind}`, `${amount(c.amount)} → ${c.destination} slot ${c.slot}`);

  const wallet = process.argv[2];
  if (wallet) {
    const m = await getMyNodeView(wallet);
    console.log("\n## My node");
    row("claim PDA", m.claimAddress);
    row("claim", m.claim ? `accrued ${amount(m.claim.accrued)} total_claimed ${amount(m.claim.totalClaimed)}` : "no claim account yet");
    row("payout of slots", m.payoutSlots.join(", ") || "none");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
