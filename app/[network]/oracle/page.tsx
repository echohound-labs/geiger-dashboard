import { netMetadata, netParam, type NetParams } from "@/lib/networks";
import { MainnetOracle } from "./mainnet";
import { TestnetOracle } from "./testnet";

export const dynamic = "force-dynamic";
export const generateMetadata = netMetadata("Oracle status");

export default function Page(p: NetParams) {
  return netParam(p) === "mainnet" ? <MainnetOracle /> : <TestnetOracle />;
}
