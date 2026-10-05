/**
 * lib/config.ts — every address and network constant the hub uses.
 *
 * X1 testnet is live. The mainnet block is left empty on purpose and is filled
 * in at launch; selecting it before then makes every page show a config error
 * instead of reading the wrong program.
 *
 * Select with NEXT_PUBLIC_GERO_NETWORK=testnet|mainnet (default testnet).
 * NEXT_PUBLIC_X1_RPC_URL overrides the RPC endpoint of the selected network.
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

export const NETWORKS: Record<NetworkName, NetworkConfig> = {
  testnet: {
    name: "testnet",
    label: "X1 Testnet",
    rpcUrl: "https://rpc.testnet.x1.xyz",
    geroProgram: "2dQf9uaCzXewrDNLttmtzQmc3SmqfAHz3qahKQjtGQyY",
    minterProgram: "J79sxwNizAqFpTaXR9C5EAokhYDKW4JkYL4txAq5qAwS",
    entropyMint: "85xvCxwKSns83kbwjqykAuSgVyAd3ZDdYfgVEfTCGtNm",
    ecoVaultProgram: "F7pxRZZcBwHoB19SLRfSe5vSsCPMNDqimu2YMo8ngEHv",
    symbol: "tENTROPY",
    linesPerEra: 16_089_796,
    explorer: "https://explorer.x1.xyz",
    explorerQuery: "?cluster=testnet",
  },
  // Filled in at launch. Leave empty until the mainnet minter is initialized.
  mainnet: {
    name: "mainnet",
    label: "X1 Mainnet",
    rpcUrl: "",
    geroProgram: "",
    minterProgram: "",
    entropyMint: "",
    ecoVaultProgram: "",
    symbol: "ENTROPY",
    linesPerEra: 16_089_796,
    explorer: "https://explorer.mainnet.x1.xyz",
    explorerQuery: "",
  },
};

function selectNetwork(): NetworkConfig {
  const name = (process.env.NEXT_PUBLIC_GERO_NETWORK ?? "testnet") as NetworkName;
  const base = NETWORKS[name] ?? NETWORKS.testnet;
  const rpcUrl = process.env.NEXT_PUBLIC_X1_RPC_URL || base.rpcUrl;
  return { ...base, rpcUrl };
}

export const NETWORK: NetworkConfig = selectNetwork();

/** Fields that must be set before the selected network can be read. */
export function missingConfig(cfg: NetworkConfig = NETWORK): string[] {
  const keys = ["rpcUrl", "geroProgram", "minterProgram", "entropyMint", "ecoVaultProgram"] as const;
  return keys.filter((k) => !cfg[k]);
}

/**
 * Write buttons (open_claim, claim) are enabled on X1 testnet only. Any other
 * selection, mainnet included, keeps them disabled with a "not before launch"
 * note; this is an allowlist, not a mainnet check.
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
