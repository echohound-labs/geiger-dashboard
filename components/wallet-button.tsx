"use client";

import { useEffect, useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

/** Client-only after mount so the connect state never mismatches the server HTML. */
export function WalletButton() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <span className="gero-wallet-placeholder" aria-hidden="true" />;
  return (
    <span className="gero-wallet">
      <WalletMultiButton />
    </span>
  );
}
