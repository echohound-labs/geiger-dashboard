/**
 * npm run verify — prints, as plain text, every value the pages show: X1
 * mainnet, then X1 testnet, both through lib/chain.ts. Compare the testnet ENTROPY
 * figures with ~/entropy-token/scripts/supply_check.py (and settle_crank.py --plan,
 * the backup settler) on the same cluster; the figures must agree up to the slots
 * that pass between the runs. Read-only.
 */
import {
  getActivityView,
  getEntropyView,
  getMyNodeView,
  getNetworkView,
  getNodesView,
  getOpenRequests,
} from "../lib/chain";
import { MAINNET, NETWORK, type NetworkConfig } from "../lib/config";
import { amount, int, pct, xnt } from "../lib/format";
import { CAP, GENESIS } from "../lib/schedule";

const row = (k: string, v: unknown) => console.log(`${k.padEnd(28)} ${v}`);

/** The GERO figures (Overview, Oracle status, Nodes, Activity) for one network. */
async function gero(cfg: NetworkConfig) {
  console.log(`# ${cfg.label} (GERO ${cfg.geroVersion}${cfg.geroBuild ? `, build ${cfg.geroBuild}` : ""})  ${cfg.rpcUrl}\n`);
  const net = await getNetworkView(cfg);
  const req = await getOpenRequests(net.slot, cfg);
  console.log("## Oracle");
  row("slot / current line", `${net.slot} / ${net.currentLine}`);
  row("oracle", `${net.live ? "LIVE" : "NOT LIVE"}  paused=${net.oracle.paused}  layout ${net.oracle.layout} (${net.oracle.length} B)`);
  row("verifier program", net.oracle.verifierProgram);
  row("request fee", `${net.oracle.requestFeeLamports} lamports = ${xnt(net.oracle.requestFeeLamports)}  set_on_chain=${net.oracle.feeSetOnChain}`);
  row("fee pool", net.feePool ? `${net.feePool.address} holds ${xnt(net.feePool.heldLamports)} (collected ${xnt(net.feePool.collectedLamports)})` : "not created");
  row("unswept in OracleState", xnt(net.oracle.unsweptFeeLamports));
  row("program deploy slot", net.program?.deploySlot ?? "?");
  row("LineLog", net.lineLog ? `ABI ${net.lineLog.abiMajor}.${net.lineLog.abiMinor} H=${net.lineLog.h} defect=${net.lineLog.defect}` : "missing (not on this network)");
  row("newest on-time line", net.lineLog ? `${net.newestLine} (freshness ${net.freshnessLines} lines)` : "—");
  row("commit lead", net.commitLead === null ? "—" : `${net.commitLead} lines`);
  row("ring: produced/verified", `${net.ringWindow.produced} / ${net.ringWindow.verified}  (requests ${net.ringWindow.withRequests}, dead ${net.ringWindow.dead})`);
  row("requests / fulfillments", `${net.oracle.totalRequests} / ${net.oracle.totalFulfillments}`);
  row("fulfil time (median)", net.fulfilSeconds ? `${net.fulfilSeconds.median} s over ${net.fulfilSeconds.sample}` : "—");
  row("open: recent/late/legacy", `${req.recent.length} / ${req.late.length} / ${req.legacy.length}`);
  for (const r of [...req.recent, ...req.late, ...req.legacy].slice(0, 12))
    row(`  ${r.kind} ${r.address.slice(0, 8)}`, `slot ${r.requestSlot} age ${r.ageSlots} line ${r.line} mask ${r.mask}`);
  row("nodes online / listed", `${net.nodesOnline} / ${net.nodesListed}`);
  row("minter lines_paid", net.linesPaidSettled ?? "—");

  const nodes = await getNodesView(2048, cfg);
  console.log("\n## Nodes");
  for (const n of nodes.nodes) {
    row(`slot ${n.index} operator`, n.operator);
    row("  status", `${n.status} ${n.statusNote}`);
    row("  committed through", n.committedThroughLine);
    row("  payout", n.payout);
    row("  pending payout", n.pendingPayout ? `${n.pendingPayout.to} at slot ${n.pendingPayout.applySlot}` : "none");
    row("  active from line", n.activeFromLine ?? "—");
    row("  on-time", n.onTime ? `${n.onTime.hits}/${n.onTime.lines} = ${pct(n.onTime.hits, n.onTime.lines)} (lines ${n.onTime.first}..${n.onTime.last})` : "—");
    row("  stake", n.stakeLamports === null ? "—" : xnt(n.stakeLamports));
    row("  open-batch misses/slashes", `${n.missesOpen} / ${n.slashesOpen}`);
    row("  claim", n.claim ? `accrued ${amount(n.claim.accrued)}  claimed ${amount(n.claim.totalClaimed)}` : n.claimAddress ? `none (${n.claimAddress})` : "ENTROPY not on this network");
  }

  const a = await getActivityView(12, cfg);
  console.log("\n## Activity");
  if (a.lines) for (const l of a.lines) row(`line ${l.line}`, "missing" in l ? "no entry" : `on_time ${l.onTimeMask.toString(2).padStart(8, "0")} flags ${l.flags.toString(2).padStart(4, "0")} prover ${l.prover ?? "—"}`);
  else row("lines", "no line record");
  for (const b of a.batches) row(`  batch line ${b.line}`, `bound ${b.boundSlot} mask ${b.mask} used ${b.usedMask} slashed ${b.slashedMask} dead ${b.dead}`);
  row("fulfillments (total)", a.totalFulfillments);
  for (const f of a.fulfillments.slice(0, 5)) row(`  ${f.address.slice(0, 8)}`, `line ${f.line} at ${new Date(f.fulfilledAt * 1000).toISOString()} took ${f.fulfilledAt - f.requestedAt} s`);
  for (const c of a.claims.slice(0, 10)) row(`  ${c.kind}`, `${amount(c.amount)} → ${c.destination} slot ${c.slot}`);
}

async function main() {
  await gero(MAINNET);
  console.log();
  await gero(NETWORK);

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
