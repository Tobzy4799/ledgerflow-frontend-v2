"use client";

import { useEffect, useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { ADDRESSES, ERC20_ABI, AGENT_AUTH_ABI } from "@/lib/contracts";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { PageHeader } from "@/components/PageHeader";

const GUARDIAN_WALLET_ADDRESS = "0xf7c2e43078ded0045b05289e86421ac2dab90a35" as const;

function Field({ children }: { children: React.ReactNode }) {
  return <div className="card p-6">{children}</div>;
}

function friendlyError(err: Error) {
  const msg = err.message || "";
  if (msg.includes("User rejected") || msg.includes("User denied")) return "Rejected in wallet.";
  if (msg.includes("invalid agent")) return "Something's wrong with the agent address — try reloading the page.";
  return msg.split("\n")[0] || "Transaction failed. Please try again.";
}

export default function GuardianPage() {
  const { address, isConnected } = useAccount();
  const [maxPerAction, setMaxPerAction] = useState("");
  const [dailyLimit, setDailyLimit] = useState("");
  const [standingApproval, setStandingApproval] = useState("");

  const { writeContract: writeAuthorize, data: authorizeHash, isPending: authorizing, error: authorizeError } = useWriteContract();
  const { writeContract: writeRevoke, data: revokeHash, isPending: revoking, error: revokeError } = useWriteContract();
  const { writeContract: writeStandingApprove, data: standingApproveHash, isPending: standingApproving, error: standingApproveError } = useWriteContract();

  const { isSuccess: authorizeConfirmed, error: authorizeReceiptError } = useWaitForTransactionReceipt({ hash: authorizeHash });
  const { isSuccess: revokeConfirmed, error: revokeReceiptError } = useWaitForTransactionReceipt({ hash: revokeHash });
  const { isSuccess: standingApproveConfirmed, error: standingApproveReceiptError } = useWaitForTransactionReceipt({ hash: standingApproveHash });

  const { data: authInfo, refetch: refetchAuth } = useReadContract({
    address: ADDRESSES.agentAuth,
    abi: AGENT_AUTH_ABI,
    functionName: "authorizations",
    args: address ? [address, GUARDIAN_WALLET_ADDRESS] : undefined,
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

  useEffect(() => {
    if (authorizeConfirmed || revokeConfirmed) refetchAuth();
  }, [authorizeConfirmed, revokeConfirmed, refetchAuth]);

  useEffect(() => {
    if (standingApproveConfirmed) refetchAllowance();
  }, [standingApproveConfirmed, refetchAllowance]);

  const auth = authInfo as [boolean, bigint, bigint, bigint, bigint] | undefined;
  const isAuthorized = auth ? auth[0] : false;

  function handleAuthorize() {
    if (!maxPerAction || !dailyLimit) return;
    writeAuthorize({
      address: ADDRESSES.agentAuth,
      abi: AGENT_AUTH_ABI,
      functionName: "authorizeAgent",
      args: [GUARDIAN_WALLET_ADDRESS, parseUnits(maxPerAction, 6), parseUnits(dailyLimit, 6)],
      chainId: 5042002,
    });
  }

  function handleRevoke() {
    writeRevoke({
      address: ADDRESSES.agentAuth,
      abi: AGENT_AUTH_ABI,
      functionName: "revokeAgent",
      args: [GUARDIAN_WALLET_ADDRESS],
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

  const authErr = authorizeError || authorizeReceiptError;
  const revokeErr = revokeError || revokeReceiptError;
  const approveErr = standingApproveError || standingApproveReceiptError;

  if (!isConnected) {
    return (
      <>
        <PageHeader title="Guardian" subtitle="Autonomous protection for your position." />
        <Field>
          <p className="mb-4 text-sm text-muted">Connect a wallet to set up Guardian.</p>
          <ConnectButton />
        </Field>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Guardian" subtitle="Autonomous protection for your position." />

      <div className="card mb-6 p-5" style={{ background: "var(--accent-soft)", borderColor: "transparent" }}>
        <p className="text-sm" style={{ color: "var(--text-primary)" }}>
          <strong>How this works: </strong> Guardian checks your position every 60 seconds. At 70%
          utilization, it warns you. At 75%, it autonomously repays part of your debt to pull you
          back to safety, no action needed from you once it&apos;s set up.
        </p>
        <p className="mt-2 text-sm text-muted">
          Setup one-time: authorize Guardian with your own spending limits, then set a
          standing USDC approval it can draw from. Guardian collects a tiny fee (a fraction of a
          cent) from your own wallet each time it actually acts which is for genuine revenue for the
          platform, not something Guardian pays itself.
        </p>
      </div>

      <Field>
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-medium">Status</span>
          <span
            className="rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{
              background: isAuthorized ? "var(--accent-soft)" : "var(--border)",
              color: isAuthorized ? "var(--accent)" : "var(--text-secondary)",
            }}
          >
            {isAuthorized ? "Active" : "Not set up"}
          </span>
        </div>

        {isAuthorized && auth && (
          <>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted">Max per action</span>
              <span className="font-data">{formatUnits(auth[1], 6)} USDC</span>
            </div>
            <div className="mb-4 flex items-center justify-between text-sm">
              <span className="text-muted">Max per day</span>
              <span className="font-data">{formatUnits(auth[2], 6)} USDC</span>
            </div>
          </>
        )}

        <p className="mb-2 text-xs font-medium text-subtle uppercase">
          {isAuthorized ? "Update limits" : "Set limits and activate"}
        </p>
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
        <div className="mt-2 flex gap-2">
          <button
            onClick={handleAuthorize}
            disabled={authorizing}
            className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--accent)" }}
          >
            {authorizing ? "Authorizing…" : isAuthorized ? "Update" : "Activate Guardian"}
          </button>
          {isAuthorized && (
            <button
              onClick={handleRevoke}
              disabled={revoking}
              className="rounded-lg border px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
              style={{ borderColor: "var(--border-strong)", color: "var(--danger)" }}
            >
              {revoking ? "Revoking…" : "Revoke"}
            </button>
          )}
        </div>
        {authorizeConfirmed && <p className="mt-2 text-sm" style={{ color: "var(--success)" }}>Guardian activated.</p>}
        {revokeConfirmed && <p className="mt-2 text-sm" style={{ color: "var(--success)" }}>Guardian revoked.</p>}
        {authErr && <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>{friendlyError(authErr as Error)}</p>}
        {revokeErr && <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>{friendlyError(revokeErr as Error)}</p>}
      </Field>

      <div className="mt-4">
        <Field>
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-medium">Standing USDC approval</span>
            <span className="font-data text-sm">
              {currentAllowance !== undefined ? formatUnits(currentAllowance as bigint, 6) : "—"} USDC
            </span>
          </div>
          <p className="mb-3 text-sm text-muted">
            This is shared across every agent you activate, not just Guardian. We&apos;d
            recommend setting it to roughly 3–5× your daily limit, so you won&apos;t need to
            come back and re-approve every few days.
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
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--accent)" }}
            >
              {standingApproving ? "Approving…" : "Set approval"}
            </button>
          </div>
          {standingApproveConfirmed && <p className="mt-2 text-sm" style={{ color: "var(--success)" }}>Approval updated.</p>}
          {approveErr && <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>{friendlyError(approveErr as Error)}</p>}
        </Field>
      </div>
    </>
  );
}