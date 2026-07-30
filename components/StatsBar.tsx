"use client";

import { useEffect, useRef, useState } from "react";
import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { ADDRESSES, VAULT_ABI, INSURANCE_POOL_ABI } from "@/lib/contracts";
import { useCountUp } from "@/lib/useCountUp";

const API_BASE = process.env.NEXT_PUBLIC_AGENT_API_URL || "http://localhost:3001";

function Stat({ label, target, prefix = "", decimals = 2, inView }: { label: string; target: number | null; prefix?: string; decimals?: number; inView: boolean }) {
  const animated = useCountUp(target ?? 0, inView && target !== null);
  const display = target === null ? "—" : `${prefix}${animated.toFixed(decimals)}`;

  return (
    <div className="text-center md:text-left">
      <div className="font-data text-3xl font-medium md:text-4xl">{display}</div>
      <div className="mt-1 text-sm text-subtle">{label}</div>
    </div>
  );
}

export function StatsBar() {
  const [activeAgents, setActiveAgents] = useState<number | null>(null);
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLElement>(null);

  const { data: totalDebt } = useReadContract({
    address: ADDRESSES.vault,
    abi: VAULT_ABI,
    functionName: "totalDebt",
    chainId: 5042002,
  });

  const { data: totalSupplyShares } = useReadContract({
    address: ADDRESSES.vault,
    abi: VAULT_ABI,
    functionName: "totalSupplyShares",
    chainId: 5042002,
  });

  const { data: exchangeRate } = useReadContract({
    address: ADDRESSES.vault,
    abi: VAULT_ABI,
    functionName: "getExchangeRate",
    chainId: 5042002,
  });

  const { data: reserveBalance } = useReadContract({
    address: ADDRESSES.insurancePool,
    abi: INSURANCE_POOL_ABI,
    functionName: "reserveBalance",
    chainId: 5042002,
  });

  useEffect(() => {
    fetch(`${API_BASE}/platform/active-agents-count`)
      .then((res) => res.json())
      .then((d) => setActiveAgents(d.count ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const rate = exchangeRate !== undefined ? Number(formatUnits(exchangeRate as bigint, 6)) : 1;
  const totalSuppliedValue = totalSupplyShares !== undefined ? Number(formatUnits(totalSupplyShares as bigint, 6)) * rate : null;
  const totalBorrowedValue = totalDebt !== undefined ? Number(formatUnits(totalDebt as bigint, 6)) : null;
  const reserveValue = reserveBalance !== undefined ? Number(formatUnits(reserveBalance as bigint, 6)) : null;

  return (
    <section ref={ref} className="hairline reveal border-t">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-6 py-12 md:grid-cols-4">
        <Stat label="Total supplied" target={totalSuppliedValue} prefix="$" inView={inView} />
        <Stat label="Total borrowed" target={totalBorrowedValue} prefix="$" inView={inView} />
        <Stat label="Insurance reserve" target={reserveValue} prefix="$" inView={inView} />
        <Stat label="Active agent rules" target={activeAgents} decimals={0} inView={inView} />
      </div>
    </section>
  );
}