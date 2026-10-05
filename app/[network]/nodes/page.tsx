import { netMetadata, netParam, type NetParams } from "@/lib/networks";
import { MainnetNodes } from "./mainnet";
import { TestnetNodes } from "./testnet";

export const dynamic = "force-dynamic";
export const generateMetadata = netMetadata("Nodes");

export default function Page(p: NetParams) {
  return netParam(p) === "mainnet" ? <MainnetNodes /> : <TestnetNodes />;
}
