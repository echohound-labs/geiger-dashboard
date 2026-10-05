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
```

Optional environment variables: `X1_MAINNET_RPC_URL` (server only) and `NEXT_PUBLIC_X1_TESTNET_RPC_URL` (also used by
the wallet in the browser). Defaults are the public X1 RPC endpoints.

## Layout

| path | what |
|---|---|
| `lib/config.ts` | every address: `MAINNET_ORACLE` (GERO v8.1) and `TESTNET` (GERO v9.1b + minter) |
| `lib/mainnet.ts` | GERO v8.1 on X1 mainnet: OracleState, EntropyPool, RandomnessRequest, EntropyNode decoders and the operator feed, ported from the v8.1 dashboard |
| `lib/chain.ts` | the X1 testnet RPC boundary: typed decoders for MinterState, Claimable, OracleState, NodeStream(+Ext), LineLog, LineBatch, RandomnessRequest, plus one view function per page. Isomorphic (the My node page uses it from the browser) |
| `lib/schedule.ts` | cap, genesis, era, per-line emission, schedule sum |
| `app/page.tsx` | mainnet Oracle |
| `app/testnet/*` | testnet Network, Nodes, ENTROPY, My node, Activity; the layout adds the tENTROPY banner and the wallet |
| `app/about` | About, white paper link |
| `scripts/verify.ts` | text dump for cross-checking against `supply_check.py` / `settle_crank.py` |

Every layout comes from the program sources (GERO `lib.rs`, minter `state.rs` / `constants.rs` / `line_log.rs`) and the
entropy-token scripts; `lib/chain.ts` names the source of each one. Only displayed fields are decoded.

## Notes

- On-time rate: share of the last 2,048 final lines (older than the 32-line write cutoff) whose LineLog entry has the
  node's on-time bit, counted from the node's `node_active_from_line`.
- Slashes: counted from LineBatch accounts that are still open (closed 512 slots after their line). A lifetime count
  needs an indexer.
- Activity / claims: claim events come from RPC transaction history; `rpc.testnet.x1.xyz` keeps only about the last day
  (`getFirstAvailableBlock`), so older claims show only in the per-payee totals.
- Wording: user-facing text stays within the white paper. No claims about fairness guarantees, audits or licensing, and
  no return or price language.
