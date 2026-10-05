import { AutoRefresh } from "@/components/auto-refresh";
import { Addr, Badge, ErrorPanel, Grid, KV, PageTitle, Panel, Stat, type Tone } from "@/components/ui";
import { getEntropyView, type CheckStatus, type EntropyView } from "@/lib/chain";
import { NETWORK } from "@/lib/config";
import { amount, amountShort, int, linesToDuration } from "@/lib/format";
import { CAP, GENESIS, SETTLE_DELAY } from "@/lib/schedule";

export const dynamic = "force-dynamic";
export const metadata = { title: "ENTROPY" };

const checkTone: Record<CheckStatus, Tone> = { PASS: "good", WARN: "warn", FAIL: "bad" };

export default async function EntropyPage() {
  let v: EntropyView;
  try {
    v = await getEntropyView();
  } catch (e) {
    return (
      <>
        <PageTitle title="ENTROPY" network="testnet" />
        <ErrorPanel error={e} />
      </>
    );
  }
  const s = v.state;
  const sym = NETWORK.symbol;
  const failed = v.checks.some((c) => c.status === "FAIL");
  const lagTone: Tone = v.matureLag > 1000n ? "bad" : v.matureLag > 100n ? "warn" : "good";
  return (
    <>
      <PageTitle
        network="testnet"
        title="ENTROPY"
        sub={`Minter state, emission schedule and a live supply check (${sym}).`}
        right={<AutoRefresh renderedAt={Date.now()} />}
      />
      {!v.mintMatchesConfig && (
        <div className="mb-3 rounded-md border border-term-red/40 p-3 font-mono text-sm text-term-red">
          MinterState.mint {s.mint} does not match the configured mint {NETWORK.entropyMint}.
        </div>
      )}
      <Grid>
        <Stat label="Total minted" value={v.supply === null ? "?" : amountShort(v.supply)} sub={`mint supply, ${sym}`} />
        <Stat label="Cap" value={amountShort(CAP, 0)} sub={`genesis ${amountShort(GENESIS, 0)}`} />
        <Stat label="Era" value={v.era} sub={`${amount(v.ratePerLine)} ${sym} per line`} />
        <Stat label="Next halving" value={`line ${int(v.nextHalvingLine)}`} sub={`${int(v.linesToHalving)} lines away (≈ ${linesToDuration(v.linesToHalving)})`} />
      </Grid>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel
          title={`Supply check ${failed ? "· FAIL" : "· pass"}`}
          note="The chain-data checks of supply_check.py (S2–S6). The mint and program shape checks (S1, S7–S12) stay in the script."
        >
          <KV
            rows={[
              ["Genesis", amount(GENESIS)],
              ["+ claimed (nodes and provers)", amount(s.claimed)],
              ["+ claimed to the ecosystem vault", amount(s.ecoClaimed)],
              ["= minted", amount(v.minted)],
              ["Mint supply", v.supply === null ? "?" : amount(v.supply)],
              ["Still claimable", amount(v.stillClaimable)],
              ["Cap", amount(CAP)],
            ]}
          />
          <ul className="mt-3 space-y-1.5">
            {v.checks.map((c, i) => (
              <li key={i} className="flex items-start gap-2 font-mono text-[13px]">
                <Badge tone={checkTone[c.status]}>{c.status}</Badge>
                <span className="text-term-text3">{c.id}</span>
                <span className="text-term-text">{c.text}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="grid grid-cols-1 gap-3">
          <Panel
            title="Settlement"
            note={`A line is settled once it is ${SETTLE_DELAY} lines old. Lines that fall out of the ${"32,768"}-line record before the crank reaches them are counted lost and mint nothing.`}
          >
            <KV
              rows={[
                ["Start line (L0)", int(s.startLine)],
                ["Settled through", int(s.settledThrough)],
                ["Current line", int(v.currentLine)],
                [
                  "Settle cursor lag",
                  <span key="lag" className={lagTone === "good" ? "text-term-green" : lagTone === "warn" ? "text-term-amber" : "text-term-red"}>
                    {int(v.settleLag)} lines ({int(v.matureLag > 0n ? v.matureLag : 0n)} past maturity)
                  </span>,
                ],
                ["Lines paid", int(s.linesPaid)],
                ["Lines with zero on-time nodes", int(s.linesZeroNode)],
                ["Lines lost / malformed", `${int(s.linesLost)} / ${int(s.linesMalformed)}`],
                ["Shares unminted (no claim account)", `${int(s.sharesUnminted)} · ${amount(s.amountUnminted)}`],
              ]}
            />
          </Panel>
          <Panel title="Accounts">
            <KV
              rows={[
                ["Total accrued", amount(s.totalAccrued)],
                ["Ecosystem accrued, not yet minted", amount(s.ecoAccrued)],
                ["Eco-vault balance", v.ecoVaultBalance === null ? "no vault account yet" : amount(v.ecoVaultBalance)],
                ["Eco-vault token account", <Addr key="ev" value={v.ecoVault} />],
                ["Claim accounts", int(v.claimAccounts)],
                ["Mint", <Addr key="m" value={s.mint} />],
                ["Minter", <Addr key="mi" value={NETWORK.minterProgram} />],
              ]}
            />
          </Panel>
        </div>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-term-text3">
        Era and halving are counted in lines from L0: era = ⌊(line − L0) / {int(NETWORK.linesPerEra)}⌋, per-line emission =
        R0 &gt;&gt; era. Durations assume 0.3675 s per slot and move if the slot time does.
      </p>
    </>
  );
}
