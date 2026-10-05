import { EntropyBanner } from "@/components/network";
import { WalletContextProvider } from "@/components/wallet-provider";
import { netParam, type NetParams } from "@/lib/networks";

// Every testnet page shows ENTROPY figures (tENTROPY), so every one carries the banner.
// The wallet connects to X1 testnet only, so its provider wraps the testnet pages only.
export default function NetworkLayout({ children, params }: NetParams & { children: React.ReactNode }) {
  if (netParam({ params }) === "mainnet") return <>{children}</>;
  return (
    <WalletContextProvider>
      <EntropyBanner />
      {children}
    </WalletContextProvider>
  );
}
