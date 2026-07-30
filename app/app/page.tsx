"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { AlertTriangle, ShieldCheck, Clock } from "lucide-react";
import { ADDRESSES, VAULT_ABI, AGENT_AUTH_ABI, POOL_ABI } from "@/lib/contracts";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { PageHeader } from "@/components/PageHeader";

const API_BASE = process.env.NEXT_PUBLIC_AGENT_API_URL || "http://localhost:3001";

const GUARDIAN_WALLET_ADDRESS = "0xf7c2e43078ded0045b05289e86421ac2dab90a35" as const;

// Matches Guardian's own thresholds exactly (guardian-loop.ts) — this display
// reads the same on-chain source Guardian itself checks, so it's never showing
// a different number than what's actually driving Guardian's real decisions.
const WARNING_THRESHOLD_BPS = 7000;
const DANGER_THRESHOLD_BPS = 7500;

export default function DashboardPage() {
  const { address, isConnected } = useAccount();

  const { data: utilizationBps } = useReadContract({
    address: ADDRESSES.vault,
    abi: VAULT_ABI,
    functionName: "getUtilizationBps",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15000 },
    chainId: 5042002,
  });

  const { data: debt } = useReadContract({
    address: ADDRESSES.vault,
    abi: VAULT_ABI,
    functionName: "debt",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
    chainId: 5042002,
  });

  const { data: collateralValueUSD } = useReadContract({
    address: ADDRESSES.vault,
    abi: VAULT_ABI,
    functionName: "getCollateralValueUSD",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
    chainId: 5042002,
  });

  const { data: guardianAuth } = useReadContract({
    address: ADDRESSES.agentAuth,
    abi: AGENT_AUTH_ABI,
    functionName: "authorizations",
    args: address ? [address, GUARDIAN_WALLET_ADDRESS] : undefined,
    query: { enabled: !!address },
    chainId: 5042002,
  });

  const { data: mySupplyShares } = useReadContract({
    address: ADDRESSES.vault,
    abi: VAULT_ABI,
    functionName: "supplyShares",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
    chainId: 5042002,
  });

  const { data: exchangeRate } = useReadContract({
    address: ADDRESSES.vault,
    abi: VAULT_ABI,
    functionName: "getExchangeRate",
    chainId: 5042002,
  });

  const { data: eurcLpShares } = useReadContract({
    address: ADDRESSES.pool,
    abi: POOL_ABI,
    functionName: "getShares",
    args: address ? [ADDRESSES.eurc, address] : undefined,
    query: { enabled: !!address },
    chainId: 5042002,
  });

  const { data: cirbtcLpShares } = useReadContract({
    address: ADDRESSES.pool,
    abi: POOL_ABI,
    functionName: "getShares",
    args: address ? [ADDRESSES.cirbtc, address] : undefined,
    query: { enabled: !!address },
    chainId: 5042002,
  });

  const { data: eurcInfo } = useReadContract({
    address: ADDRESSES.vault,
    abi: VAULT_ABI,
    functionName: "collateralAssets",
    args: [ADDRESSES.eurc],
    query: { refetchInterval: 15000 },
    chainId: 5042002,
  });

  const { data: cirbtcInfo } = useReadContract({
    address: ADDRESSES.vault,
    abi: VAULT_ABI,
    functionName: "collateralAssets",
    args: [ADDRESSES.cirbtc],
    query: { refetchInterval: 15000 },
    chainId: 5042002,
  });

 const guardianActive = guardianAuth ? (guardianAuth as [boolean, bigint, bigint, bigint, bigint])[0] : false;
  const utilization = utilizationBps !== undefined ? Number(utilizationBps) / 100 : undefined;

  const rate = exchangeRate !== undefined ? Number(formatUnits(exchangeRate as bigint, 6)) : 1;
  const supplyValue = mySupplyShares !== undefined ? Number(formatUnits(mySupplyShares as bigint, 6)) * rate : 0;
  const hasSupplyPosition = mySupplyShares !== undefined && (mySupplyShares as bigint) > 0n;

  const hasEurcLp = eurcLpShares !== undefined && (eurcLpShares as bigint) > 0n;
  const hasCirbtcLp = cirbtcLpShares !== undefined && (cirbtcLpShares as bigint) > 0n;
  const hasAnyLp = hasEurcLp || hasCirbtcLp;

  const [activeRuleCount, setActiveRuleCount] = useState<number | null>(null);

  useEffect(() => {
    if (!address) return;
    fetch(`${API_BASE}/conditional-agents/${address}`)
      .then((res) => res.json())
      .then((data) => setActiveRuleCount((data.agents || []).filter((r: any) => r.active).length))
      .catch(() => setActiveRuleCount(null));
  }, [address]);

  if (!isConnected) {
    return (
      <>
        <PageHeader title="Dashboard" subtitle="Your position at a glance." />
        <div className="card p-6">
          <p className="mb-4 text-sm text-muted">Connect a wallet to see your position.</p>
          <ConnectButton />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Your position at a glance." />

      {utilization !== undefined && utilization >= WARNING_THRESHOLD_BPS / 100 && (
        <div
          className="card mb-6 flex items-start gap-3 p-5"
          style={{
            background: utilization >= DANGER_THRESHOLD_BPS / 100 ? "#fef2f2" : "#fffbeb",
            borderColor: "transparent",
          }}
        >
          <AlertTriangle
            size={20}
            className="mt-0.5 shrink-0"
            style={{ color: utilization >= DANGER_THRESHOLD_BPS / 100 ? "var(--danger)" : "var(--warning)" }}
          />
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {utilization >= DANGER_THRESHOLD_BPS / 100
                ? `Your position is at ${utilization.toFixed(1)}% utilization`
                : `Your position is approaching risk, at ${utilization.toFixed(1)}% utilization`}
            </p>
            <p className="mt-1 text-sm text-muted">
              {utilization >= DANGER_THRESHOLD_BPS / 100
                ? guardianActive
                  ? "Guardian should step in automatically shortly, if it hasn't already."
                  : "This is the threshold where Guardian would autonomously repay debt to protect you — but you haven't activated it. Consider repaying manually or setting up Guardian."
                : `Above ${WARNING_THRESHOLD_BPS / 100}% is an early warning level. At ${DANGER_THRESHOLD_BPS / 100}%, Guardian would step in automatically if it's active.`}
            </p>
            {!guardianActive && (
              <Link href="/app/guardian" className="mt-2 inline-block text-sm font-semibold underline" style={{ color: "var(--accent)" }}>
                Set up Guardian →
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="mb-6 flex gap-4">
        <div className="card flex-1 p-4">
          <p className="text-xs font-medium text-subtle uppercase">EURC</p>
          <p className="font-data mt-0.5 text-lg font-medium">
            ${eurcInfo ? formatUnits((eurcInfo as [boolean, number, bigint])[2], 6) : "—"}
          </p>
        </div>
        <div className="card flex-1 p-4">
          <p className="text-xs font-medium text-subtle uppercase">cirBTC</p>
          <p className="font-data mt-0.5 text-lg font-medium">
            ${cirbtcInfo ? formatUnits((cirbtcInfo as [boolean, number, bigint])[2], 6) : "—"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <p className="text-xs font-medium text-subtle uppercase">Collateral value</p>
          <p className="font-data mt-1 text-2xl font-medium">
            ${collateralValueUSD !== undefined ? formatUnits(collateralValueUSD as bigint, 6) : "—"}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-medium text-subtle uppercase">Your debt</p>
          <p className="font-data mt-1 text-2xl font-medium">
            {debt !== undefined ? formatUnits(debt as bigint, 6) : "—"} USDC
          </p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-medium text-subtle uppercase">Utilization</p>
          <p className="font-data mt-1 text-2xl font-medium">
            {utilization !== undefined ? `${utilization.toFixed(1)}%` : "—"}
          </p>
          <p className="mt-1 text-xs text-subtle">How much of your borrowing capacity is in use.</p>
        </div>
        <div className="card flex items-center gap-2 p-5">
          <ShieldCheck size={18} style={{ color: guardianActive ? "var(--success)" : "var(--text-muted)" }} />
          <div>
            <p className="text-xs font-medium text-subtle uppercase">Guardian</p>
            <p className="mt-0.5 text-sm font-medium">{guardianActive ? "Active" : "Not set up"}</p>
          </div>
        </div>
      </div>

      {(hasSupplyPosition || hasAnyLp || (activeRuleCount !== null && activeRuleCount > 0)) && (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {hasSupplyPosition && (
            <div className="card p-5">
              <p className="text-xs font-medium text-subtle uppercase">Your supply position</p>
              <p className="font-data mt-1 text-2xl font-medium">~{supplyValue.toFixed(4)} USDC</p>
              <Link href="/app/lend" className="mt-1 inline-block text-xs font-medium underline" style={{ color: "var(--accent)" }}>
                Manage →
              </Link>
            </div>
          )}
          {hasAnyLp && (
            <div className="card p-5">
              <p className="mb-1 text-xs font-medium text-subtle uppercase">Your LP positions</p>
              {hasEurcLp && (
                <p className="font-data text-sm">
                  {formatUnits(eurcLpShares as bigint, 6)} shares — EURC/USDC pool
                </p>
              )}
              {hasCirbtcLp && (
                <p className="font-data text-sm">
                  {formatUnits(cirbtcLpShares as bigint, 6)} shares — cirBTC/USDC pool
                </p>
              )}
              <Link href="/app/pool" className="mt-1 inline-block text-xs font-medium underline" style={{ color: "var(--accent)" }}>
                Manage →
              </Link>
            </div>
          )}
          {activeRuleCount !== null && activeRuleCount > 0 && (
            <div className="card flex items-center gap-2 p-5">
              <Clock size={18} style={{ color: "var(--accent)" }} />
              <div>
                <p className="text-xs font-medium text-subtle uppercase">Active rules</p>
                <p className="mt-0.5 text-sm font-medium">{activeRuleCount} running</p>
                <Link href="/app/agents" className="mt-1 inline-block text-xs font-medium underline" style={{ color: "var(--accent)" }}>
                  Manage →
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}