"use client";

import { useEffect, useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { ADDRESSES, ERC20_ABI, VAULT_ABI } from "@/lib/contracts";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { PageHeader } from "@/components/PageHeader";

function Field({ children }: { children: React.ReactNode }) {
  return <div className="card p-6">{children}</div>;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <span className="text-sm font-medium">{label}</span>
      <span className="font-data text-sm">{value}</span>
    </div>
  );
}

function AmountRow({
  value,
  onChange,
  placeholder,
  onSubmit,
  busy,
  busyLabel,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onSubmit: () => void;
  busy: boolean;
  busyLabel: string;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 rounded-lg border px-3 py-2 text-sm"
        style={{ borderColor: "var(--border)" }}
      />
      <button
        onClick={onSubmit}
        disabled={busy}
        className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: "var(--accent)" }}
      >
        {busy ? busyLabel : label}
      </button>
    </div>
  );
}

function friendlyError(err: Error) {
  const msg = err.message || "";
  if (msg.includes("User rejected") || msg.includes("User denied")) return "Rejected in wallet.";
  if (msg.includes("insufficient shares")) return "You don't have that many shares to withdraw.";
  if (msg.includes("insufficient idle liquidity to withdraw"))
    return "Not enough idle USDC right now — most of it is currently out on loan to borrowers. Try a smaller amount or check back later.";
  return msg.split("\n")[0] || "Transaction failed. Please try again.";
}

export default function EarnPage() {
  const { address, isConnected } = useAccount();
  const [supplyAmount, setSupplyAmount] = useState("");
  const [withdrawShares, setWithdrawShares] = useState("");

  const { writeContract: writeApprove, data: approveHash, isPending: approving, reset: resetApprove, error: approveError } = useWriteContract();
  const { writeContract: writeSupply, data: supplyHash, isPending: supplying, reset: resetSupply, error: supplyError } = useWriteContract();
  const { writeContract: writeWithdraw, data: withdrawHash, isPending: withdrawing, reset: resetWithdraw, error: withdrawError } = useWriteContract();

  const { isSuccess: approveConfirmed, error: approveReceiptError } = useWaitForTransactionReceipt({ hash: approveHash });
  const { isSuccess: supplyConfirmed, error: supplyReceiptError } = useWaitForTransactionReceipt({ hash: supplyHash });
  const { isSuccess: withdrawConfirmed, error: withdrawReceiptError } = useWaitForTransactionReceipt({ hash: withdrawHash });

  const { data: myShares, refetch: refetchShares } = useReadContract({
    address: ADDRESSES.vault,
    abi: VAULT_ABI,
    functionName: "supplyShares",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
    chainId: 5042002,
  });

  const { data: exchangeRate, refetch: refetchRate } = useReadContract({
    address: ADDRESSES.vault,
    abi: VAULT_ABI,
    functionName: "getExchangeRate",
    chainId: 5042002,
  });

  useEffect(() => {
    if (approveConfirmed && supplyAmount) {
      writeSupply({
        address: ADDRESSES.vault,
        abi: VAULT_ABI,
        functionName: "supply",
        args: [parseUnits(supplyAmount, 6)],
        chainId: 5042002,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveConfirmed]);

  useEffect(() => {
    if (supplyConfirmed || withdrawConfirmed) {
      refetchShares();
      refetchRate();
    }
  }, [supplyConfirmed, withdrawConfirmed, refetchShares, refetchRate]);

  function handleSupply() {
    if (!supplyAmount) return;
    resetApprove();
    resetSupply();
    writeApprove({
      address: ADDRESSES.usdc,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [ADDRESSES.vault, parseUnits(supplyAmount, 6)],
      chainId: 5042002,
    });
  }

  function handleWithdraw() {
    if (!withdrawShares) return;
    resetWithdraw();
    writeWithdraw({
      address: ADDRESSES.vault,
      abi: VAULT_ABI,
      functionName: "withdrawSupply",
      args: [parseUnits(withdrawShares, 6)],
      chainId: 5042002,
    });
  }

  const rate = exchangeRate !== undefined ? Number(formatUnits(exchangeRate as bigint, 6)) : 1;
  const myValue = myShares !== undefined ? Number(formatUnits(myShares as bigint, 6)) * rate : 0;

  const supplyWithdrawError = approveError || supplyError || withdrawError || approveReceiptError || supplyReceiptError || withdrawReceiptError;

  if (!isConnected) {
    return (
      <>
        <PageHeader title="Earn" subtitle="Supply USDC, earn interest as borrowers repay." />
        <Field>
          <p className="mb-4 text-sm text-muted">Connect a wallet to supply USDC.</p>
          <ConnectButton />
        </Field>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Earn" subtitle="Supply USDC, earn interest as borrowers repay." />

      <div className="card mb-6 p-5" style={{ background: "var(--accent-soft)", borderColor: "transparent" }}>
        <p className="text-sm" style={{ color: "var(--text-primary)" }}>
          <strong>How this works: </strong> when you supply, you receive shares, not a fixed
          balance. As borrowers pay interest, the exchange rate between shares and USDC rises,
          so your shares become worth more over time, automatically. There&apos;s nothing separate
          to claim.
        </p>
        <p className="mt-2 text-sm text-muted">
          No lock-up period, but withdrawals are limited to whatever USDC is currently idle (not
          out on loan) in high-demand periods, you may need to withdraw in smaller amounts or
          wait for repayments to free up liquidity.
        </p>
      </div>

      <Field>
        <Row label="Your shares" value={myShares !== undefined ? formatUnits(myShares as bigint, 6) : "—"} />
        <Row label="Exchange rate" value={`${exchangeRate !== undefined ? rate.toFixed(6) : "—"} USDC / share`} />
        <Row label="Your position value" value={`~${myValue.toFixed(4)} USDC`} />

        <p className="mb-2 text-xs font-medium text-subtle uppercase">Supply</p>
        <AmountRow
          value={supplyAmount}
          onChange={setSupplyAmount}
          placeholder="USDC to supply"
          onSubmit={handleSupply}
          busy={approving || supplying}
          busyLabel={approving ? "Approving…" : "Supplying…"}
          label="Supply"
        />
        {supplyConfirmed && <p className="mt-2 text-sm" style={{ color: "var(--success)" }}>Supply confirmed.</p>}

        <p className="mt-5 mb-2 text-xs font-medium text-subtle uppercase">Withdraw</p>
        <AmountRow
          value={withdrawShares}
          onChange={setWithdrawShares}
          placeholder="Shares to withdraw"
          onSubmit={handleWithdraw}
          busy={withdrawing}
          busyLabel="Withdrawing…"
          label="Withdraw"
        />
        {withdrawConfirmed && <p className="mt-2 text-sm" style={{ color: "var(--success)" }}>Withdraw confirmed.</p>}
        {supplyWithdrawError && (
          <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>{friendlyError(supplyWithdrawError as Error)}</p>
        )}
      </Field>
    </>
  );
}