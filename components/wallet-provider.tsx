"use client";

import { Buffer } from "buffer";
import { useMemo, type ReactNode } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { BackpackWalletAdapter } from "@solana/wallet-adapter-backpack";
import "@solana/wallet-adapter-react-ui/styles.css";
import { NETWORK } from "@/lib/config";

// web3.js paths reference a global Buffer; the browser has none.
if (typeof globalThis !== "undefined" && !(globalThis as { Buffer?: unknown }).Buffer) {
  (globalThis as { Buffer?: unknown }).Buffer = Buffer;
}

// Same setup as houndtag-site. Stage 1 only connects and reads the public key;
// all reads go through lib/chain.ts, nothing is signed. Stage 2 adds the
// open_claim / claim transactions through this provider's connection.
export function WalletContextProvider({ children }: { children: ReactNode }) {
  // An unconfigured network gets a local placeholder, never another cluster's RPC.
  const endpoint = NETWORK.rpcUrl || "http://127.0.0.1:8899";
  const wallets = useMemo(() => [new BackpackWalletAdapter()], []);
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
