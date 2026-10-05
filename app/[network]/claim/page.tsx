import { NotOnMainnet } from "@/components/network";
import { netMetadata, netParam, type NetParams } from "@/lib/networks";
import { TestnetClaim } from "./testnet";

export const generateMetadata = netMetadata("Claim");

// Claims run on X1 testnet only (writesAllowed in lib/config.ts); mainnet shows the not-launched note.
export default function Page(p: NetParams) {
  return netParam(p) === "mainnet" ? <NotOnMainnet title="Claim" testnetHref="/testnet/claim" /> : <TestnetClaim />;
}
