"use client";

import { useEffect, useState } from "react";
import { useAccount, useWriteContract, useSwitchChain, useConnect } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { createPublicClient, http, parseUnits, formatUnits, pad, defineChain } from "viem";
import { ADDRESSES, ERC20_ABI } from "@/lib/contracts";
import { wagmiConfig } from "@/lib/wagmi";
import { ConnectWallet } from "@/components/ConnectWallet";
import { PageHeader } from "@/components/PageHeader";

const TOKEN_MESSENGER_V2 = "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA" as const;
const MESSAGE_TRANSMITTER_V2 = "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275" as const;
const ARC_ALCHEMY_RPC = process.env.NEXT_PUBLIC_ARC_ALCHEMY_RPC || "";
const ARC_DOMAIN = 26;

const CHAINS = [
  { name: "Ethereum Sepolia", chainId: 11155111, domain: 0, usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as const, rpc: "https://ethereum-sepolia-rpc.publicnode.com", appKitValue: "Ethereum_Sepolia" },
  { name: "Avalanche Fuji", chainId: 43113, domain: 1, usdc: "0x5425890298aed601595a70ab815c96711a31bc65" as const, rpc: "https://api.avax-test.network/ext/bc/C/rpc", appKitValue: "Avalanche_Fuji" },
  { name: "Optimism Sepolia", chainId: 11155420, domain: 2, usdc: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7" as const, rpc: "https://sepolia.optimism.io", appKitValue: "Optimism_Sepolia" },
  { name: "Arbitrum Sepolia", chainId: 421614, domain: 3, usdc: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d" as const, rpc: "https://sepolia-rollup.arbitrum.io/rpc", appKitValue: "Arbitrum_Sepolia" },
  { name: "Base Sepolia", chainId: 84532, domain: 6, usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const, rpc: "https://sepolia.base.org", appKitValue: "Base_Sepolia" },
  { name: "Polygon Amoy", chainId: 80002, domain: 7, usdc: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582" as const, rpc: "https://rpc-amoy.polygon.technology", appKitValue: "Polygon_Amoy_Testnet" },
  { name: "Unichain Sepolia", chainId: 1301, domain: 10, usdc: "0x31d0220469e10c4E71834a79b1f276d740d3768F" as const, rpc: "https://sepolia.unichain.org", appKitValue: "Unichain_Sepolia" },
];

const TOKEN_MESSENGER_ABI = [
  { type: "function", name: "depositForBurn", inputs: [{ name: "amount", type: "uint256" }, { name: "destinationDomain", type: "uint32" }, { name: "mintRecipient", type: "bytes32" }, { name: "burnToken", type: "address" }, { name: "destinationCaller", type: "bytes32" }, { name: "maxFee", type: "uint256" }, { name: "minFinalityThreshold", type: "uint32" }], outputs: [], stateMutability: "nonpayable" },
] as const;

const MESSAGE_TRANSMITTER_ABI = [
  { type: "function", name: "receiveMessage", inputs: [{ name: "message", type: "bytes" }, { name: "attestation", type: "bytes" }], outputs: [{ name: "success", type: "bool" }], stateMutability: "nonpayable" },
] as const;

function addressToBytes32(addr: `0x${string}`): `0x${string}` {
  return pad(addr.toLowerCase() as `0x${string}`, { size: 32 });
}

function getPublicClient({ chain }: { chain: any }) {
  if (chain.id === 5042002) return createPublicClient({ chain, transport: http(ARC_ALCHEMY_RPC) });
  return createPublicClient({ chain, transport: http() });
}

function friendlyError(err: Error) {
  const msg = err.message || "";
  if (msg.includes("User rejected") || msg.includes("User denied")) return "Rejected in wallet.";
  if (msg.includes("insufficient")) return "Insufficient balance for this amount.";
  return msg.split("\n")[0] || "Something went wrong. Please try again.";
}

function LogBox({ log }: { log: string[] }) {
  if (log.length === 0) return null;
  return (
    <div className="mt-3 rounded-lg p-3 font-mono text-xs" style={{ background: "#0e1c33", color: "#e6ecf5" }}>
      {log.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </div>
  );
}

export default function BridgePage() {
  const { address, isConnected, connector, chainId: connectedChainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [balances, setBalances] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!address) return;
    CHAINS.forEach(async (chain) => {
      const client = createPublicClient({
        chain: defineChain({ id: chain.chainId, name: chain.name, nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [chain.rpc] } } }),
        transport: http(),
      });
      try {
        const balance = (await client.readContract({ address: chain.usdc, abi: ERC20_ABI, functionName: "balanceOf", args: [address] })) as bigint;
        setBalances((prev) => ({ ...prev, [chain.chainId]: formatUnits(balance, 6) }));
      } catch {
        setBalances((prev) => ({ ...prev, [chain.chainId]: "—" }));
      }
    });
  }, [address]);

  // ── Bridge In — App Kit gasless ──
  const matchedChain = CHAINS.find((c) => c.chainId === connectedChainId);
  const [inChain, setInChain] = useState(matchedChain?.appKitValue ?? CHAINS[0].appKitValue);
  const [inAmount, setInAmount] = useState("");
  const [inBusy, setInBusy] = useState(false);
  const [inLog, setInLog] = useState<string[]>([]);

  async function handleBridgeIn() {
    if (!address || !inAmount || !connector) return;
    setInBusy(true);
    setInLog([]);
    const append = (m: string) => setInLog((p) => [...p, m]);

    try {
      const selected = CHAINS.find((c) => c.appKitValue === inChain)!;
      append(`Confirming your wallet is on ${selected.name}…`);
      await switchChainAsync({ chainId: selected.chainId });

      append("Setting up App Kit adapter…");
      const { createAdapterFromProvider } = await import("@circle-fin/adapter-viem-v2");
      const { AppKit, BridgeChain } = await import("@circle-fin/app-kit");
      const provider = await connector.getProvider();
      const adapter = await createAdapterFromProvider({ provider: provider as any, getPublicClient: getPublicClient as any });
      const kit = new AppKit();
      const chainValue = (BridgeChain as any)[inChain];

      append("Bridging — approve, burn, attestation, and a gasless mint on Arc, handled automatically…");
      const result = await kit.bridge({ from: { adapter, chain: chainValue }, to: { adapter, chain: BridgeChain.Arc_Testnet, useForwarder: true }, amount: inAmount });

      if (result.state === "success") {
        append("Bridge complete — USDC has arrived on Arc.");
      } else {
        append(`Didn't complete cleanly (${result.state}).`);
      }
    } catch (err) {
      append(friendlyError(err as Error));
    }
    setInBusy(false);
  }

  // ── Bridge Out — manual CCTP ──
  const [outManualChain, setOutManualChain] = useState(CHAINS[0].chainId);
  const [outManualAmount, setOutManualAmount] = useState("");
  const [outManualBusy, setOutManualBusy] = useState(false);
  const [outManualLog, setOutManualLog] = useState<string[]>([]);
  const [readyToComplete, setReadyToComplete] = useState<{ message: string; attestation: string } | null>(null);

  async function handleManualBurn() {
    if (!address || !outManualAmount) return;
    setOutManualBusy(true);
    setReadyToComplete(null);
    setOutManualLog([]);
    const append = (m: string) => setOutManualLog((p) => [...p, m]);
    const dest = CHAINS.find((c) => c.chainId === outManualChain)!;

    try {
      append("Confirming you're on Arc…");
      await switchChainAsync({ chainId: 5042002 });

      const parsedAmount = parseUnits(outManualAmount, 6);
      append("Approving USDC spend…");
      const approveHash = await writeContractAsync({ address: ADDRESSES.usdc, abi: ERC20_ABI, functionName: "approve", args: [TOKEN_MESSENGER_V2, parsedAmount], chainId: 5042002 });
      await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });

      append(`Burning ${outManualAmount} USDC on Arc, bound for ${dest.name}…`);
      const burnHash = await writeContractAsync({
        address: TOKEN_MESSENGER_V2,
        abi: TOKEN_MESSENGER_ABI,
        functionName: "depositForBurn",
        args: [parsedAmount, dest.domain, addressToBytes32(address), ADDRESSES.usdc, addressToBytes32("0x0000000000000000000000000000000000000000"), (parsedAmount * 5n) / 1000n, 1000],
        chainId: 5042002,
      });
      await waitForTransactionReceipt(wagmiConfig, { hash: burnHash });
      append("Burn confirmed — waiting for Circle's attestation (usually under a minute)…");

      let attestationData = null;
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const res = await fetch(`https://iris-api-sandbox.circle.com/v2/messages/${ARC_DOMAIN}?transactionHash=${burnHash}`);
        const data = await res.json();
        if (data.messages?.[0]?.status === "complete") {
          attestationData = data.messages[0];
          break;
        }
      }

      if (!attestationData) {
        append("Attestation is taking longer than expected — try completing manually in a bit.");
        setOutManualBusy(false);
        return;
      }

      append("Attestation ready — switch your wallet to the destination chain and complete below.");
      setReadyToComplete({ message: attestationData.message, attestation: attestationData.attestation });
    } catch (err) {
      append(friendlyError(err as Error));
    }
    setOutManualBusy(false);
  }

  async function handleManualComplete() {
    if (!readyToComplete) return;
    setOutManualBusy(true);
    const append = (m: string) => setOutManualLog((p) => [...p, m]);
    const dest = CHAINS.find((c) => c.chainId === outManualChain)!;

    try {
      append(`Switching wallet to ${dest.name}…`);
      await switchChainAsync({ chainId: dest.chainId });

      append("Completing mint on destination chain…");
      const completeHash = await writeContractAsync({
        address: MESSAGE_TRANSMITTER_V2,
        abi: MESSAGE_TRANSMITTER_ABI,
        functionName: "receiveMessage",
        args: [readyToComplete.message as `0x${string}`, readyToComplete.attestation as `0x${string}`],
        chainId: dest.chainId,
      });
      await waitForTransactionReceipt(wagmiConfig, { hash: completeHash });
      append(`USDC has arrived on ${dest.name}.`);
      setReadyToComplete(null);
    } catch (err) {
      append(friendlyError(err as Error));
    }
    setOutManualBusy(false);
  }

  // ── Bridge Out — App Kit gasless ──
  const [outAppKitChain, setOutAppKitChain] = useState(CHAINS[0].appKitValue);
  const [outAppKitAmount, setOutAppKitAmount] = useState("");
  const [outAppKitBusy, setOutAppKitBusy] = useState(false);
  const [outAppKitLog, setOutAppKitLog] = useState<string[]>([]);

  async function handleBridgeOutAppKit() {
    if (!address || !outAppKitAmount || !connector) return;
    setOutAppKitBusy(true);
    setOutAppKitLog([]);
    const append = (m: string) => setOutAppKitLog((p) => [...p, m]);

    try {
      append("Confirming your wallet is on Arc…");
      await switchChainAsync({ chainId: 5042002 });

      append("Setting up App Kit adapter…");
      const { createAdapterFromProvider } = await import("@circle-fin/adapter-viem-v2");
      const { AppKit, BridgeChain } = await import("@circle-fin/app-kit");
      const provider = await connector.getProvider();
      const adapter = await createAdapterFromProvider({ provider: provider as any, getPublicClient: getPublicClient as any });
      const kit = new AppKit();
      const chainValue = (BridgeChain as any)[outAppKitChain];

      append("Bridging — approve, burn on Arc, attestation, and a gasless mint on the destination, handled automatically…");
      const result = await kit.bridge({ from: { adapter, chain: BridgeChain.Arc_Testnet }, to: { adapter, chain: chainValue, useForwarder: true }, amount: outAppKitAmount });

      if (result.state === "success") {
        append("Bridge complete — USDC has arrived on the destination chain, no gas needed there.");
      } else {
        append(`Didn't complete cleanly (${result.state}).`);
      }
    } catch (err) {
      append(friendlyError(err as Error));
    }
    setOutAppKitBusy(false);
  }

  if (!isConnected) {
    return (
      <>
        <PageHeader title="Bridge" subtitle="Move USDC between Arc and 7 other chains." />
        <div className="card p-6">
          <p className="mb-4 text-sm text-muted">Connect a wallet to bridge USDC.</p>
          <ConnectWallet />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Bridge" subtitle="Move USDC between Arc and 7 other chains." />

      <div className="card mb-6 p-5" style={{ background: "var(--accent-soft)", borderColor: "transparent" }}>
        <p className="text-sm" style={{ color: "var(--text-primary)" }}>
          <strong>Two ways to bridge, on purpose: </strong> the gasless option costs a flat $0.05
          USDC fee (deducted from the amount minted) but never needs native gas on either chain.
          The manual option costs nothing extra, but needs native gas on whichever chain is the
          destination, plus a manual completion step.
        </p>
      </div>

      <div className="card mb-6 p-5">
        <p className="mb-3 text-xs font-medium text-subtle uppercase">Your USDC across chains</p>
        {CHAINS.map((chain) => (
          <div key={chain.chainId} className="flex items-center justify-between py-1.5 text-sm">
            <span className="text-muted">{chain.name}</span>
            <span className="font-data">{balances[chain.chainId] ?? "loading…"}</span>
          </div>
        ))}
      </div>

      {/* Bridge In */}
      <div className="card mb-4 p-6">
        <h3 className="mb-1 text-base font-semibold">Bridge in — gasless</h3>
        <p className="mb-4 text-sm text-muted">No Arc gas needed. Native gas still required on the source chain to submit the burn.</p>
        <select
          value={inChain}
          onChange={(e) => setInChain(e.target.value)}
          className="mb-2 w-full rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)" }}
        >
          {CHAINS.map((c) => (
            <option key={c.chainId} value={c.appKitValue}>{c.name}</option>
          ))}
        </select>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={inAmount} onChange={(e) => setInAmount(e.target.value)} placeholder="USDC amount" className="flex-1 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }} />
          <button onClick={handleBridgeIn} disabled={inBusy} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--accent)" }}>
            {inBusy ? "Working…" : "Bridge in"}
          </button>
        </div>
        <p className="mt-2 text-xs text-subtle">Fee: $0.05 USDC flat, deducted from the amount minted on Arc.</p>
        <LogBox log={inLog} />
      </div>

      {/* Bridge Out - Manual */}
      <div className="card mb-4 p-6">
        <h3 className="mb-1 text-base font-semibold">Bridge out — manual, no fee</h3>
        <p className="mb-4 text-sm text-muted">Burns cheaply on Arc, then you complete the mint yourself, switch wallets when prompted, pay that chain&apos;s own gas.</p>
        <select
          value={outManualChain}
          onChange={(e) => setOutManualChain(Number(e.target.value))}
          className="mb-2 w-full rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)" }}
        >
          {CHAINS.map((c) => (
            <option key={c.chainId} value={c.chainId}>{c.name}</option>
          ))}
        </select>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={outManualAmount} onChange={(e) => setOutManualAmount(e.target.value)} placeholder="USDC amount" className="flex-1 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }} />
          <button onClick={handleManualBurn} disabled={outManualBusy} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--accent)" }}>
            {outManualBusy ? "Working…" : "Burn on Arc"}
          </button>
        </div>
        {readyToComplete && (
          <button onClick={handleManualComplete} disabled={outManualBusy} className="mt-2 w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--accent)" }}>
            {outManualBusy ? "Working…" : `Complete on ${CHAINS.find((c) => c.chainId === outManualChain)?.name}`}
          </button>
        )}
        <LogBox log={outManualLog} />
      </div>

      {/* Bridge Out - App Kit */}
      <div className="card p-6">
        <h3 className="mb-1 text-base font-semibold">Bridge out — gasless</h3>
        <p className="mb-4 text-sm text-muted">No gas or wallet-switching needed for the destination step at all.</p>
        <select
          value={outAppKitChain}
          onChange={(e) => setOutAppKitChain(e.target.value)}
          className="mb-2 w-full rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)" }}
        >
          {CHAINS.map((c) => (
            <option key={c.chainId} value={c.appKitValue}>{c.name}</option>
          ))}
        </select>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={outAppKitAmount} onChange={(e) => setOutAppKitAmount(e.target.value)} placeholder="USDC amount" className="flex-1 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }} />
          <button onClick={handleBridgeOutAppKit} disabled={outAppKitBusy} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--accent)" }}>
            {outAppKitBusy ? "Working…" : "Bridge out"}
          </button>
        </div>
        <p className="mt-2 text-xs text-subtle">Fee: $0.05 USDC flat, deducted from the amount minted on the destination.</p>
        <LogBox log={outAppKitLog} />
      </div>
    </>
  );
}