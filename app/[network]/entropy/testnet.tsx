import { AutoRefresh } from "@/components/auto-refresh";
import { Addr, Badge, Details, ErrorPanel, Grid, KV, PageTitle, Panel, Stat, SubHead, type Tone } from "@/components/ui";
import { getEntropyView, type CheckStatus, type EntropyView } from "@/lib/chain";
import { NETWORK } from "@/lib/config";
import { amount, amountShort, int, linesToDuration } from "@/lib/format";
import { CAP, GENESIS, SETTLE_DELAY } from "@/lib/schedule";

const checkTone: Record<CheckStatus, Tone> = { PASS: "good", WARN: "warn", FAIL: "bad" };

/** White-paper launch plan for mainnet ENTROPY (sections 4, 8 and 17). */
export function LaunchPlan() {
  const rows: [string, string][] = [
    ["Genesis liquidity", "10% of the cap, 2,100,000 ENTROPY, minted once and paired with 2,000 XNT on Forge Swap."],
    ["Liquidity tokens", "60% of the pool's LP tokens are burned; 40% are locked for 12 months in an immutable lock program."],
    ["Mined supply", "The other 90%, 18,900,000 ENTROPY, exists only as it is mined line by line by on-time nodes and provers."],
    ["When", "Genesis happens only once 2–3 independent nodes are live, so that early emission is not concentrated in one node."],
    ["Mainnet mint", "Reserved at zero supply and not launched. Nothing is initialized; addresses are published at launch."],
  ];
  return (
    <Panel title="Launch plan" tag={<Badge tone="muted">mainnet · not launched</Badge>}>
      <dl className="space-y-2.5 text-sm leading-relaxed">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-1 gap-0.5 sm:grid-cols-[11rem_1fr] sm:gap-4">
            <dt className="font-mono text-term-green">{k}</dt>
            <dd className="text-term-text2">{v}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

export async function TestnetEntropy() {
  let v: EntropyView;
  try {
    v = await getEntropyView();
  } catch (e) {
    return (
      <>
        <PageTitle title="Token & supply" network="testnet" />
        <ErrorPanel error={e} />
      </>
    );
  }
  const s = v.state;
  const sym = NETWORK.symbol;
  const failed = v.checks.some((c) => c.status === "FAIL");
  const warned = v.checks.some((c) => c.status === "WARN");
  const lagTone: Tone = v.matureLag > 1000n ? "bad" : v.matureLag > 100n ? "warn" : "good";
  return (
    <>
      <PageTitle
        network="testnet"
        title="Token & supply"
        sub={`${sym} on X1 testnet: supply, emission schedule and a live supply check.`}
        right={<AutoRefresh renderedAt={Date.now()} />}
      />
      {!v.mintMatchesConfig && (
        <div className="mb-3 rounded-md border border-term-red/40 p-3 font-mono text-sm text-term-red">
          MinterState.mint {s.mint} does not match the configured mint {NETWORK.entropyMint}.
        </div>
      )}
      <Grid cols={3}>
        <Stat label="Total minted" value={v.supply === null ? "?" : amountShort(v.supply)} sub={`mint supply, ${sym}`} />
        <Stat label="Cap" value={amountShort(CAP, 0)} sub={`genesis ${amountShort(GENESIS, 0)}`} />
        <Stat label="Era" value={v.era} sub="halves at every era boundary" />
        <Stat label="Per-line rate" value={amount(v.ratePerLine)} sub={`${sym} per line, shared by that line's payees`} />
        <Stat label="Next halving" value={`line ${int(v.nextHalvingLine)}`} sub={`${int(v.linesToHalving)} lines away (≈ ${linesToDuration(v.linesToHalving)})`} />
        <Stat
          label="Eco-vault balance"
          value={v.ecoVaultBalance === null ? "—" : amountShort(v.ecoVaultBalance)}
          sub={v.ecoVaultBalance === null ? "no vault account yet" : `${sym} in the ecosystem vault`}
        />
      </Grid>

      <Panel
        className="mt-3"
        title="Live supply check"
        tag={<Badge tone={failed ? "bad" : warned ? "warn" : "good"}>{failed ? "fail" : warned ? "pass, with warnings" : "pass"}</Badge>}
        note="Re-run on every page load from chain data: the same chain-data checks as the public supply_check.py script (S2–S6). Its mint and program shape checks (S1, S7–S12) stay in the script."
      >
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-2">
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
          <ul className="space-y-2">
            {v.checks.map((c, i) => (
              <li key={i} className="flex items-start gap-2 font-mono text-[13px]">
                <Badge tone={checkTone[c.status]}>{c.status}</Badge>
                <span className="text-term-text3">{c.id}</span>
                <span className="min-w-0 break-words text-term-text">{c.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </Panel>

      <div className="mt-3">
        <LaunchPlan />
      </div>

      <Details className="mt-3">
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-2">
          <div>
            <SubHead>Settlement</SubHead>
            <KV
              rows={[
                ["Start line (L0)", int(s.startLine)],
                ["Settled through (cursor)", int(s.settledThrough)],
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
            <p className="mt-2 text-xs leading-relaxed text-term-text3">
              A line is settled once it is {SETTLE_DELAY} lines old. Lines that fall out of the 32,768-line record before
              settlement reaches them are counted lost and mint nothing.
            </p>
          </div>
          <div>
            <SubHead>Accounts</SubHead>
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
            <p className="mt-2 text-xs leading-relaxed text-term-text3">
              Era and halving count lines from L0: era = ⌊(line − L0) / {int(NETWORK.linesPerEra)}⌋, per-line emission =
              R0 &gt;&gt; era. Durations assume 0.3675 s per slot and move if the slot time does.
            </p>
          </div>
        </div>
      </Details>
    </>
  );
}
