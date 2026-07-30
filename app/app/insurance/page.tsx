"use client";

import { useEffect, useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { ADDRESSES, ERC20_ABI, INSURANCE_POOL_ABI } from "@/lib/contracts";
import { ConnectWallet } from "@/components/ConnectWallet";
import { PageHeader } from "@/components/PageHeader";

const API_BASE = process.env.NEXT_PUBLIC_AGENT_API_URL || "http://localhost:3001";

function friendlyError(msg: string): string {
  if (msg.includes("User rejected") || msg.includes("User denied")) return "Rejected in wallet.";
  if (msg.includes("still has collateral")) return "You still have collateral remaining — claims are only for positions with debt and zero collateral left.";
  if (msg.includes("claim exceeds actual debt")) return "That amount is more than your actual outstanding debt.";
  if (msg.includes("amount must be")) return "Enter an amount greater than zero.";
  return msg.split("\n")[0] || "Transaction failed. Please try again.";
}

export default function InsurancePoolPage() {
  const { isConnected } = useAccount();
  const [premiumAmount, setPremiumAmount] = useState("");
  const [claimAmount, setClaimAmount] = useState("");
  const [badDebt, setBadDebt] = useState<{ totalBadDebtUSD: string } | null>(null);

  const { writeContract: writeApprove, data: approveHash, isPending: approving } = useWriteContract();
  const { writeContract: writePremium, data: premiumHash, isPending: payingPremium, error: premiumError } = useWriteContract();
  const { writeContract: writeClaim, data: claimHash, isPending: filingClaim, error: claimError } = useWriteContract();

  const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({ hash: approveHash });
  const { isSuccess: premiumConfirmed, error: premiumReceiptError } = useWaitForTransactionReceipt({ hash: premiumHash });
  const { isSuccess: claimConfirmed, error: claimReceiptError } = useWaitForTransactionReceipt({ hash: claimHash });

  const { data: reserveBalance, refetch: refetchReserve } = useReadContract({
    address: ADDRESSES.insurancePool,
    abi: INSURANCE_POOL_ABI,
    functionName: "reserveBalance",
    chainId: 5042002,
  });

  useEffect(() => {
    fetch(`${API_BASE}/platform/bad-debt`).then((res) => res.json()).then(setBadDebt).catch(() => {});
  }, []);

  useEffect(() => {
    if (approveConfirmed && !premiumHash && premiumAmount) {
      writePremium({
        address: ADDRESSES.insurancePool,
        abi: INSURANCE_POOL_ABI,
        functionName: "payPremium",
        args: [parseUnits(premiumAmount, 6)],
        chainId: 5042002,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveConfirmed]);

  useEffect(() => {
    if (premiumConfirmed) refetchReserve();
  }, [premiumConfirmed, refetchReserve]);

  function handlePayPremium() {
    if (!premiumAmount) return;
    writeApprove({
      address: ADDRESSES.usdc,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [ADDRESSES.insurancePool, parseUnits(premiumAmount, 6)],
      chainId: 5042002,
    });
  }

  function handleFileClaim() {
    if (!claimAmount) return;
    writeClaim({
      address: ADDRESSES.insurancePool,
      abi: INSURANCE_POOL_ABI,
      functionName: "fileClaim",
      args: [parseUnits(claimAmount, 6)],
      chainId: 5042002,
    });
  }

  const premiumErr = premiumError || premiumReceiptError;
  const claimErr = claimError || claimReceiptError;

  if (!isConnected) {
    return (
      <>
        <PageHeader title="Insurance Pool" subtitle="Protects lenders against bad debt." />
        <div className="card p-6">
          <p className="mb-4 text-sm text-muted">Connect a wallet to view or file a claim.</p>
          <ConnectWallet />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Insurance Pool" subtitle="Protects lenders against bad debt." />

      <div className="card mb-6 p-5" style={{ background: "var(--accent-soft)", borderColor: "transparent" }}>
        <p className="text-sm" style={{ color: "var(--text-primary)" }}>
          <strong>How this works: </strong> every borrow already sends a mandatory 0.5% into this
          pool, if your position is ever liquidated down to debt with zero collateral left, you
          can file a claim here to get made whole.
        </p>
        <p className="mt-2 text-sm text-muted">
          Filing a claim is just a request, nothing changes until an admin reviews and approves
          it, then pays it out separately.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <p className="text-xs font-medium text-subtle uppercase">Reserve balance</p>
          <p className="font-data mt-1 text-2xl font-medium">
            {reserveBalance !== undefined ? formatUnits(reserveBalance as bigint, 6) : "—"} USDC
          </p>
          <p className="mt-1 text-xs text-subtle">Set aside to pay future claims, not platform revenue.</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-medium text-subtle uppercase">Platform-wide bad debt</p>
          <p className="font-data mt-1 text-2xl font-medium">${badDebt?.totalBadDebtUSD ?? "—"}</p>
        </div>
      </div>

      <div className="card mt-4 p-6">
        <p className="mb-2 text-xs font-medium text-subtle uppercase">File a claim</p>
        <p className="mb-3 text-sm text-muted">
          Only eligible if you have debt and zero collateral remaining. Filing costs you nothing and
          this is a request to be covered, not a payment.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={claimAmount} onChange={(e) => setClaimAmount(e.target.value)} placeholder="Debt amount you're claiming coverage for" className="flex-1 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }} />
          <button onClick={handleFileClaim} disabled={filingClaim} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--accent)" }}>
            {filingClaim ? "Filing…" : "File claim"}
          </button>
        </div>
        {claimConfirmed && <p className="mt-2 text-sm" style={{ color: "var(--success)" }}>Claim filed — an admin will review it.</p>}
        {claimErr && <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>{friendlyError(claimErr.message)}</p>}
      </div>

      <div className="mt-4">
        <details>
          <summary className="cursor-pointer text-sm text-subtle">Want to help strengthen the pool further? (optional)</summary>
          <div className="card mt-2 p-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input value={premiumAmount} onChange={(e) => setPremiumAmount(e.target.value)} placeholder="USDC amount" className="flex-1 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }} />
              <button onClick={handlePayPremium} disabled={approving || payingPremium} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ borderColor: "var(--border-strong)" }}>
                {approving ? "Approving…" : payingPremium ? "Paying…" : "Contribute"}
              </button>
            </div>
            {premiumConfirmed && <p className="mt-2 text-sm" style={{ color: "var(--success)" }}>Thank you — contribution received.</p>}
            {premiumErr && <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>{friendlyError(premiumErr.message)}</p>}
          </div>
        </details>
      </div>
    </>
  );
}