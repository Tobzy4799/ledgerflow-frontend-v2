"use client";

import { useEffect, useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { ADDRESSES, ERC20_ABI, INSURANCE_POOL_ABI } from "@/lib/contracts";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { PageHeader } from "@/components/PageHeader";

const API_BASE = process.env.NEXT_PUBLIC_AGENT_API_URL || "http://localhost:3001";
const TREASURY_ADDRESS = "0xB52Aac9451Ebb70899f3521A16F412f2c9487211" as const;

const AGENT_WALLETS = [
  { name: "Guardian", address: "0xf7c2e43078ded0045b05289e86421ac2dab90a35" as const },
  { name: "Executor", address: "0x4b9a4af1d4e08350a112fc5948076a4de7b9df27" as const },
  { name: "Conditional Agents", address: "0x963c37428bbb5091e8511b82b894d028537333d5" as const },
];

function friendlyError(msg: string): string {
  if (msg.includes("User rejected") || msg.includes("User denied")) return "Rejected in wallet.";
  if (msg.includes("already approved")) return "This claim was already approved.";
  if (msg.includes("not approved")) return "This claim hasn't been approved yet.";
  if (msg.includes("already paid")) return "This claim was already paid out.";
  if (msg.includes("insufficient reserve")) return "The insurance reserve doesn't currently have enough to cover this claim.";
  if (msg.includes("exceeds reserve")) return "That's more than the current reserve balance.";
  if (msg.includes("insufficient")) return "Insufficient balance for this amount.";
  return msg.split("\n")[0] || "Transaction failed. Please try again.";
}

function AgentWalletRow({ name, address }: { name: string; address: `0x${string}` }) {
  const [topUpAmount, setTopUpAmount] = useState("");
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isSuccess: confirmed, error: receiptError } = useWaitForTransactionReceipt({ hash });

  const { data: balance, refetch } = useReadContract({
    address: ADDRESSES.usdc,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [address],
    query: { refetchInterval: 15000 },
    chainId: 5042002,
  });

  useEffect(() => {
    if (confirmed) refetch();
  }, [confirmed, refetch]);

  function handleTopUp() {
    if (!topUpAmount) return;
    writeContract({
      address: ADDRESSES.usdc,
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [address, parseUnits(topUpAmount, 6)],
      chainId: 5042002,
    });
  }

  const err = error || receiptError;

  return (
    <div className="hairline border-b py-3 last:border-0">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium">{name}</span>
        <span className="font-data">{balance !== undefined ? formatUnits(balance as bigint, 6) : "—"} USDC</span>
      </div>
      <div className="flex gap-2">
        <input value={topUpAmount} onChange={(e) => setTopUpAmount(e.target.value)} placeholder="USDC amount" className="flex-1 rounded-lg border px-3 py-1.5 text-xs" style={{ borderColor: "var(--border)" }} />
        <button onClick={handleTopUp} disabled={isPending} className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50" style={{ borderColor: "var(--border-strong)" }}>
          {isPending ? "Sending…" : "Top up"}
        </button>
      </div>
      {confirmed && <p className="mt-1 text-xs" style={{ color: "var(--success)" }}>Topped up.</p>}
      {err && <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>{friendlyError(err.message)}</p>}
    </div>
  );
}

