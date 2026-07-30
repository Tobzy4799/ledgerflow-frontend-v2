"use client";

import { useEffect, useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { ADDRESSES, ERC20_ABI, VAULT_ABI, POOL_ABI } from "@/lib/contracts";
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

function friendlyError(err: Error) {
  const msg = err.message || "";
  if (msg.includes("User rejected") || msg.includes("User denied")) return "Rejected in wallet.";
  if (msg.includes("must deposit something")) return "Enter an amount on at least one side.";
  if (msg.includes("insufficient initial liquidity"))
    return "This pool is brand new — the very first deposit needs to be larger to properly bootstrap it.";
  if (msg.includes("insufficient shares")) return "You don't have that many LP shares to remove.";
  return msg.split("\n")[0] || "Transaction failed. Please try again.";
}

export default function PoolPage() {
  const { address, isConnected } = useAccount();
  const [asset, setAsset] = useState<"eurc" | "cirbtc">("eurc");
  const [tokenAmount, setTokenAmount] = useState("");
  const [usdcAmount, setUsdcAmount] = useState("");
  const [sharesToRemove, setSharesToRemove] = useState("");

  const assetToken = asset === "eurc" ? ADDRESSES.eurc : ADDRESSES.cirbtc;
  const assetDecimals = asset === "eurc" ? 6 : 8;
  const assetSymbol = asset === "eurc" ? "EURC" : "cirBTC";

  const { writeContract: writeApproveToken, data: approveTokenHash, isPending: approveTokenPending, reset: resetApproveToken, error: approveTokenError } = useWriteContract();
  const { writeContract: writeApproveUsdc, data: approveUsdcHash, isPending: approveUsdcPending, reset: resetApproveUsdc, error: approveUsdcError } = useWriteContract();
  const { writeContract: writeAdd, data: addHash, isPending: addPending, reset: resetAdd, error: addError } = useWriteContract();
  const { writeContract: writeRemove, data: removeHash, isPending: removing, error: removeError } = useWriteContract();

  const { isSuccess: tokenApproved, isLoading: tokenApproveConfirming, error: tokenApproveReceiptError } = useWaitForTransactionReceipt({ hash: approveTokenHash });
  const { isSuccess: usdcApproved, isLoading: usdcApproveConfirming, error: usdcApproveReceiptError } = useWaitForTransactionReceipt({ hash: approveUsdcHash });
  const { isSuccess: liquidityAdded, isLoading: addConfirming, error: addReceiptError } = useWaitForTransactionReceipt({ hash: addHash });
  const { isSuccess: liquidityRemoved, error: removeReceiptError } = useWaitForTransactionReceipt({ hash: removeHash });

  const { data: assetInfo } = useReadContract({
    address: ADDRESSES.vault,
    abi: VAULT_ABI,
    functionName: "collateralAssets",
    args: [assetToken],
    query: { refetchInterval: 15000 },
    chainId: 5042002,
  });

  const referencePriceUSD = assetInfo ? (assetInfo as [boolean, number, bigint])[2] : undefined;

  const { data: reserves, refetch: refetchReserves } = useReadContract({
    address: ADDRESSES.pool,
    abi: POOL_ABI,
    functionName: "getReserves",
    args: [assetToken],
    query: { refetchInterval: 15000 },
    chainId: 5042002,
  });

  const { data: myShares, refetch: refetchShares } = useReadContract({
    address: ADDRESSES.pool,
    abi: POOL_ABI,
    functionName: "getShares",
    args: address ? [assetToken, address] : undefined,
    query: { enabled: !!address },
    chainId: 5042002,
  });

  const reservesArr = reserves as [bigint, bigint] | undefined;

  useEffect(() => {
    if (tokenApproved && !approveUsdcHash) {
      writeApproveUsdc({
        address: ADDRESSES.usdc,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [ADDRESSES.pool, parseUnits(usdcAmount || "0", 6)],
        chainId: 5042002,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenApproved]);

  useEffect(() => {
    if (usdcApproved && !addHash) {
      writeAdd({
        address: ADDRESSES.pool,
        abi: POOL_ABI,
        functionName: "addLiquidity",
        args: [assetToken, parseUnits(tokenAmount || "0", assetDecimals), parseUnits(usdcAmount || "0", 6)],
        chainId: 5042002,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usdcApproved]);

  useEffect(() => {
    if (liquidityAdded || liquidityRemoved) {
      refetchReserves();
      refetchShares();
    }
  }, [liquidityAdded, liquidityRemoved, refetchReserves, refetchShares]);

  function handleAddLiquidity() {
    if (!tokenAmount && !usdcAmount) return;
    resetApproveToken();
    resetApproveUsdc();
    resetAdd();
    writeApproveToken({
      address: assetToken,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [ADDRESSES.pool, parseUnits(tokenAmount || "0", assetDecimals)],
      chainId: 5042002,
    });
  }

  function handleRemoveLiquidity() {
    if (!sharesToRemove) return;
    writeRemove({
      address: ADDRESSES.pool,
      abi: POOL_ABI,
      functionName: "removeLiquidity",
      args: [assetToken, parseUnits(sharesToRemove, 6)],
      chainId: 5042002,
    });
  }

  const busy = approveTokenPending || tokenApproveConfirming || approveUsdcPending || usdcApproveConfirming || addPending || addConfirming;
  const label = approveTokenPending || tokenApproveConfirming
    ? `Approving ${assetSymbol}…`
    : approveUsdcPending || usdcApproveConfirming
    ? "Approving USDC…"
    : addPending || addConfirming
    ? "Adding liquidity…"
    : "Add liquidity";

  const addErr = approveTokenError || approveUsdcError || addError || tokenApproveReceiptError || usdcApproveReceiptError || addReceiptError;
  const removeErr = removeError || removeReceiptError;

  if (!isConnected) {
    return (
      <>
        <PageHeader title="Liquidity Pool" subtitle="Provide liquidity, earn a bonus on the scarcer side." />
        <Field>
          <p className="mb-4 text-sm text-muted">Connect a wallet to provide liquidity.</p>
          <ConnectButton />
        </Field>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Liquidity Pool" subtitle="Provide liquidity, earn a bonus on the scarcer side." />

      <div className="card mb-6 p-5" style={{ background: "var(--accent-soft)", borderColor: "transparent" }}>
        <p className="text-sm" style={{ color: "var(--text-primary)" }}>
          <strong>How this works: </strong> swap prices come from the live oracle rate, not the
          pool&apos;s own ratio, so you can deposit any combination of {assetSymbol}/USDC freely,
          safely, in any proportion.
        </p>
        <p className="mt-2 text-sm text-muted">
          Because there&apos;s no arbitrage to naturally rebalance the pool, whichever side is
          currently scarcer earns a <strong>10% bonus</strong> in LP shares when you deposit into
          it. That bonus comes from a small dilution of existing LPs&apos; shares, standard liquidity-incentive economics,
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
          label="Pool reserves"
          value={reservesArr ? `${formatUnits(reservesArr[0], assetDecimals)} ${assetSymbol} / ${formatUnits(reservesArr[1], 6)} USDC` : "—"}
        />
        <Row label="Your LP shares" value={myShares !== undefined ? formatUnits(myShares as bigint, 6) : "—"} />
        <Row label="Live vault price" value={referencePriceUSD !== undefined ? `$${formatUnits(referencePriceUSD, 6)} / ${assetSymbol}` : "—"} />

        <p className="mb-2 text-xs font-medium text-subtle uppercase">Add liquidity</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={tokenAmount}
            onChange={(e) => setTokenAmount(e.target.value)}
            placeholder={`${assetSymbol} amount`}
            className="flex-1 rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)" }}
          />
          <input
            value={usdcAmount}
            onChange={(e) => setUsdcAmount(e.target.value)}
            placeholder="USDC amount"
            className="flex-1 rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)" }}
          />
        </div>
        <button
          onClick={handleAddLiquidity}
          disabled={busy}
          className="mt-2 w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--accent)" }}
        >
          {label}
        </button>
        {liquidityAdded && <p className="mt-2 text-sm" style={{ color: "var(--success)" }}>Liquidity added.</p>}
        {addErr && <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>{friendlyError(addErr as Error)}</p>}

        <div className="hairline mt-5 border-t pt-5">
          <p className="mb-2 text-xs font-medium text-subtle uppercase">Remove liquidity</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={sharesToRemove}
              onChange={(e) => setSharesToRemove(e.target.value)}
              placeholder="Shares to remove"
              className="flex-1 rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)" }}
            />
            <button
              onClick={handleRemoveLiquidity}
              disabled={removing}
              className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50"
              style={{ borderColor: "var(--border-strong)" }}
            >
              {removing ? "Removing…" : "Remove"}
            </button>
          </div>
          {liquidityRemoved && <p className="mt-2 text-sm" style={{ color: "var(--success)" }}>Liquidity removed.</p>}
          {removeErr && <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>{friendlyError(removeErr as Error)}</p>}
        </div>
      </Field>
    </>
  );
}