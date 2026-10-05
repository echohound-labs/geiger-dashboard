# GERO Hub

Dashboard for the GERO randomness oracle on X1.

| network | what | pages |
|---|---|---|
| X1 mainnet | GERO v8.1, the live oracle: requests, fulfilled, nodes, pool freshness, recent transactions | `/` |
| X1 testnet | GERO v9.1b and the ENTROPY minter (tENTROPY, a test token with no value) | `/testnet/*` |

ENTROPY is not launched on mainnet. Every page shows which network it reads; every ENTROPY page carries the tENTROPY
banner. The public white paper is served from `public/ENTROPY_WHITEPAPER_v0.1.pdf` and linked from About.

Next.js 14 (App Router) + TypeScript + Tailwind, deployed on Vercel (`vercel.json` selects the Next.js preset).

```
npm install
npm run dev            # http://localhost:3000
npm run build && npm start
npm run verify [WALLET]  # prints every value the pages show (mainnet via lib/mainnet.ts, testnet via lib/chain.ts)
npm run simulate-claim PAYEE [with-ata-ix]  # simulates the My node claim tx for PAYEE on testnet; signs and sends nothing
```

Optional environment variables: `X1_MAINNET_RPC_URL` (server only) and `NEXT_PUBLIC_X1_TESTNET_RPC_URL` (also used by
the wallet in the browser). Defaults are the public X1 RPC endpoints.

## Layout

| path | what |
|---|---|
| `lib/config.ts` | every address: `MAINNET_ORACLE` (GERO v8.1) and `TESTNET` (GERO v9.1b + minter) |
| `lib/mainnet.ts` | GERO v8.1 on X1 mainnet: OracleState, EntropyPool, RandomnessRequest, EntropyNode decoders and the operator feed, ported from the v8.1 dashboard |
| `lib/chain.ts` | the X1 testnet RPC boundary: typed decoders for MinterState, Claimable, OracleState, NodeStream(+Ext), LineLog, LineBatch, RandomnessRequest, plus one view function per page. Isomorphic (the My node page uses it from the browser) |
| `lib/tx.ts` | the only write path (X1 testnet): `open_claim`, `claim`, ATA `CreateIdempotent` builders (layouts from `minter_init.py` and the program's Accounts structs), build → simulate → sign → send → confirm |
| `components/tx-runner.tsx` | UI for one write: Simulate, show result / error / logs, then Sign and send |
| `lib/schedule.ts` | cap, genesis, era, per-line emission, schedule sum |
| `app/page.tsx` | mainnet Oracle |
| `app/testnet/*` | testnet Network, Nodes, ENTROPY, My node, Activity; the layout adds the tENTROPY banner and the wallet |
| `app/about` | About, white paper link |
| `scripts/verify.ts` | text dump for cross-checking against `supply_check.py` / `settle_crank.py` |
| `scripts/simulate-claim.ts` | simulation-only check of the claim transaction for any payee |

Every layout comes from the program sources (GERO `lib.rs`, minter `state.rs` / `constants.rs` / `line_log.rs`) and the
entropy-token scripts; `lib/chain.ts` names the source of each one. Only displayed fields are decoded.

## Transactions (testnet My node page)

- **X1 testnet only.** Mainnet is read-only (GERO v8.1; ENTROPY is not launched). `writesAllowed()` in `lib/config.ts`
  is an allowlist on the `TESTNET` config; anything else shows "not before launch" and `lib/tx.ts` refuses to build or
  send.
- **Simulate first.** Every transaction is simulated (sigVerify off) and the result, CU, error and logs are shown before
  the wallet is asked to sign. The sign button exists only after a successful simulation. If the wallet returns a
  different message than the one simulated (e.g. it added a priority fee), nothing is sent. After confirmation the page
  keeps the signature with an explorer link and re-reads its figures.
- **The connected wallet is payer, payee and only signer.** `open_claim` is shown only when `["claim", wallet]` does not
  exist; it costs the 64-byte account's rent (claim accounts are never closed) plus the fee. `claim` is shown only when
  claimable > 0 and mints to the wallet's own Token-2022 ATA, which is created in the same transaction if missing.
- `claim_ecosystem` is deliberately not in the UI.
- A ⚠ badge marks testnet nodes whose payout address is the operator (hot node) key; mainnet payout must be a cold,
  browser-connectable wallet distinct from the node key.

## Notes

- On-time rate: share of the last 2,048 final lines (older than the 32-line write cutoff) whose LineLog entry has the
  node's on-time bit, counted from the node's `node_active_from_line`.
- Slashes: counted from LineBatch accounts that are still open (closed 512 slots after their line). A lifetime count
  needs an indexer.
- Activity / claims: claim events come from RPC transaction history; `rpc.testnet.x1.xyz` keeps only about the last day
  (`getFirstAvailableBlock`), so older claims show only in the per-payee totals.
- Wording: user-facing text stays within the white paper. No claims about fairness guarantees, audits or licensing, and
  no return or price language.
