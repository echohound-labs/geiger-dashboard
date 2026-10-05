import { NotOnMainnet } from "@/components/network";
import { netMetadata, netParam, type NetParams } from "@/lib/networks";
import { LaunchPlan, TestnetEntropy } from "./testnet";

export const dynamic = "force-dynamic";
export const generateMetadata = netMetadata("Token & supply");

export default function Page(p: NetParams) {
  return netParam(p) === "mainnet" ? (
    <NotOnMainnet title="Token & supply" testnetHref="/testnet/entropy">
      <LaunchPlan />
    </NotOnMainnet>
  ) : <TestnetEntropy />;
}
