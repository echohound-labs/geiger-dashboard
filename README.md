# gero-hub

**Private.** Read-only dashboard for the GERO oracle and the ENTROPY minter. Stage 1: no transactions, no signing.

Next.js 14 (App Router) + TypeScript + Tailwind. Same layout as `houndtag-site`.

```
npm install
npm run dev            # http://localhost:3000
npm run build && npm start
npm run verify [WALLET]  # prints every value the pages show, read through lib/chain.ts
```

## Layout

| path | what |
|---|---|
| `lib/config.ts` | every address; X1 testnet filled, mainnet block empty until launch. `NEXT_PUBLIC_GERO_NETWORK`, `NEXT_PUBLIC_X1_RPC_URL` |
| `lib/chain.ts` | the only RPC boundary: typed decoders for MinterState, Claimable, OracleState, NodeStream(+Ext), LineLog, LineBatch, RandomnessRequest, plus one view function per page. Isomorphic (the My node page uses it from the browser) |
| `lib/schedule.ts` | cap, genesis, era, per-line emission, schedule sum |
| `app/*` | Network, Nodes, ENTROPY, My node, Activity, About |
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
- Wording: no "trustless", "provably fair", "unbiasable", "independent audit", "open source", or yield/price language.
  User-facing text stays within `ENTROPY_WHITEPAPER_v0.1.md`.
