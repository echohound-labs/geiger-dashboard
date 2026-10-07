/**
 * lib/config.ts — every address and network constant the hub uses.
 *
 * The hub shows two networks side by side, both running GERO v9.1c and both
 * read by lib/chain.ts:
 *   X1 mainnet  MAINNET: the oracle and its request fee. No line record and no
 *               ENTROPY yet (no LineLog, no minter, no claims); those come later.
 *   X1 testnet  TESTNET: the oracle, the line record and the ENTROPY minter
 *               (tENTROPY). NETWORK is an alias for it; lib/tx.ts writes to it only.
 *
 * NEXT_PUBLIC_X1_TESTNET_RPC_URL overrides the testnet RPC endpoint (also used
 * by the wallet in the browser). X1_MAINNET_RPC_URL overrides the mainnet one
 * (server only).
 */

/** Site name and tagline: sidebar brand and page titles. */
export const SITE_NAME = "GERO";
export const SITE_TAGLINE = "physical randomness on X1";
/** Public origin of the site: metadataBase, canonical URLs, Open Graph. */
export const SITE_URL = "https://gero.network";
/** GERO Network Telegram: footer, Overview buttons, node-operator contact. */
export const TELEGRAM_URL = "https://t.me/geronetwork";

export type NetworkName = "testnet" | "mainnet";

export interface NetworkConfig {
  name: NetworkName;
  label: string;
  rpcUrl: string;
  /** GERO oracle program (owns OracleState, NodeStream, LineBatch, requests, the fee pool and, where created, LineLog). */
  geroProgram: string;
  /** GERO version deployed at geroProgram, shown in the UI. The only place it is set. */
  geroVersion: string;
  /** Build hash of the deployed program, shown next to the version when known. */
  geroBuild?: string;
  /** entropy-minter program (MinterState, Claimable, mint authority PDA). Empty while ENTROPY is not on this network. */
  minterProgram: string;
  /** ENTROPY Token-2022 mint. Cross-checked against MinterState.mint. Empty while ENTROPY is not on this network. */
  entropyMint: string;
  /** eco-vault program; its ["eco_vault"] PDA owns the vault token account. Empty while ENTROPY is not on this network. */
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
  geroVersion: "v9.1c",
  minterProgram: "J79sxwNizAqFpTaXR9C5EAokhYDKW4JkYL4txAq5qAwS",
  entropyMint: "85xvCxwKSns83kbwjqykAuSgVyAd3ZDdYfgVEfTCGtNm",
  ecoVaultProgram: "F7pxRZZcBwHoB19SLRfSe5vSsCPMNDqimu2YMo8ngEHv",
  symbol: "tENTROPY",
  linesPerEra: 16_089_796,
  explorer: "https://explorer.x1.xyz",
  explorerQuery: "?cluster=testnet",
};

/**
 * GERO v9.1c on X1 mainnet (upgraded 2026-10-06, unpaused at slot 84,127,097).
 * Oracle and request fee only: the minter, mint and vault are empty until
 * ENTROPY launches, so hasEntropy(MAINNET) is false and every ENTROPY reader
 * returns "not on mainnet yet" instead of reading anything.
 */
export const MAINNET: NetworkConfig = {
  name: "mainnet",
  label: "X1 Mainnet",
  rpcUrl: process.env.X1_MAINNET_RPC_URL || "https://rpc.mainnet.x1.xyz",
  geroProgram: "BxUNg2yo5371BQMZPkfcxdCptFRDHkhvEXNM1QNPBRYU",
  geroVersion: "v9.1c",
  geroBuild: "4471baeb",
  minterProgram: "",
  entropyMint: "",
  ecoVaultProgram: "",
  symbol: "ENTROPY",
  linesPerEra: 16_089_796,
  explorer: "https://explorer.x1.xyz",
  explorerQuery: "",
};

/** The testnet GERO + ENTROPY view and the only write target. Always X1 testnet. */
export const NETWORK: NetworkConfig = TESTNET;

export const NETWORKS: Record<NetworkName, NetworkConfig> = { mainnet: MAINNET, testnet: TESTNET };

/** The config for a /[network] page. */
export function networkConfig(name: NetworkName): NetworkConfig {
  return NETWORKS[name];
}

/** Fields that must be set before GERO (the oracle) can be read on this network. */
export function missingConfig(cfg: NetworkConfig = NETWORK): string[] {
  const keys = ["rpcUrl", "geroProgram"] as const;
  return keys.filter((k) => !cfg[k]);
}

/** Fields that must be set before ENTROPY (minter, mint, vault, claims) can be read on this network. */
export function missingEntropyConfig(cfg: NetworkConfig = NETWORK): string[] {
  const keys = ["minterProgram", "entropyMint", "ecoVaultProgram"] as const;
  return keys.filter((k) => !cfg[k]);
}

/** True once ENTROPY is deployed on this network (false on mainnet until launch). */
export function hasEntropy(cfg: NetworkConfig = NETWORK): boolean {
  return missingEntropyConfig(cfg).length === 0;
}

/**
 * Write buttons (open_claim, claim) are enabled on X1 testnet only. This is an
 * allowlist, not a mainnet check: any other config keeps them disabled with a
 * "not before launch" note.
 */
export function writesAllowed(cfg: NetworkConfig = NETWORK): boolean {
  return cfg.name === "testnet" && missingConfig(cfg).length === 0 && hasEntropy(cfg);
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
 * Display names for node cards, by node (operator) key: the key in OracleState's node table on both networks.
 * Unmapped nodes are shown as "Node <slot>".
 */
export const NODE_NAMES: Record<string, string> = {
  HGFisVbULNKqogtPuGTfcHG9y6i5nboZabYwifkiiodo: "Genesis Node", // mainnet slot 0
  FB4jp1T1YB5ttaeCEvNisqPmVpqfQyet4WxN6HsQdqxh: "Genesis Node (testnet)", // testnet slot 0
};

/**
 * Measured X1 mainnet slot time (white paper §5.5). Used ONLY to turn slot
 * counts into approximate durations; every schedule figure is in lines/slots.
 */
export const MEASURED_SLOT_SECONDS = 0.3675;

/** Public ENTROPY white paper, served from public/. It carries the "Public for testnet testing" header. */
export const WHITE_PAPER_URL = "/ENTROPY_WHITEPAPER_v0.1.pdf";

/** Public GERO (oracle) white paper, served from public/. Page 1 carries "Draft. Public for testnet testing." */
export const GERO_WHITE_PAPER_URL = "/GERO_WHITEPAPER_v0.1.pdf";
