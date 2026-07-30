"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { ArrowDown, ChevronDown } from "lucide-react";
import { ADDRESSES, ERC20_ABI, POOL_ABI, VAULT_ABI } from "@/lib/contracts";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { PageHeader } from "@/components/PageHeader";

type Token = "USDC" | "EURC" | "cirBTC";

const TOKEN_INFO: Record<Token, { address: `0x${string}`; decimals: number }> = {
  USDC: { address: ADDRESSES.usdc, decimals: 6 },
  EURC: { address: ADDRESSES.eurc, decimals: 6 },
  cirBTC: { address: ADDRESSES.cirbtc, decimals: 8 },
};

function friendlyError(err: Error) {
  const msg = err.message || "";
  if (msg.includes("User rejected") || msg.includes("User denied")) return "Rejected in wallet.";
  if (msg.includes("slippage: output too low"))
    return "The price moved before this confirmed. Try again — the quote refreshes automatically.";
  if (msg.includes("insufficient pool inventory"))
    return "This pool is temporarily low on what you're trying to receive. Try a smaller amount, the other direction, or check back shortly.";
  return msg.split("\n")[0] || "Transaction failed. Please try again.";
}

function TokenSelect({
  value,
  options,
  onChange,
}: {
  value: Token;
  options: Token[];
  onChange: (t: Token) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold"
        style={{ borderColor: "var(--border-strong)" }}
      >
        {value}
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="card absolute top-full right-0 z-10 mt-1 min-w-[120px] overflow-hidden">
          {options.map((t) => (
            <button
              key={t}
              onClick={() => {
                onChange(t);
                setOpen(false);
              }}
              className="block w-full px-4 py-2 text-left text-sm hover:bg-(--accent-soft)"
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SwapPage() {
  const { address, isConnected } = useAccount();
  const [payToken, setPayToken] = useState<Token>("USDC");
  const [receiveToken, setReceiveToken] = useState<Token>("EURC");
  const [amountIn, setAmountIn] = useState("");

  // Our pools are USDC/EURC and USDC/cirBTC specifically — one side is always
  // USDC. Picking a non-USDC token on either side forces the other side to USDC.
  function handlePaySelect(t: Token) {
    setPayToken(t);
    if (t !== "USDC") setReceiveToken("USDC");
    else if (receiveToken === "USDC") setReceiveToken("EURC");
    setAmountIn("");
  }

  function handleReceiveSelect(t: Token) {
    setReceiveToken(t);
    if (t !== "USDC") setPayToken("USDC");
    else if (payToken === "USDC") setPayToken("EURC");
    setAmountIn("");
  }

  function flipDirection() {
    setPayToken(receiveToken);
    setReceiveToken(payToken);
    setAmountIn("");
  }

  const tokenToUsdc = payToken !== "USDC";
  const nonUsdcToken = tokenToUsdc ? payToken : receiveToken;
  const assetToken = TOKEN_INFO[nonUsdcToken].address;
  const inputDecimals = TOKEN_INFO[payToken].decimals;
  const outputDecimals = TOKEN_INFO[receiveToken].decimals;
  const inputToken = TOKEN_INFO[payToken].address;

  const { writeContract: writeApprove, data: approveHash, isPending: approving, reset: resetApprove, error: approveError } = useWriteContract();
  const { writeContract: writeSwap, data: swapHash, isPending: swapping, reset: resetSwap, error: swapError } = useWriteContract();
  const { isSuccess: approveConfirmed, error: approveReceiptError } = useWaitForTransactionReceipt({ hash: approveHash });
  const { isSuccess: swapConfirmed, error: swapReceiptError } = useWaitForTransactionReceipt({ hash: swapHash });

  const { data: assetInfo } = useReadContract({
    address: ADDRESSES.vault,
    abi: VAULT_ABI,
    functionName: "collateralAssets",
    args: [assetToken],
    query: { refetchInterval: 15000 },
    chainId: 5042002,
  });

  const { data: quote } = useReadContract({
    address: ADDRESSES.pool,
    abi: POOL_ABI,
    functionName: "quoteSwap",
    args: amountIn ? [assetToken, parseUnits(amountIn || "0", inputDecimals), tokenToUsdc] : undefined,
    query: { enabled: !!amountIn, refetchInterval: 15000 },
    chainId: 5042002,
  });

  useEffect(() => {
    if (approveConfirmed && amountIn && quote !== undefined) {
      writeSwap({
        address: ADDRESSES.pool,
        abi: POOL_ABI,
        functionName: tokenToUsdc ? "swapTokenForUSDC" : "swapUSDCForToken",
        args: [assetToken, parseUnits(amountIn, inputDecimals), quote as bigint],
        chainId: 5042002,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveConfirmed]);

  function handleSwap() {
    if (!amountIn) return;
    resetApprove();
    resetSwap();
    writeApprove({
      address: inputToken,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [ADDRESSES.pool, parseUnits(amountIn, inputDecimals)],
      chainId: 5042002,
    });
  }

  const swapErr = approveError || swapError || approveReceiptError || swapReceiptError;

  if (!isConnected) {
    return (
      <>
        <PageHeader title="Swap" subtitle="Trade EURC or cirBTC against USDC." />
        <div className="card p-6">
          <p className="mb-4 text-sm text-muted">Connect a wallet to swap.</p>
          <ConnectButton />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Swap" subtitle="Trade EURC or cirBTC against USDC." />

      <div className="card mb-6 p-5" style={{ background: "var(--accent-soft)", borderColor: "transparent" }}>
        <p className="text-sm" style={{ color: "var(--text-primary)" }}>
          <strong>How this works: </strong> your price always comes from the live oracle rate, not
          the ratio of tokens sitting in the pool — so you never get a worse price just because a
          pool is imbalanced.
        </p>
        <p className="mt-2 text-sm text-muted">
          The tradeoff: a pool can run low on whichever side is currently in demand. If that
          happens, your swap will fail rather than execute at a distorted price.
        </p>
      </div>

      <div className="mb-4 flex items-center justify-between text-sm">
        <span className="text-muted">Live {nonUsdcToken} price</span>
        <span className="font-data">
          {assetInfo ? `$${formatUnits((assetInfo as [boolean, number, bigint])[2], 6)}` : "—"}
        </span>
      </div>

      <div className="relative">
        <div className="card p-4">
          <p className="mb-2 text-xs font-medium text-subtle uppercase">You pay</p>
          <div className="flex items-center justify-between gap-3">
            <input
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
              placeholder="0"
              className="font-data w-full border-none bg-transparent text-2xl font-medium outline-none"
            />
            <TokenSelect value={payToken} options={["USDC", "EURC", "cirBTC"]} onChange={handlePaySelect} />
          </div>
        </div>

        <button
          onClick={flipDirection}
          aria-label="Flip direction"
          className="card absolute top-1/2 left-1/2 z-10 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
          style={{ borderWidth: 3, borderColor: "var(--bg)" }}
        >
          <ArrowDown size={16} />
        </button>

        <div className="card mt-1 p-4">
          <p className="mb-2 text-xs font-medium text-subtle uppercase">You receive</p>
          <div className="flex items-center justify-between gap-3">
            <span className="font-data w-full truncate text-2xl font-medium text-muted">
              {quote !== undefined && amountIn ? formatUnits(quote as bigint, outputDecimals) : "0"}
            </span>
            <TokenSelect value={receiveToken} options={["USDC", "EURC", "cirBTC"]} onChange={handleReceiveSelect} />
          </div>
        </div>
      </div>

      <button
        onClick={handleSwap}
        disabled={approving || swapping || !amountIn}
        className="mt-4 w-full rounded-lg py-3 text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: "var(--accent)" }}
      >
        {approving ? "Approving…" : swapping ? "Swapping…" : "Swap"}
      </button>

      {swapConfirmed && <p className="mt-3 text-sm" style={{ color: "var(--success)" }}>Swap confirmed.</p>}
      {swapErr && <p className="mt-3 text-sm" style={{ color: "var(--danger)" }}>{friendlyError(swapErr as Error)}</p>}
    </>
  );
}