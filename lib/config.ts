/**
 * lib/config.ts — every address and network constant the hub uses.
 *
 * The hub shows two networks side by side:
 *   X1 mainnet  GERO v8.1 (oracle only). MAINNET_ORACLE, read by lib/mainnet.ts.
 *   X1 testnet  GERO v9.1b and the ENTROPY minter (tENTROPY). NETWORK, read by
 *               lib/chain.ts and lib/tx.ts.
 * ENTROPY is not launched on mainnet, so the v9.1b + ENTROPY view reads X1
 * testnet only; there is no mainnet entry for it.
 *
 * NEXT_PUBLIC_X1_TESTNET_RPC_URL overrides the testnet RPC endpoint (also used
 * by the wallet in the browser). X1_MAINNET_RPC_URL overrides the mainnet one
 * (server only).
 */

export type NetworkName = "testnet" | "mainnet";

export interface NetworkConfig {
  name: NetworkName;
  label: string;
  rpcUrl: string;
  /** GERO oracle program (owns OracleState, NodeStream, LineLog, requests). */
  geroProgram: string;
  /** entropy-minter program (MinterState, Claimable, mint authority PDA). */
  minterProgram: string;
  /** ENTROPY Token-2022 mint. Cross-checked against MinterState.mint. */
  entropyMint: string;
  /** eco-vault program; its ["eco_vault"] PDA owns the vault token account. */
  ecoVaultProgram: string;
  /** Token symbol shown in the UI. */
  symbol: string;
  /**
   * Lines per era of the deployed minter build. The testnet build is NOT the
   * test-schedule build (docs/TESTNET_RUNBOOK.md), so both use the real N.
   */
  linesPerEra: number;
  /** Block explorer base URL and the query that selects this cluster. */
  explorer: string;
  explorerQuery: string;
}

export const TESTNET: NetworkConfig = {
  name: "testnet",
  label: "X1 Testnet",
  rpcUrl: process.env.NEXT_PUBLIC_X1_TESTNET_RPC_URL || "https://rpc.testnet.x1.xyz",
  geroProgram: "2dQf9uaCzXewrDNLttmtzQmc3SmqfAHz3qahKQjtGQyY",
  minterProgram: "J79sxwNizAqFpTaXR9C5EAokhYDKW4JkYL4txAq5qAwS",
  entropyMint: "85xvCxwKSns83kbwjqykAuSgVyAd3ZDdYfgVEfTCGtNm",
  ecoVaultProgram: "F7pxRZZcBwHoB19SLRfSe5vSsCPMNDqimu2YMo8ngEHv",
  symbol: "tENTROPY",
  linesPerEra: 16_089_796,
  explorer: "https://explorer.x1.xyz",
  explorerQuery: "?cluster=testnet",
};

/** The v9.1b + ENTROPY view. Always X1 testnet. */
export const NETWORK: NetworkConfig = TESTNET;

/** GERO v8.1 on X1 mainnet: the live oracle. Addresses from the v8.1 dashboard. */
export const MAINNET_ORACLE = {
  label: "X1 Mainnet",
  version: "v8.1",
  rpcUrl: process.env.X1_MAINNET_RPC_URL || "https://rpc.mainnet.x1.xyz",
  program: "BxUNg2yo5371BQMZPkfcxdCptFRDHkhvEXNM1QNPBRYU",
  /** ["oracle_state"] under the program. */
  oracleState: "BygMTZ1oLBD9tDmssnt9LkNT7BEd2PCJBCzurwtMuTqm",
  /** ["entropy_pool"] under the program. */
  entropyPool: "GDECYXCXietabJs9Y1baKzD3t4VFBw4eZWPnvYenyi77",
  /** The node operator whose transactions make up the live feed. */
  operator: "HGFisVbULNKqogtPuGTfcHG9y6i5nboZabYwifkiiodo",
  explorer: "https://explorer.x1.xyz",
} as const;

export function mainnetTx(signature: string): string {
  return `${MAINNET_ORACLE.explorer}/tx/${signature}`;
}

export function mainnetAddress(address: string): string {
  return `${MAINNET_ORACLE.explorer}/address/${address}`;
}

/** Fields that must be set before the selected network can be read. */
export function missingConfig(cfg: NetworkConfig = NETWORK): string[] {
  const keys = ["rpcUrl", "geroProgram", "minterProgram", "entropyMint", "ecoVaultProgram"] as const;
  return keys.filter((k) => !cfg[k]);
}

/**
 * Write buttons (open_claim, claim) are enabled on X1 testnet only. This is an
 * allowlist, not a mainnet check: any other config keeps them disabled with a
 * "not before launch" note.
 */
export function writesAllowed(cfg: NetworkConfig = NETWORK): boolean {
  return cfg.name === "testnet" && missingConfig(cfg).length === 0;
}

export function explorerTx(signature: string, cfg: NetworkConfig = NETWORK): string {
  return `${cfg.explorer}/tx/${signature}${cfg.explorerQuery}`;
}

export function explorerAddress(address: string, cfg: NetworkConfig = NETWORK): string {
  return `${cfg.explorer}/address/${address}${cfg.explorerQuery}`;
}

// Programs every cluster shares.
export const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
export const ATA_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
export const LOADER_V3 = "BPFLoaderUpgradeab1e11111111111111111111111";

/**
 * Measured X1 mainnet slot time (white paper §5.5). Used ONLY to turn slot
 * counts into approximate durations; every schedule figure is in lines/slots.
 */
export const MEASURED_SLOT_SECONDS = 0.3675;

/** Public ENTROPY white paper, served from public/. It carries the "Public for testnet testing" header. */
export const WHITE_PAPER_URL = "/ENTROPY_WHITEPAPER_v0.1.pdf";