export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const [claimIdInput, setClaimIdInput] = useState("");
  const [sweepAmount, setSweepAmount] = useState("");
  const [sweepTo, setSweepTo] = useState("");
  const [allClaims, setAllClaims] = useState<{ id: string; user: string; amount: string; approved: boolean; paid: boolean }[]>([]);

  const { data: ownerAddress } = useReadContract({
    address: ADDRESSES.insurancePool,
    abi: INSURANCE_POOL_ABI,
    functionName: "owner",
    chainId: 5042002,
  });

  const isOwner = !!address && !!ownerAddress && address.toLowerCase() === (ownerAddress as string).toLowerCase();

  const { data: treasuryBalance } = useReadContract({
    address: ADDRESSES.usdc,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [TREASURY_ADDRESS],
    query: { enabled: isOwner, refetchInterval: 15000 },
    chainId: 5042002,
  });

  const { data: reserveBalance, refetch: refetchReserve } = useReadContract({
    address: ADDRESSES.insurancePool,
    abi: INSURANCE_POOL_ABI,
    functionName: "reserveBalance",
    query: { enabled: isOwner },
    chainId: 5042002,
  });

  const { writeContract: writeApproveClaim, data: approveClaimHash, isPending: approvingClaim, error: approveClaimError } = useWriteContract();
  const { writeContract: writePayClaim, data: payClaimHash, isPending: payingClaim, error: payClaimError } = useWriteContract();
  const { writeContract: writeSweep, data: sweepHash, isPending: sweeping, error: sweepError } = useWriteContract();

  const { isSuccess: approveClaimConfirmed, error: approveClaimReceiptError } = useWaitForTransactionReceipt({ hash: approveClaimHash });
  const { isSuccess: payClaimConfirmed, error: payClaimReceiptError } = useWaitForTransactionReceipt({ hash: payClaimHash });
  const { isSuccess: sweepConfirmed, error: sweepReceiptError } = useWaitForTransactionReceipt({ hash: sweepHash });

  useEffect(() => {
    if (!isOwner) return;
    fetch(`${API_BASE}/platform/insurance-claims`).then((res) => res.json()).then((d) => setAllClaims(d.claims || [])).catch(() => {});
  }, [isOwner]);

  useEffect(() => {
    if (payClaimConfirmed || sweepConfirmed) refetchReserve();
  }, [payClaimConfirmed, sweepConfirmed, refetchReserve]);

  function handleApproveClaim() {
    if (!claimIdInput) return;
    writeApproveClaim({
      address: ADDRESSES.insurancePool,
      abi: INSURANCE_POOL_ABI,
      functionName: "approveClaim",
      args: [BigInt(claimIdInput)],
      chainId: 5042002,
    });
  }

  function handlePayClaim() {
    if (!claimIdInput) return;
    writePayClaim({
      address: ADDRESSES.insurancePool,
      abi: INSURANCE_POOL_ABI,
      functionName: "payClaim",
      args: [BigInt(claimIdInput)],
      chainId: 5042002,
    });
  }

  function handleSweep() {
    if (!sweepAmount || !sweepTo) return;
    writeSweep({
      address: ADDRESSES.insurancePool,
      abi: INSURANCE_POOL_ABI,
      functionName: "sweepSurplus",
      args: [parseUnits(sweepAmount, 6), sweepTo as `0x${string}`],
      chainId: 5042002,
    });
  }

  const approveClaimErr = approveClaimError || approveClaimReceiptError;
  const payClaimErr = payClaimError || payClaimReceiptError;
  const sweepErr = sweepError || sweepReceiptError;

  if (!isConnected) {
    return (
      <>
        <PageHeader title="Admin" subtitle="Platform management — owner only." />
        <div className="card p-6">
          <p className="mb-4 text-sm text-muted">Connect the owner wallet to access admin controls.</p>
          <ConnectButton />
        </div>
      </>
    );
  }

  if (!isOwner) {
    return (
      <>
        <PageHeader title="Admin" subtitle="Platform management — owner only." />
        <div className="card p-6">
          <p className="text-sm text-muted">This wallet isn&apos;t the platform owner — nothing to see here.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Admin" subtitle="Platform management — owner only." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <p className="text-xs font-medium text-subtle uppercase">Treasury balance (revenue)</p>
          <p className="font-data mt-1 text-2xl font-medium">
            {treasuryBalance !== undefined ? formatUnits(treasuryBalance as bigint, 6) : "—"} USDC
          </p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-medium text-subtle uppercase">Insurance reserve</p>
          <p className="font-data mt-1 text-2xl font-medium">
            {reserveBalance !== undefined ? formatUnits(reserveBalance as bigint, 6) : "—"} USDC
          </p>
        </div>
      </div>

      <div className="card mt-4 p-6">
        <p className="mb-3 text-xs font-medium text-subtle uppercase">Agent wallet gas balances</p>
        {AGENT_WALLETS.map((w) => (
          <AgentWalletRow key={w.address} name={w.name} address={w.address} />
        ))}
      </div>

      <div className="card mt-4 p-6">
        <p className="mb-3 text-xs font-medium text-subtle uppercase">Insurance claims</p>

        {allClaims.length > 0 && (
          <div className="mb-3 space-y-1">
            {allClaims.map((c) => (
              <div
                key={c.id}
                onClick={() => setClaimIdInput(c.id)}
                className="cursor-pointer rounded-md p-2 text-xs"
                style={{ background: claimIdInput === c.id ? "var(--accent-soft)" : "transparent" }}
              >
                #{c.id} — {c.user.slice(0, 6)}…{c.user.slice(-4)} — {c.amount} USDC — {c.paid ? "paid" : c.approved ? "approved, unpaid" : "pending"}
              </div>
            ))}
          </div>
        )}

        <input value={claimIdInput} onChange={(e) => setClaimIdInput(e.target.value)} placeholder="Claim ID" className="mb-2 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }} />
        <div className="flex gap-2">
          <button onClick={handleApproveClaim} disabled={approvingClaim} className="flex-1 rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ borderColor: "var(--border-strong)" }}>
            {approvingClaim ? "Approving…" : "Approve claim"}
          </button>
          <button onClick={handlePayClaim} disabled={payingClaim} className="flex-1 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--accent)" }}>
            {payingClaim ? "Paying…" : "Pay claim"}
          </button>
        </div>
        {approveClaimConfirmed && <p className="mt-2 text-sm" style={{ color: "var(--success)" }}>Claim approved.</p>}
        {payClaimConfirmed && <p className="mt-2 text-sm" style={{ color: "var(--success)" }}>Claim paid.</p>}
        {approveClaimErr && <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>{friendlyError(approveClaimErr.message)}</p>}
        {payClaimErr && <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>{friendlyError(payClaimErr.message)}</p>}

        <div className="hairline mt-4 border-t pt-4">
          <p className="mb-2 text-xs font-medium text-subtle uppercase">Sweep surplus</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input value={sweepAmount} onChange={(e) => setSweepAmount(e.target.value)} placeholder="Amount" className="flex-1 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }} />
            <input value={sweepTo} onChange={(e) => setSweepTo(e.target.value)} placeholder="Send to (0x...)" className="flex-1 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }} />
            <button onClick={handleSweep} disabled={sweeping} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ borderColor: "var(--border-strong)" }}>
              {sweeping ? "Sweeping…" : "Sweep"}
            </button>
          </div>
          {sweepConfirmed && <p className="mt-2 text-sm" style={{ color: "var(--success)" }}>Surplus swept.</p>}
          {sweepErr && <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>{friendlyError(sweepErr.message)}</p>}
        </div>
      </div>
    </>
  );
}