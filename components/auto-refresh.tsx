"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Re-renders the server page every `seconds` (router.refresh keeps client state). */
export function AutoRefresh({ seconds = 20, renderedAt }: { seconds?: number; renderedAt: number }) {
  const router = useRouter();
  const [age, setAge] = useState(0);
  useEffect(() => {
    setAge(0);
    const tick = setInterval(() => setAge(Math.round((Date.now() - renderedAt) / 1000)), 1000);
    const refresh = setInterval(() => router.refresh(), seconds * 1000);
    return () => {
      clearInterval(tick);
      clearInterval(refresh);
    };
  }, [router, seconds, renderedAt]);
  return (
    <span className="font-mono text-xs text-term-text3" suppressHydrationWarning>
      read {age}s ago · refresh every {seconds}s
    </span>
  );
}
