"use client";

import { useEffect, useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import { ADDRESSES, ERC20_ABI, AGENT_AUTH_ABI } from "@/lib/contracts";
import { ConnectWallet } from "@/components/ConnectWallet";
import { PageHeader } from "@/components/PageHeader";

const CONDITIONAL_AGENT_WALLET = "0x963c37428bbb5091e8511b82b894d028537333d5" as const;
const API_BASE = process.env.NEXT_PUBLIC_AGENT_API_URL || "http://localhost:3001";

type Rule = {
  id: number;
  condition_type: string;
  condition_asset: string | null;
  threshold: number | null;
  interval_days: number | null;
  swap_asset: string | null;
  swap_direction: string;
  swap_amount: number;
  active: boolean;
  last_triggered_at: string | null;
  last_error: string | null;
};

function friendlyError(msg: string): string {
  if (msg.includes("User rejected") || msg.includes("User denied")) return "Rejected in wallet.";
  return msg.split("\n")[0] || "Something went wrong. Please try again.";
}

function describeRule(rule: Rule): string {
  const asset = rule.condition_asset || rule.swap_asset || "asset";
  const actionText = rule.swap_direction === "assetToUsdc" ? `sell ${rule.swap_amount} ${asset}` : `buy ${asset} with ${rule.swap_amount} USDC`;

  if (rule.condition_type === "time_interval") {
    return `Every ${rule.interval_days} day(s) → ${actionText} (DCA)`;
  }
  const comparison = rule.condition_type === "price_above" ? "above" : "below";
  return `When ${asset} is ${comparison} $${rule.threshold} → ${actionText}`;
}

// The AI parser returns camelCase fields; saved rules from the database use
// snake_case. This lets the preview reuse the same describeRule() function
// instead of duplicating the readable-summary logic for both shapes.
function normalizeForDisplay(parsed: any): Rule {
  return {
    id: 0,
    condition_type: parsed.conditionType,
    condition_asset: parsed.conditionAsset,
    threshold: parsed.threshold,
    interval_days: parsed.intervalDays,
    swap_asset: parsed.swapAsset,
    swap_direction: parsed.swapDirection,
    swap_amount: parsed.swapAmount,
    active: true,
    last_triggered_at: null,
    last_error: null,
  };
}

export default function ConditionalAgentsPage() {
  const { address, isConnected } = useAccount();
  const [maxPerAction, setMaxPerAction] = useState("");
  const [dailyLimit, setDailyLimit] = useState("");
  const [poolApprovalAsset, setPoolApprovalAsset] = useState<"eurc" | "cirbtc">("eurc");
  const [poolApprovalAmount, setPoolApprovalAmount] = useState("");
  const [instruction, setInstruction] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsedRule, setParsedRule] = useState<any>(null);
  const [clarification, setClarification] = useState<string | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const { data: agentAuth, refetch: refetchAuth } = useReadContract({
    address: ADDRESSES.agentAuth,
    abi: AGENT_AUTH_ABI,
    functionName: "authorizations",
    args: address ? [address, CONDITIONAL_AGENT_WALLET] : undefined,
    query: { enabled: !!address },
    chainId: 5042002,
  });

  const { writeContract: writeAuthorize, data: authorizeHash, isPending: authorizing, error: authorizeError } = useWriteContract();
  const { writeContract: writeRevoke, data: revokeHash, isPending: revoking } = useWriteContract();
  const { writeContract: writePoolApprove, data: poolApproveHash, isPending: poolApproving, error: poolApproveError } = useWriteContract();

  const { isSuccess: authorizeConfirmed, error: authorizeReceiptError } = useWaitForTransactionReceipt({ hash: authorizeHash });
  const { isSuccess: revokeConfirmed } = useWaitForTransactionReceipt({ hash: revokeHash });
  const { isSuccess: poolApproveConfirmed, error: poolApproveReceiptError } = useWaitForTransactionReceipt({ hash: poolApproveHash });

  useEffect(() => {
    if (authorizeConfirmed || revokeConfirmed) refetchAuth();
  }, [authorizeConfirmed, revokeConfirmed, refetchAuth]);

  const auth = agentAuth as [boolean, bigint, bigint, bigint, bigint] | undefined;
  const isAuthorized = auth ? auth[0] : false;

  async function refreshRules() {
    if (!address) return;
    try {
      const res = await fetch(`${API_BASE}/conditional-agents/${address}`);
      const data = await res.json();
      setRules(data.agents || []);
    } catch {
      // silently fail — rule list just stays as-is
    }
  }

  useEffect(() => {
    refreshRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  function handleAuthorize() {
    if (!maxPerAction || !dailyLimit) return;
    writeAuthorize({
      address: ADDRESSES.agentAuth,
      abi: AGENT_AUTH_ABI,
      functionName: "authorizeAgent",
      args: [CONDITIONAL_AGENT_WALLET, parseUnits(maxPerAction, 6), parseUnits(dailyLimit, 6)],
      chainId: 5042002,
    });
  }

  function handleRevoke() {
    writeRevoke({
      address: ADDRESSES.agentAuth,
      abi: AGENT_AUTH_ABI,
      functionName: "revokeAgent",
      args: [CONDITIONAL_AGENT_WALLET],
      chainId: 5042002,
    });
  }

  function handlePoolApprove() {
    if (!poolApprovalAmount) return;
    const token = poolApprovalAsset === "eurc" ? ADDRESSES.eurc : ADDRESSES.cirbtc;
    const decimals = poolApprovalAsset === "eurc" ? 6 : 8;
    writePoolApprove({
      address: token,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [ADDRESSES.pool, parseUnits(poolApprovalAmount, decimals) * 100n],
      chainId: 5042002,
    });
  }

  async function handleParse() {
    if (!instruction) return;
    setParsing(true);
    setParsedRule(null);
    setClarification(null);
    setCreateError(null);
    try {
      const res = await fetch(`${API_BASE}/parse-conditional-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
      });
      const data = await res.json();
      if (data.clarificationNeeded) {
        setClarification(data.clarificationNeeded);
      } else {
        setParsedRule(data.rule);
      }
    } catch (err) {
      setCreateError(friendlyError((err as Error).message));
    }
    setParsing(false);
  }

  async function handleCreate() {
    if (!parsedRule || !address) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch(`${API_BASE}/create-conditional-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userAddress: address, rule: parsedRule }),
      });
      const data = await res.json();
      if (data.error) {
        setCreateError(data.error);
      } else {
        setParsedRule(null);
        setInstruction("");
        refreshRules();
      }
    } catch (err) {
      setCreateError(friendlyError((err as Error).message));
    }
    setCreating(false);
  }

  async function handleDeactivate(id: number) {
    await fetch(`${API_BASE}/conditional-agents/${id}/deactivate`, { method: "POST" });
    refreshRules();
  }

  if (!isConnected) {
    return (
      <>
        <PageHeader title="Conditional Agents" subtitle="Price-triggered swaps and recurring DCA rules." />
        <div className="card p-6">
          <p className="mb-4 text-sm text-muted">Connect a wallet to set up a rule.</p>
          <ConnectWallet />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Conditional Agents" subtitle="Price-triggered swaps and recurring DCA rules." />

      <div className="card mb-6 p-5" style={{ background: "var(--accent-soft)", borderColor: "transparent" }}>
        <p className="text-sm" style={{ color: "var(--text-primary)" }}>
          <strong>Two kinds of rules: </strong> price-triggered (e.g. &ldquo;sell 10 EURC when it
          hits $1.20&rdquo;) fire once, then stop. Recurring DCA (e.g. &ldquo;buy 20 USDC of EURC
          every 7 days&rdquo;) fire repeatedly until you deactivate them.
        </p>
        <p className="mt-2 text-sm text-muted">
          Uses its own separate wallet, a different authorization from Guardian or Executor. Also
          needs a separate approval on the swap pool itself, in addition to the usual standing
          approval.
        </p>
      </div>

      {!isAuthorized ? (
        <div className="card mb-6 p-5">
          <p className="mb-3 text-sm font-medium">Set up first</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input value={maxPerAction} onChange={(e) => setMaxPerAction(e.target.value)} placeholder="Max USDC per action" className="flex-1 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }} />
            <input value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} placeholder="Max USDC per day" className="flex-1 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }} />
          </div>
          <button onClick={handleAuthorize} disabled={authorizing} className="mt-2 w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--accent)" }}>
            {authorizing ? "Authorizing…" : "Activate"}
          </button>
          {(authorizeError || authorizeReceiptError) && (
            <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>{friendlyError((authorizeError || authorizeReceiptError)!.message)}</p>
          )}

          <div className="hairline mt-4 border-t pt-4">
            <p className="mb-2 text-xs font-medium text-subtle uppercase">Approve the pool (needed for swaps)</p>
            <div className="mb-2 flex gap-2">
              {(["eurc", "cirbtc"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setPoolApprovalAsset(a)}
                  className="rounded-md border px-3 py-1 text-xs font-medium"
                  style={{ borderColor: poolApprovalAsset === a ? "var(--accent)" : "var(--border)", color: poolApprovalAsset === a ? "var(--accent)" : "var(--text-secondary)" }}
                >
                  {a === "eurc" ? "EURC" : "cirBTC"}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input value={poolApprovalAmount} onChange={(e) => setPoolApprovalAmount(e.target.value)} placeholder="Amount to approve" className="flex-1 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }} />
              <button onClick={handlePoolApprove} disabled={poolApproving} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ borderColor: "var(--border-strong)" }}>
                {poolApproving ? "Approving…" : "Approve"}
              </button>
            </div>
            {poolApproveConfirmed && <p className="mt-2 text-sm" style={{ color: "var(--success)" }}>Pool approval set.</p>}
            {(poolApproveError || poolApproveReceiptError) && (
              <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>{friendlyError((poolApproveError || poolApproveReceiptError)!.message)}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="card mb-6 flex items-center justify-between p-4">
          <span className="text-sm">
            <span className="rounded-full px-2 py-1 text-xs font-semibold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>Active</span>
            <span className="ml-2 text-muted">Conditional Agents is authorized and ready.</span>
          </span>
          <button onClick={handleRevoke} disabled={revoking} className="text-sm font-semibold" style={{ color: "var(--danger)" }}>
            {revoking ? "Revoking…" : "Revoke"}
          </button>
        </div>
      )}

      <div className="card mb-4 p-6">
        <p className="mb-2 text-xs font-medium text-subtle uppercase">Create a rule</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder='e.g. "sell 10 EURC when it hits $1.20"'
            className="flex-1 rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)" }}
          />
          <button onClick={handleParse} disabled={parsing} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--accent)" }}>
            {parsing ? "Parsing…" : "Parse"}
          </button>
        </div>

        {clarification && <p className="mt-3 text-sm" style={{ color: "var(--danger)" }}>{clarification}</p>}

        {parsedRule && (
          <div className="mt-3 rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
            <p className="text-sm">{describeRule(normalizeForDisplay(parsedRule))}</p>
            <button onClick={handleCreate} disabled={creating} className="mt-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--accent)" }}>
              {creating ? "Creating…" : "Confirm and activate"}
            </button>
          </div>
        )}
        {createError && <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>{createError}</p>}
      </div>

      {rules.length > 0 && (
        <div className="card p-6">
          <p className="mb-3 text-xs font-medium text-subtle uppercase">Your rules</p>
          <div className="space-y-3">
            {rules.map((rule) => (
              <div key={rule.id} className="hairline flex items-start justify-between gap-3 border-b pb-3 last:border-0">
                <div>
                  <p className="text-sm">{describeRule(rule)}</p>
                  <p className="mt-0.5 text-xs text-subtle">
                    {rule.active ? "Active" : "Inactive"}
                    {rule.last_error && ` — last failed: ${rule.last_error}`}
                  </p>
                </div>
                {rule.active && (
                  <button onClick={() => handleDeactivate(rule.id)} className="shrink-0 text-xs font-semibold" style={{ color: "var(--danger)" }}>
                    Deactivate
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}