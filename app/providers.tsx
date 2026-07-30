"use client";

import { useEffect, useState } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { wagmiConfig } from "@/lib/wagmi";

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  // Wagmi's connection state genuinely differs between server and first client
  // render (a previously-connected wallet only becomes known client-side) —
  // this caused a real hydration mismatch. Waiting for mount, once here at the
  // root, protects every current and future page automatically.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{mounted ? children : null}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}