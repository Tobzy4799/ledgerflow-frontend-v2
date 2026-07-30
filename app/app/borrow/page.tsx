"use client";

import { useEffect, useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { readContract } from "wagmi/actions";
import { parseUnits, formatUnits } from "viem";
import { ADDRESSES, ERC20_ABI, VAULT_ABI } from "@/lib/contracts";
import { wagmiConfig } from "@/lib/wagmi";
import { ConnectWallet } from "@/components/ConnectWallet";
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

export default function BorrowPage() {
  const { address, isConnected } = useAccount();
  const [asset, setAsset] = useState<"eurc" | "cirbtc">("eurc");
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [borrowAmount, setBorrowAmount] = useState("");
  const [repayAmount, setRepayAmount] = useState("");

  const assetToken = asset === "eurc" ? ADDRESSES.eurc : ADDRESSES.cirbtc;
  const assetDecimals = asset === "eurc" ? 6 : 8;
  const assetSymbol = asset === "eurc" ? "EURC" : "cirBTC";

  const { writeContract: writeApproveDeposit, data: approveDepositHash, isPending: approvingDeposit, reset: resetApproveDeposit, error: approveDepositError } = useWriteContract();
  const { writeContract: writeDeposit, data: depositHash, isPending: depositing, reset: resetDeposit, error: depositError } = useWriteContract();
  const { isSuccess: approveDepositConfirmed, error: approveDepositReceiptError } = useWaitForTransactionReceipt({ hash: approveDepositHash });
  const { isSuccess: depositConfirmed, error: depositReceiptError } = useWaitForTransactionReceipt({ hash: depositHash });

  const { writeContract: writeWithdraw, data: withdrawHash, isPending: withdrawing, reset: resetWithdraw, error: withdrawError } = useWriteContract();
  const { isSuccess: withdrawConfirmed, error: withdrawReceiptError } = useWaitForTransactionReceipt({ hash: withdrawHash });

  const { writeContract: writeBorrow, data: borrowHash, isPending: borrowing, reset: resetBorrow, error: borrowError } = useWriteContract();
  const { isSuccess: borrowConfirmed, error: borrowReceiptError } = useWaitForTransactionReceipt({ hash: borrowHash });

  const { writeContract: writeApproveRepay, data: approveRepayHash, isPending: approvingRepay, reset: resetApproveRepay, error: approveRepayError } = useWriteContract();
  const { writeContract: writeRepay, data: repayHash, isPending: repaying, reset: resetRepay, error: repayError } = useWriteContract();
  const { isSuccess: approveRepayConfirmed, error: approveRepayReceiptError } = useWaitForTransactionReceipt({ hash: approveRepayHash });
  const { isSuccess: repayConfirmed, error: repayReceiptError } = useWaitForTransactionReceipt({ hash: repayHash });

  const depositWithdrawError = approveDepositError || depositError || withdrawError || approveDepositReceiptError || depositReceiptError || withdrawReceiptError;
  const borrowRepayError = borrowError || repayError || approveRepayError || borrowReceiptError || repayReceiptError || approveRepayReceiptError;

  function friendlyError(err: Error) {
    const msg = err.message || "";
    if (msg.includes("User rejected") || msg.includes("User denied")) return "Rejected in wallet.";
    if (msg.includes("would break borrow limit")) return "Can't withdraw — you have an active borrow that needs this collateral to stay covered.";
    if (msg.includes("exceeds borrow limit")) return "That's more than your collateral currently allows you to borrow.";
    if (msg.includes("insufficient balance")) return "You don't have that much deposited to withdraw.";
    if (msg.includes("token not approved")) return "This asset isn't supported as collateral.";
    return msg.split("\n")[0] || "Transaction failed. Please try again.";
  }

  const { data: collateralBalance, refetch: refetchCollateralBalance } = useReadContract({
    address: ADDRESSES.vault,
    abi: VAULT_ABI,
    functionName: "collateralBalances",
    args: address ? [address, assetToken] : undefined,
    query: { enabled: !!address },
    chainId: 5042002,
  });

  const { data: collateralValueUSD, refetch: refetchValue } = useReadContract({
    address: ADDRESSES.vault,
    abi: VAULT_ABI,
    functionName: "getCollateralValueUSD",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
    chainId: 5042002,
  });

  const { data: debt, refetch: refetchDebt } = useReadContract({
    address: ADDRESSES.vault,
    abi: VAULT_ABI,
    functionName: "debt",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
    chainId: 5042002,
  });

  useEffect(() => {
    if (approveDepositConfirmed && depositAmount) {
      writeDeposit({
        address: ADDRESSES.vault,
        abi: VAULT_ABI,
        functionName: "depositCollateral",
        args: [assetToken, parseUnits(depositAmount, assetDecimals)],
        chainId: 5042002,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveDepositConfirmed]);

  useEffect(() => {
    if (approveRepayConfirmed && repayAmount) {
      writeRepay({
        address: ADDRESSES.vault,
        abi: VAULT_ABI,
        functionName: "repay",
        args: [parseUnits(repayAmount, 6)],
        chainId: 5042002,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveRepayConfirmed]);

  useEffect(() => {
    if (depositConfirmed || withdrawConfirmed) {
      refetchCollateralBalance();
      refetchValue();
    }
  }, [depositConfirmed, withdrawConfirmed, refetchCollateralBalance, refetchValue]);

  useEffect(() => {
    if (borrowConfirmed || repayConfirmed) refetchDebt();
  }, [borrowConfirmed, repayConfirmed, refetchDebt]);

  function handleDeposit() {
    if (!depositAmount) return;
    resetApproveDeposit();
    resetDeposit();
    writeApproveDeposit({
      address: assetToken,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [ADDRESSES.vault, parseUnits(depositAmount, assetDecimals)],
      chainId: 5042002,
    });
  }

  function handleWithdraw() {
    if (!withdrawAmount) return;
    resetWithdraw();
    writeWithdraw({
      address: ADDRESSES.vault,
      abi: VAULT_ABI,
      functionName: "withdrawCollateral",
      args: [assetToken, parseUnits(withdrawAmount, assetDecimals)],
      chainId: 5042002,
    });
  }

  function handleBorrow() {
    if (!borrowAmount) return;
    resetBorrow();
    writeBorrow({
      address: ADDRESSES.vault,
      abi: VAULT_ABI,
      functionName: "borrow",
      args: [parseUnits(borrowAmount, 6)],
      chainId: 5042002,
    });
  }

  async function handleRepay() {
    if (!repayAmount || !address) return;
    resetApproveRepay();
    resetRepay();

    const amount = parseUnits(repayAmount, 6);
    const currentAllowance = (await readContract(wagmiConfig, {
      address: ADDRESSES.usdc,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [address, ADDRESSES.vault],
      chainId: 5042002,
    })) as bigint;

    if (currentAllowance >= amount) {
      writeRepay({
        address: ADDRESSES.vault,
        abi: VAULT_ABI,
        functionName: "repay",
        args: [amount],
        chainId: 5042002,
      });
      return;
    }

    writeApproveRepay({
      address: ADDRESSES.usdc,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [ADDRESSES.vault, amount * 100n],
      chainId: 5042002,
    });
  }

  if (!isConnected) {
    return (
      <>
        <PageHeader title="Borrow" subtitle="Deposit collateral, then borrow USDC against it." />
        <Field>
          <p className="mb-4 text-sm text-muted">Connect a wallet to borrow.</p>
          <ConnectWallet />
        </Field>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Borrow" subtitle="Deposit collateral, then borrow USDC against it." />

      <div className="card mb-6 p-5" style={{ background: "var(--accent-soft)", borderColor: "transparent" }}>
        <p className="text-sm" style={{ color: "var(--text-primary)" }}>
          <strong>How this works: </strong> you can borrow up to 75% of your deposited
          collateral&apos;s value. Every borrow includes a mandatory 0.5% fee that funds a shared
          insurance pool protecting lenders.
        </p>
        <p className="mt-2 text-sm text-muted">
          If your collateral&apos;s value falls and your debt gets too close to that 75% limit,
          your position can be liquidated — someone else repays part of your debt and takes a
          portion of your collateral in exchange, at a loss to you. You can activate Guardian
          separately to have your position autonomously protected before that happens.
        </p>
      </div>

      <div className="mb-4 flex gap-2">
        {(["eurc", "cirbtc"] as const).map((a) => (
          <button
            key={a}
            onClick={() => setAsset(a)}
            className="rounded-md border px-3 py-1.5 text-xs font-medium"
            style={{
              borderColor: asset === a ? "var(--accent)" : "var(--border)",
              color: asset === a ? "var(--accent)" : "var(--text-secondary)",
            }}
          >
            {a === "eurc" ? "EURC" : "cirBTC"}
          </button>
        ))}
      </div>

      <Field>
        <Row
          label={`Your deposited ${assetSymbol}`}
          value={collateralBalance !== undefined ? `${formatUnits(collateralBalance as bigint, assetDecimals)} ${assetSymbol}` : "—"}
        />
        <Row label="Total collateral value" value={`$${collateralValueUSD !== undefined ? formatUnits(collateralValueUSD as bigint, 6) : "—"}`} />

        <p className="mb-2 text-xs font-medium text-subtle uppercase">Deposit</p>
        <AmountRow
          value={depositAmount}
          onChange={setDepositAmount}
          placeholder={`${assetSymbol} amount`}
          onSubmit={handleDeposit}
          busy={approvingDeposit || depositing}
          busyLabel={approvingDeposit ? "Approving…" : "Depositing…"}
          label="Deposit"
        />
        {depositConfirmed && <p className="mt-2 text-sm" style={{ color: "var(--success)" }}>Deposit confirmed.</p>}

        <p className="mt-5 mb-2 text-xs font-medium text-subtle uppercase">Withdraw</p>
        <AmountRow
          value={withdrawAmount}
          onChange={setWithdrawAmount}
          placeholder={`${assetSymbol} amount`}
          onSubmit={handleWithdraw}
          busy={withdrawing}
          busyLabel="Withdrawing…"
          label="Withdraw"
        />
        {withdrawConfirmed && <p className="mt-2 text-sm" style={{ color: "var(--success)" }}>Withdraw confirmed.</p>}
        <p className="mt-2 text-xs text-subtle">Blocked if it would leave your debt under-collateralized.</p>
        {depositWithdrawError && (
          <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>{friendlyError(depositWithdrawError as Error)}</p>
        )}
      </Field>

      <div className="mt-4">
        <Field>
          <Row label="Your debt" value={`${debt !== undefined ? formatUnits(debt as bigint, 6) : "—"} USDC`} />

          <p className="mb-2 text-xs font-medium text-subtle uppercase">Borrow</p>
          <AmountRow
            value={borrowAmount}
            onChange={setBorrowAmount}
            placeholder="USDC to borrow"
            onSubmit={handleBorrow}
            busy={borrowing}
            busyLabel="Borrowing…"
            label="Borrow"
          />
          {borrowAmount && !isNaN(Number(borrowAmount)) && (
            <p className="mt-2 text-sm text-muted">
              You&apos;ll receive ~{(Number(borrowAmount) * 0.995).toFixed(4)} USDC — 0.5% funds the
              shared insurance pool.
            </p>
          )}
          {borrowConfirmed && <p className="mt-2 text-sm" style={{ color: "var(--success)" }}>Borrow confirmed.</p>}

          <p className="mt-5 mb-2 text-xs font-medium text-subtle uppercase">Repay</p>
          <AmountRow
            value={repayAmount}
            onChange={setRepayAmount}
            placeholder="USDC to repay"
            onSubmit={handleRepay}
            busy={approvingRepay || repaying}
            busyLabel={approvingRepay ? "Approving…" : "Repaying…"}
            label="Repay"
          />
          {repayConfirmed && <p className="mt-2 text-sm" style={{ color: "var(--success)" }}>Repay confirmed.</p>}
          {borrowRepayError && (
            <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>{friendlyError(borrowRepayError as Error)}</p>
          )}
        </Field>
      </div>
    </>
  );
}