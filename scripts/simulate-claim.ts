/**
 * npm run simulate-claim PAYEE [with-ata-ix] — simulates (sigVerify off) the exact claim
 * transaction the My node page builds for PAYEE (payer = payee): the optional ATA
 * CreateIdempotent, then claim. Nothing is signed or sent. "with-ata-ix" adds the ATA
 * instruction even if the ATA exists, to check that it is a no-op there.
 */
import { Connection, PublicKey } from "@solana/web3.js";
import { getMinterState } from "../lib/chain";
import { NETWORK } from "../lib/config";
import { CU, buildTx, claimPda, ixClaim, ixCreateAtaIdempotent, readU64, simulate, token2022Ata } from "../lib/tx";

async function main() {
const payee = new PublicKey(process.argv[2]);
const forceCreate = process.argv[3] === "with-ata-ix";
const conn = new Connection(NETWORK.rpcUrl, "confirmed");
const state = await getMinterState();
if (!state) throw new Error("the minter is not initialized");
console.log("mint", state.mint, "== config", state.mint === NETWORK.entropyMint);
const mint = new PublicKey(state.mint);
const ata = token2022Ata(payee, mint);
const ataInfo = await conn.getAccountInfo(ata);
console.log("ATA", ata.toBase58(), ataInfo ? `exists, balance ${readU64(ataInfo.data, 64)}` : "missing");
const ixs = ataInfo && !forceCreate ? [] : [ixCreateAtaIdempotent(payee, payee, mint)];
ixs.push(ixClaim(payee, payee, mint));
const built = await buildTx(conn, payee, ixs, CU.claim);
const sim = await simulate(conn, built, [claimPda(payee), ata]);
console.log("ok", sim.ok, "error", sim.error, "CU", sim.unitsConsumed, "ixs", ixs.length);
const c = sim.accounts[0].after;
console.log("claim accrued after", c ? readU64(c.data, 48) : null, "total_claimed after", c ? readU64(c.data, 56) : null);
console.log("ATA balance after", sim.accounts[1].after ? readU64(sim.accounts[1].after.data, 64) : null);
console.log(sim.logs.filter((l) => /J79s|Token|ATok|Error|log:/.test(l)).join("\n"));
}
main();
