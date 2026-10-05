import { EntropyBanner } from "@/components/network";
import { WalletContextProvider } from "@/components/wallet-provider";

// Every testnet page shows ENTROPY figures (tENTROPY), so every one carries the banner.
// The wallet connects to X1 testnet only, so its provider lives here.
export default function TestnetLayout({ children }: { children: React.ReactNode }) {
  return (
    <WalletContextProvider>
      <EntropyBanner />
      {children}
    </WalletContextProvider>
  );
}
