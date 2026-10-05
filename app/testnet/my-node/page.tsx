import { MyNodePanel } from "@/components/my-node-panel";
import { PageTitle } from "@/components/ui";
import { WalletButton } from "@/components/wallet-button";

export const metadata = { title: "My node" };

export default function MyNodePage() {
  return (
    <>
      <PageTitle
        network="testnet"
        title="My node"
        sub="Connect a payout wallet to read its claim account, open it, and claim. Transactions run on X1 testnet only; each is simulated and shown before the wallet signs."
        right={<WalletButton />}
      />
      <MyNodePanel />
    </>
  );
}
