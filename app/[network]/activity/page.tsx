import { netMetadata, netParam, type NetParams } from "@/lib/networks";
import { MainnetActivity } from "./mainnet";
import { TestnetActivity } from "./testnet";

export const dynamic = "force-dynamic";
export const generateMetadata = netMetadata("Activity");

export default function Page(p: NetParams) {
  return netParam(p) === "mainnet" ? <MainnetActivity /> : <TestnetActivity />;
}
