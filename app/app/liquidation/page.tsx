"use client";

import { useEffect, useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { readContract } from "wagmi/actions";
import { parseUnits, formatUnits, isAddress } from "viem";
import { ADDRESSES, ERC20_ABI, VAULT_ABI } from "@/lib/contracts";
import { wagmiConfig } from "@/lib/wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { PageHeader } from "@/components/PageHeader";

const API_BASE = process.env.NEXT_PUBLIC_AGENT_API_URL || "http://localhost:3001";

function friendlyError(msg: string): string {
  if (msg.includes("User rejected") || msg.includes("User denied")) return "Rejected in wallet.";
  if (msg.includes("position not liquidatable")) return "This position isn't currently eligible — it must be liquidatable at the exact moment you submit.";
  if (msg.includes("insufficient")) return "Insufficient balance for this repay amount.";
  return msg.split("\n")[0] || "Transaction failed. Please try again.";
}

export default function LiquidationPage() {
  const { address, isConnected } = useAccount();
  const [targetUser, setTargetUser] = useState("");
  const [asset, setAsset] = useState<"eurc" | "cirbtc">("eurc");
  const [repayAmount, setRepayAmount] = useState("");
  const [liquidatablePositions, setLiquidatablePositions] = useState<{ address: string; asset: string; debt: string; isCritical: boolean }[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/platform/liquidatable-positions`)
      .then((res) => res.json())
      .then((d) => setLiquidatablePositions(d.positions || []))
      .catch(() => {});
  }, []);

  const assetToken = asset === "eurc" ? ADDRESSES.eurc : ADDRESSES.cirbtc;
  const validUserAddress = isAddress(targetUser);

  const { writeContract: writeApprove, data: approveHash, isPending: approving, reset: resetApprove } = useWriteContract();
  const { writeContract: writeLiquidate, data: liquidateHash, isPending: liquidating, reset: resetLiquidate, error: liquidateError } = useWriteContract();
  const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({ hash: approveHash });
  const { isSuccess: liquidateConfirmed, error: liquidateReceiptError } = useWaitForTransactionReceipt({ hash: liquidateHash });

  const { data: liquidationInfo } = useReadContract({
    address: ADDRESSES.vault,
    abi: VAULT_ABI,
    functionName: "getLiquidationInfo",
    args: validUserAddress ? [targetUser as `0x${string}`, assetToken] : undefined,
    query: { enabled: validUserAddress, refetchInterval: 15000 },
    chainId: 5042002,
  });

  const info = liquidationInfo as [boolean, bigint, bigint, bigint, boolean] | undefined;
  const [liquidatable, currentDebt, availableCollateral, maxNormalRepay, isCritical] = info || [false, 0n, 0n, 0n, false];

  const { data: preview } = useReadContract({
    address: ADDRESSES.vault,
    abi: VAULT_ABI,
    functionName: "previewLiquidation",
    args: validUserAddress && repayAmount ? [targetUser as `0x${string}`, assetToken, parseUnits(repayAmount, 6)] : undefined,
    query: { enabled: validUserAddress && !!repayAmount },
    chainId: 5042002,
  });

  const assetDecimals = asset === "eurc" ? 6 : 8;
  const assetSymbol = asset === "eurc" ? "EURC" : "cirBTC";

  async function handleLiquidate() {
    if (!validUserAddress || !repayAmount || !address) return;
    resetApprove();
    resetLiquidate();

    const amount = parseUnits(repayAmount, 6);
    const currentAllowance = (await readContract(wagmiConfig, {
      address: ADDRESSES.usdc,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [address, ADDRESSES.vault],
      chainId: 5042002,
    })) as bigint;

    if (currentAllowance >= amount) {
      writeLiquidate({
        address: ADDRESSES.vault,
        abi: VAULT_ABI,
        functionName: "liquidate",
        args: [targetUser as `0x${string}`, assetToken, amount],
        chainId: 5042002,
      });
      return;
    }

    writeApprove({
      address: ADDRESSES.usdc,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [ADDRESSES.vault, amount * 100n],
      chainId: 5042002,
    });
  }

  const liquidateErr = liquidateError || liquidateReceiptError;

  if (!isConnected) {
    return (
      <>
        <PageHeader title="Liquidation" subtitle="Repay someone else's at-risk debt, receive their collateral at a bonus." />
        <div className="card p-6">
          <p className="mb-4 text-sm text-muted">Connect a wallet to liquidate a position.</p>
          <ConnectButton />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Liquidation" subtitle="Repay someone else's at-risk debt, receive their collateral at a bonus." />

      <div className="card mb-6 p-5" style={{ background: "var(--accent-soft)", borderColor: "transparent" }}>
        <p className="text-sm" style={{ color: "var(--text-primary)" }}>
          <strong>How this works: </strong> anyone can liquidate a position once its debt gets too
          close to its collateral&apos;s value, you repay
          part of the borrower&apos;s debt, and receive their collateral at a bonus over its market
          value in return.
        </p>
        <p className="mt-2 text-sm text-muted">
          This is genuinely permissionless, you don&apos;t need to know the person, just their
          wallet address and which collateral asset their position uses.
        </p>
      </div>

      <div className="card mb-4 p-6">
        <p className="mb-3 text-xs font-medium text-subtle uppercase">Currently liquidatable</p>
        {liquidatablePositions.length > 0 ? (
          <div className="space-y-1">
            {liquidatablePositions.map((p, i) => (
              <div
                key={i}
                onClick={() => {
                  setTargetUser(p.address);
                  setAsset(p.asset === "EURC" ? "eurc" : "cirbtc");
                }}
                className="cursor-pointer rounded-md p-2 text-xs"
                style={{ background: targetUser === p.address ? "var(--accent-soft)" : "transparent" }}
              >
                {p.address.slice(0, 6)}…{p.address.slice(-4)} — {p.debt} USDC debt ({p.asset}) {p.isCritical && <span style={{ color: "var(--danger)" }}>— critical</span>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No liquidatable positions right now, check back later.</p>
        )}
      </div>

      <div className="card p-6">
        {!validUserAddress && (
          <p className="text-sm text-muted">Select a position above to see details and repay it.</p>
        )}
        {validUserAddress && (
          <>
            <div className="hairline mt-4 border-t pt-4">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-muted">Liquidatable</span>
                <span className="font-semibold" style={{ color: liquidatable ? (isCritical ? "var(--danger)" : "var(--warning)") : "var(--text-muted)" }}>
                  {liquidatable ? (isCritical ? "Yes — critical" : "Yes") : "No"}
                </span>
              </div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-muted">Current debt</span>
                <span className="font-data">{formatUnits(currentDebt, 6)} USDC</span>
              </div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-muted">Available collateral</span>
                <span className="font-data">{formatUnits(availableCollateral, assetDecimals)} {assetSymbol}</span>
              </div>
              {!isCritical && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Max normal repay</span>
                  <span className="font-data">{formatUnits(maxNormalRepay, 6)} USDC</span>
                </div>
              )}
              {isCritical && (
                <p className="mt-2 text-xs" style={{ color: "var(--danger)" }}>
                  This position is critical, collateral is worth less than the debt. You can still
                  repay, but won&apos;t receive a full bonus since there&apos;s not enough
                  collateral left to cover it.
                </p>
              )}
            </div>

            {liquidatable && (
              <div className="hairline mt-4 border-t pt-4">
                <p className="mb-2 text-xs font-medium text-subtle uppercase">Repay and claim collateral</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={repayAmount}
                    onChange={(e) => setRepayAmount(e.target.value)}
                    placeholder="USDC to repay"
                    className="flex-1 rounded-lg border px-3 py-2 text-sm"
                    style={{ borderColor: "var(--border)" }}
                  />
                  <button
                    onClick={handleLiquidate}
                    disabled={approving || liquidating}
                    className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: "var(--accent)" }}
                  >
                    {approving ? "Approving…" : liquidating ? "Liquidating…" : "Liquidate"}
                  </button>
                </div>
                {preview !== undefined && repayAmount && (
                  <p className="mt-2 text-sm text-muted">
                    You&apos;ll receive ~{formatUnits(preview as bigint, assetDecimals)} {assetSymbol}
                  </p>
                )}
                {liquidateConfirmed && <p className="mt-2 text-sm" style={{ color: "var(--success)" }}>Liquidation confirmed.</p>}
                {liquidateErr && <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>{friendlyError(liquidateErr.message)}</p>}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}