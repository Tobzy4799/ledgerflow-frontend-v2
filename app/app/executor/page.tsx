"use client";

import { useEffect, useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { waitForTransactionReceipt, readContract } from "wagmi/actions";
import { parseUnits, parseAbiItem, decodeEventLog, formatUnits } from "viem";
import { ADDRESSES, ERC20_ABI, VAULT_ABI, POOL_ABI, AGENT_AUTH_ABI } from "@/lib/contracts";
import { wagmiConfig } from "@/lib/wagmi";
import { ConnectWallet } from "@/components/ConnectWallet";
import { PageHeader } from "@/components/PageHeader";

const EXECUTOR_WALLET_ADDRESS = "0x4b9a4af1d4e08350a112fc5948076a4de7b9df27" as const;

type Action =
  | { type: "swap"; direction: string; amount: string }
  | { type: "depositCollateral"; asset: string; amount: string }
  | { type: "withdrawCollateral"; asset: string; amount: string }
  | { type: "borrow"; amount: string }
  | { type: "repay"; amount: string }
  | { type: "supply"; amount: string }
  | { type: "withdrawSupply"; shares: string };

const SWAPPED_EVENT = parseAbiItem(
  "event Swapped(address indexed trader, address indexed token, bool tokenToUsdc, uint256 amountIn, uint256 amountOut)"
);

function assetAddress(asset: string) {
  return asset === "cirbtc" ? ADDRESSES.cirbtc : ADDRESSES.eurc;
}

function assetDecimals(asset: string) {
  return asset === "cirbtc" ? 8 : 6;
}

function friendlyError(msg: string): string {
  if (msg.includes("User rejected") || msg.includes("User denied")) return "Rejected in wallet.";
  if (msg.includes("would break borrow limit")) return "That withdrawal would leave an active borrow uncovered.";
  if (msg.includes("exceeds borrow limit")) return "That's more than your collateral currently allows you to borrow.";
  if (msg.includes("insufficient shares")) return "You don't have that many shares.";
  if (msg.includes("insufficient idle liquidity")) return "Not enough idle USDC in the pool right now to withdraw that much.";
  if (msg.includes("slippage: output too low")) return "The price moved before this confirmed, try again.";
  if (msg.includes("insufficient pool inventory")) return "The swap pool is temporarily low on what you're trying to receive.";
  if (msg.includes("insufficient balance")) return "You don't have enough balance for this.";
  return msg.split("\n")[0] || "That step failed. Please try again.";
}

export default function ExecutorPage() {
  const [prompt, setPrompt] = useState("");
  const [actions, setActions] = useState<Action[]>([]);
  const [clarification, setClarification] = useState<string | null>(null);
  const [suggestedPrompt, setSuggestedPrompt] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [parsing, setParsing] = useState(false);

  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [maxPerAction, setMaxPerAction] = useState("");
  const [dailyLimit, setDailyLimit] = useState("");
  const [standingApproval, setStandingApproval] = useState("");

  const { data: executorAuth, refetch: refetchAuth } = useReadContract({
    address: ADDRESSES.agentAuth,
    abi: AGENT_AUTH_ABI,
    functionName: "authorizations",
    args: address ? [address, EXECUTOR_WALLET_ADDRESS] : undefined,
    query: { enabled: !!address },
    chainId: 5042002,
  });

  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
    address: ADDRESSES.usdc,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, ADDRESSES.vault] : undefined,
    query: { enabled: !!address },
    chainId: 5042002,
  });

  const { writeContract: writeAuthorize, data: authorizeHash, isPending: authorizing, error: authorizeError } = useWriteContract();
  const { writeContract: writeRevoke, data: revokeHash, isPending: revoking, error: revokeError } = useWriteContract();
  const { writeContract: writeStandingApprove, data: standingApproveHash, isPending: standingApproving, error: standingApproveError } = useWriteContract();

  const { isSuccess: authorizeConfirmed, error: authorizeReceiptError } = useWaitForTransactionReceipt({ hash: authorizeHash });
  const { isSuccess: revokeConfirmed, error: revokeReceiptError } = useWaitForTransactionReceipt({ hash: revokeHash });
  const { isSuccess: standingApproveConfirmed, error: standingApproveReceiptError } = useWaitForTransactionReceipt({ hash: standingApproveHash });

  useEffect(() => {
    if (authorizeConfirmed || revokeConfirmed) refetchAuth();
  }, [authorizeConfirmed, revokeConfirmed, refetchAuth]);

  useEffect(() => {
    if (standingApproveConfirmed) refetchAllowance();
  }, [standingApproveConfirmed, refetchAllowance]);

  const auth = executorAuth as [boolean, bigint, bigint, bigint, bigint] | undefined;
  const isAuthorized = auth ? auth[0] : false;

  function handleAuthorize() {
    if (!maxPerAction || !dailyLimit) return;
    writeAuthorize({
      address: ADDRESSES.agentAuth,
      abi: AGENT_AUTH_ABI,
      functionName: "authorizeAgent",
      args: [EXECUTOR_WALLET_ADDRESS, parseUnits(maxPerAction, 6), parseUnits(dailyLimit, 6)],
      chainId: 5042002,
    });
  }

  function handleRevoke() {
    writeRevoke({
      address: ADDRESSES.agentAuth,
      abi: AGENT_AUTH_ABI,
      functionName: "revokeAgent",
      args: [EXECUTOR_WALLET_ADDRESS],
      chainId: 5042002,
    });
  }

  function handleStandingApprove() {
    if (!standingApproval) return;
    writeStandingApprove({
      address: ADDRESSES.usdc,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [ADDRESSES.vault, parseUnits(standingApproval, 6)],
      chainId: 5042002,
    });
  }

  function appendLog(msg: string) {
    setLog((prev) => [...prev, msg]);
  }

  async function handleParse() {
    if (!prompt) return;
    setParsing(true);
    setActions([]);
    setClarification(null);
    setSuggestedPrompt(null);
    setLog([]);
    try {
      appendLog("Collecting a small service fee from your wallet…");
      const res = await fetch("/api/executor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, userAddress: address }),
      });
      const data = await res.json();
      if (data.error) {
        appendLog(data.error);
      } else if (data.clarificationNeeded) {
        setClarification(data.clarificationNeeded);
        setSuggestedPrompt(data.suggestedPrompt || null);
      } else {
        appendLog("Fee collected ✓");
        const parsedActions = data.actions || [];
        setActions(parsedActions);
        if (parsedActions.length > 0) {
          await handleExecute(parsedActions);
        }
      }
    } catch (err) {
      appendLog(friendlyError((err as Error).message));
    }
    setParsing(false);
  }

  function useSuggestion() {
    if (!suggestedPrompt) return;
    setPrompt(suggestedPrompt);
    setClarification(null);
    setSuggestedPrompt(null);
  }

  async function approve(token: `0x${string}`, spender: `0x${string}`, amount: bigint) {
    if (!address) return;
    const currentAllowance = (await readContract(wagmiConfig, {
      address: token,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [address, spender],
      chainId: 5042002,
    })) as bigint;

    if (currentAllowance >= amount) {
      appendLog("Existing approval already covers this — skipping.");
      return;
    }

    appendLog("Approving…");
    const hash = await writeContractAsync({
      address: token,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [spender, amount * 100n],
      chainId: 5042002,
    });
    await waitForTransactionReceipt(wagmiConfig, { hash });
  }

  async function executeAction(action: Action): Promise<bigint | undefined> {
    if (action.type === "swap") {
      const usdcToX = action.direction.startsWith("usdcTo");
      const targetAsset = action.direction.toLowerCase().includes("eurc") ? "eurc" : "cirbtc";
      const targetToken = assetAddress(targetAsset);
      const targetDecimals = assetDecimals(targetAsset);
      const inputDecimals = usdcToX ? 6 : targetDecimals;
      const amount = parseUnits(action.amount, inputDecimals);
      const inputToken = usdcToX ? ADDRESSES.usdc : targetToken;

      const quote = (await readContract(wagmiConfig, {
        address: ADDRESSES.pool,
        abi: POOL_ABI,
        functionName: "quoteSwap",
        args: [targetToken, amount, !usdcToX],
        chainId: 5042002,
      })) as bigint;
      const minOut = (quote * 99n) / 100n;

      await approve(inputToken, ADDRESSES.pool, amount);
      appendLog(`Swapping ${action.amount}…`);
      const hash = await writeContractAsync({
        address: ADDRESSES.pool,
        abi: POOL_ABI,
        functionName: usdcToX ? "swapUSDCForToken" : "swapTokenForUSDC",
        args: [targetToken, amount, minOut],
        chainId: 5042002,
      });
      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash });

      let actualOut: bigint | undefined;
      for (const txLog of receipt.logs) {
        try {
          const decoded = decodeEventLog({ abi: [SWAPPED_EVENT], data: txLog.data, topics: txLog.topics });
          if (decoded.eventName === "Swapped") {
            actualOut = decoded.args.amountOut as bigint;
            break;
          }
        } catch {
          // not the event we're looking for
        }
      }
      appendLog("Swap confirmed ✓");
      return actualOut;
    }

    if (action.type === "depositCollateral") {
      const token = assetAddress(action.asset);
      const amount = parseUnits(action.amount, assetDecimals(action.asset));
      await approve(token, ADDRESSES.vault, amount);
      appendLog(`Depositing ${action.amount} ${action.asset}…`);
      const hash = await writeContractAsync({ address: ADDRESSES.vault, abi: VAULT_ABI, functionName: "depositCollateral", args: [token, amount], chainId: 5042002 });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      appendLog("Deposit confirmed ✓");
    }

    if (action.type === "withdrawCollateral") {
      const token = assetAddress(action.asset);
      const amount = parseUnits(action.amount, assetDecimals(action.asset));
      appendLog(`Withdrawing ${action.amount} ${action.asset}…`);
      const hash = await writeContractAsync({ address: ADDRESSES.vault, abi: VAULT_ABI, functionName: "withdrawCollateral", args: [token, amount], chainId: 5042002 });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      appendLog("Withdraw confirmed ✓");
    }

    if (action.type === "borrow") {
      const amount = parseUnits(action.amount, 6);
      appendLog(`Borrowing ${action.amount} USDC…`);
      const hash = await writeContractAsync({ address: ADDRESSES.vault, abi: VAULT_ABI, functionName: "borrow", args: [amount], chainId: 5042002 });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      appendLog("Borrow confirmed ✓");
    }

    if (action.type === "repay") {
      const amount = parseUnits(action.amount, 6);
      await approve(ADDRESSES.usdc, ADDRESSES.vault, amount);
      appendLog(`Repaying ${action.amount} USDC…`);
      const hash = await writeContractAsync({ address: ADDRESSES.vault, abi: VAULT_ABI, functionName: "repay", args: [amount], chainId: 5042002 });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      appendLog("Repay confirmed ✓");
    }

    if (action.type === "supply") {
      const amount = parseUnits(action.amount, 6);
      await approve(ADDRESSES.usdc, ADDRESSES.vault, amount);
      appendLog(`Supplying ${action.amount} USDC…`);
      const hash = await writeContractAsync({ address: ADDRESSES.vault, abi: VAULT_ABI, functionName: "supply", args: [amount], chainId: 5042002 });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      appendLog("Supply confirmed ✓");
    }

    if (action.type === "withdrawSupply") {
      const shares = parseUnits(action.shares, 6);
      appendLog("Withdrawing supply shares…");
      const hash = await writeContractAsync({ address: ADDRESSES.vault, abi: VAULT_ABI, functionName: "withdrawSupply", args: [shares], chainId: 5042002 });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      appendLog("Withdraw confirmed ✓");
    }

    return undefined;
  }

  async function depositExactAmount(asset: string, amount: bigint) {
    const token = assetAddress(asset);
    await approve(token, ADDRESSES.vault, amount);
    appendLog(`Depositing exact received amount (${asset})…`);
    const hash = await writeContractAsync({ address: ADDRESSES.vault, abi: VAULT_ABI, functionName: "depositCollateral", args: [token, amount], chainId: 5042002 });
    await waitForTransactionReceipt(wagmiConfig, { hash });
    appendLog("Deposit confirmed ✓");
  }

  async function handleExecute(actionsToRun: Action[]) {
    let lastSwapOutput: { asset: string; amount: bigint } | null = null;
    for (const action of actionsToRun) {
      try {
        if (action.type === "depositCollateral" && lastSwapOutput && lastSwapOutput.asset === action.asset) {
          await depositExactAmount(action.asset, lastSwapOutput.amount);
          lastSwapOutput = null;
        } else {
          const output = await executeAction(action);
          if (action.type === "swap" && output !== undefined) {
            const targetAsset = action.direction.toLowerCase().includes("eurc") ? "eurc" : "cirbtc";
            lastSwapOutput = { asset: targetAsset, amount: output };
          }
        }
      } catch (err) {
        appendLog(friendlyError((err as Error).message));
        break;
      }
    }
  }

  if (!isConnected) {
    return (
      <>
        <PageHeader title="Executor" subtitle="Describe what you want to do, in plain English." />
        <div className="card p-6">
          <p className="mb-4 text-sm text-muted">Connect a wallet to use the Executor.</p>
          <ConnectWallet />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Executor" subtitle="Describe what you want to do, in plain English." />

      <div className="card mb-6 p-5" style={{ background: "var(--accent-soft)", borderColor: "transparent" }}>
        <p className="text-sm" style={{ color: "var(--text-primary)" }}>
          <strong>How this works: </strong> type what you want like &ldquo;swap 50 USDC for EURC and
          deposit it as collateral&rdquo; and it parses and runs the whole sequence. Each
          individual step still needs its own wallet confirmation, so nothing executes without
          your explicit approval.
        </p>
        <p className="mt-2 text-sm text-muted">
          Needs a one-time setup first: authorize the Executor as an agent, same standing USDC approval shared across every agent you activate. Each use
          collects a small, genuine fee from your own wallet.
        </p>
      </div>

      {!isAuthorized && (
        <div className="card mb-6 p-5">
          <p className="mb-3 text-sm font-medium">Set up Executor first</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={maxPerAction}
              onChange={(e) => setMaxPerAction(e.target.value)}
              placeholder="Max USDC per action"
              className="flex-1 rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)" }}
            />
            <input
              value={dailyLimit}
              onChange={(e) => setDailyLimit(e.target.value)}
              placeholder="Max USDC per day"
              className="flex-1 rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)" }}
            />
          </div>
          <button
            onClick={handleAuthorize}
            disabled={authorizing}
            className="mt-2 w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--accent)" }}
          >
            {authorizing ? "Authorizing…" : "Activate Executor"}
          </button>
          {(authorizeError || authorizeReceiptError) && (
            <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>{friendlyError((authorizeError || authorizeReceiptError)!.message)}</p>
          )}

          <div className="hairline mt-4 border-t pt-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted">Standing USDC approval</span>
              <span className="font-data">{currentAllowance !== undefined ? formatUnits(currentAllowance as bigint, 6) : "—"} USDC</span>
            </div>
            <p className="mb-2 text-xs text-subtle">
              Shared across every agent, if you&apos;ve already set this up for Guardian, no need to repeat it here.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={standingApproval}
                onChange={(e) => setStandingApproval(e.target.value)}
                placeholder="USDC to approve"
                className="flex-1 rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border)" }}
              />
              <button
                onClick={handleStandingApprove}
                disabled={standingApproving}
                className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50"
                style={{ borderColor: "var(--border-strong)" }}
              >
                {standingApproving ? "Approving…" : "Set approval"}
              </button>
            </div>
            {standingApproveConfirmed && <p className="mt-2 text-sm" style={{ color: "var(--success)" }}>Approval updated.</p>}
            {(standingApproveError || standingApproveReceiptError) && (
              <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>{friendlyError((standingApproveError || standingApproveReceiptError)!.message)}</p>
            )}
          </div>
        </div>
      )}

      {isAuthorized && (
        <div className="card mb-6 flex items-center justify-between p-4">
          <span className="text-sm">
            <span className="rounded-full px-2 py-1 text-xs font-semibold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>Active</span>
            <span className="ml-2 text-muted">Executor is authorized and ready.</span>
          </span>
          <button onClick={handleRevoke} disabled={revoking} className="text-sm font-semibold" style={{ color: "var(--danger)" }}>
            {revoking ? "Revoking…" : "Revoke"}
          </button>
        </div>
      )}

      <div className="card p-6">
        <p className="mb-2 text-xs font-medium text-subtle uppercase">What can I ask it to do?</p>
        <ul className="mb-4 space-y-1 text-sm text-muted">
          <li><strong>Swap</strong> — &ldquo;swap 20 USDC for EURC&rdquo;</li>
          <li><strong>Deposit / withdraw collateral</strong> — &ldquo;deposit 10 EURC as collateral&rdquo;</li>
          <li><strong>Borrow / repay</strong> — &ldquo;borrow 15 USDC&rdquo;</li>
          <li><strong>Supply / withdraw supply</strong> — &ldquo;supply 50 USDC&rdquo;</li>
        </ul>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder='e.g. "swap 50 USDC for EURC and deposit it as collateral"'
            className="flex-1 rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)" }}
          />
          <button
            onClick={handleParse}
            disabled={parsing}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--accent)" }}
          >
            {parsing ? "Working…" : "Run"}
          </button>
        </div>

        {clarification && (
          <div className="mt-3">
            <p className="text-sm" style={{ color: "var(--danger)" }}>{clarification}</p>
            {suggestedPrompt && (
              <button onClick={useSuggestion} className="mt-2 rounded-md border px-3 py-1.5 text-sm" style={{ borderColor: "var(--border)" }}>
                Did you mean: &ldquo;{suggestedPrompt}&rdquo;? Use this
              </button>
            )}
          </div>
        )}

        {actions.length > 0 && (
          <div className="mt-4">
            <p className="mb-1 text-sm text-muted">Planned steps:</p>
            <ol className="space-y-1 text-sm">
              {actions.map((a, i) => (
                <li key={i} className="font-data text-xs text-subtle">{JSON.stringify(a)}</li>
              ))}
            </ol>
          </div>
        )}

        {log.length > 0 && (
          <div className="mt-3 rounded-lg p-3 font-mono text-xs" style={{ background: "#0e1c33", color: "#e6ecf5" }}>
            {log.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}