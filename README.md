# GERO · physical randomness on X1

Dashboard for the GERO randomness oracle on X1. Live at https://gero.network. Community: https://t.me/geronetwork.

| network | what | pages |
|---|---|---|
| X1 mainnet | GERO v8.1, the live oracle: requests, fulfilled, nodes, pool freshness, recent transactions | `/mainnet/*` |
| X1 testnet | GERO v9.1c and the ENTROPY minter (tENTROPY, a test token with no value) | `/testnet/*` |

Every data page lives under `/[network]` (`overview`, `oracle`, `nodes`, `activity`, `integrations`, `entropy`, `claim`),
and the sidebar's Mainnet | Testnet switch keeps the page. ENTROPY is not launched on mainnet: `/mainnet/entropy` and
`/mainnet/claim` say so and link to testnet. Every testnet page carries the tENTROPY banner. Learn pages are under
`/learn/*` (How it works, How to test, White paper). The public white papers are served from `public/GERO_WHITEPAPER_v0.1.pdf` (the oracle) and
`public/ENTROPY_WHITEPAPER_v0.1.pdf` (the token); Learn → White papers lists both. Old routes redirect (`/` →
`/mainnet`, `/about` → `/learn/how-it-works`, `/testnet/my-node` → `/testnet/claim`; see `next.config.mjs`).

Light and dark themes come from CSS variables in `app/globals.css`; the default follows the device setting and a choice
is kept in localStorage.

Next.js 14 (App Router) + TypeScript + Tailwind, deployed on Vercel (`vercel.json` selects the Next.js preset) at
https://gero.network (`metadataBase` and the canonical URLs in `app/layout.tsx`).

Brand assets live in `public/` and are referenced from `app/layout.tsx`: `favicon.ico` (16/32/48 px), `favicon-16x16.png`,
`favicon-32x32.png`, `apple-touch-icon.png` (180×180) and `og.png` (1200×630, the Open Graph / Twitter card image).

```
npm install
npm run dev            # http://localhost:3000
npm run build && npm start
npm run verify [WALLET]  # prints every value the pages show (mainnet via lib/mainnet.ts, testnet via lib/chain.ts)
npm run simulate-claim PAYEE [with-ata-ix]  # simulates the Claim page's tx for PAYEE on testnet; signs and sends nothing
```

Optional environment variables: `X1_MAINNET_RPC_URL` (server only) and `NEXT_PUBLIC_X1_TESTNET_RPC_URL` (also used by
the wallet in the browser). Defaults are the public X1 RPC endpoints.

## Layout

| path | what |
|---|---|
| `lib/config.ts` | every address: `MAINNET_ORACLE` (GERO v8.1) and `TESTNET` (GERO v9.1c + minter; `TESTNET.geroVersion` is the version the UI shows) |
| `lib/mainnet.ts` | GERO v8.1 on X1 mainnet: OracleState, EntropyPool, RandomnessRequest, EntropyNode decoders and the operator feed, ported from the v8.1 dashboard. One reader per data set (`getMainnetOracle` / `Pool` / `Requests` / `Nodes` / `Feed`); each page calls only the ones it shows |
| `lib/chain.ts` | the X1 testnet RPC boundary: typed decoders for MinterState, Claimable, OracleState, NodeStream(+Ext), LineLog, LineBatch, RandomnessRequest, plus one view function per page. Isomorphic (the Claim page uses it from the browser) |
| `lib/tx.ts` | the only write path (X1 testnet): `open_claim`, `claim`, ATA `CreateIdempotent` builders (layouts from `minter_init.py` and the program's Accounts structs), build → simulate → sign → send → confirm |
| `components/tx-runner.tsx` | UI for one write: Simulate, show result / error / logs, then Sign and send |
| `lib/schedule.ts` | cap, genesis, era, per-line emission, schedule sum |
| `lib/networks.ts` | the `/[network]` segment: `mainnet` or `testnet`, 404 otherwise; same page on the other network |
| `app/[network]/page.tsx` | Overview: GERO and ENTROPY cards for the selected network |
| `app/[network]/<page>/{mainnet,testnet}.tsx` | each page's view per network; `page.tsx` picks one. The layout adds the tENTROPY banner and the wallet on testnet |
| `app/learn/*` | How it works (GERO / ENTROPY / Nodes), How to test, White papers (GERO and ENTROPY, summary + PDF each) |
| `components/footer.tsx` | footer on every page: no-audit / no-legal-review warning, GitHub link, program addresses per network |
| `components/node-card.tsx` | node cards, the on-time sparkline and the Become a node operator box |
| `components/claim-lookup.tsx` | read-only claim-account lookup for any address (no wallet) |
| `components/ui.tsx` | panels, stats, tables, badges and the collapsed `Details` box used for internals |
| `components/sidebar.tsx` | sidebar: network switch, sections, theme toggle; collapses to icons, a drawer on mobile |
| `scripts/verify.ts` | text dump for cross-checking against `supply_check.py` / `settle_crank.py` |
| `scripts/simulate-claim.ts` | simulation-only check of the claim transaction for any payee |

Every layout comes from the program sources (GERO `lib.rs`, minter `state.rs` / `constants.rs` / `line_log.rs`) and the
entropy-token scripts; `lib/chain.ts` names the source of each one. Only displayed fields are decoded.

## Transactions (testnet Claim page)

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
