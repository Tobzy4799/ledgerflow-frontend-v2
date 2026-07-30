"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAccount, useReadContract } from "wagmi";
import { ADDRESSES, INSURANCE_POOL_ABI, ERC20_ABI } from "@/lib/contracts";
import { formatUnits } from "viem";
import {
  LayoutDashboard,
  PiggyBank,
  Landmark,
  ArrowLeftRight,
  Droplets,
  ArrowRightLeft,
  Gavel,
  ShieldCheck,
  MessageSquareText,
  Clock,
  Umbrella,
  Settings,
  Menu,
  X,
} from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { PageHeaderProvider, useHeaderInfo } from "@/lib/PageHeaderContext";

const coreLinks = [
  { href: "/app/lend", label: "Earn", icon: PiggyBank },
  { href: "/app/borrow", label: "Borrow", icon: Landmark },
  { href: "/app/swap", label: "Swap", icon: ArrowLeftRight },
  { href: "/app/pool", label: "Pool", icon: Droplets },
  { href: "/app/bridge", label: "Bridge", icon: ArrowRightLeft },
  { href: "/app/liquidation", label: "Liquidation", icon: Gavel },
];

const agentLinks = [
  { href: "/app/guardian", label: "Guardian", icon: ShieldCheck },
  { href: "/app/executor", label: "Executor", icon: MessageSquareText },
  { href: "/app/agents", label: "Conditional Agents", icon: Clock },
  { href: "/app/insurance", label: "Insurance Pool", icon: Umbrella },
];

function NavGroup({ title, links, pathname, onNavigate }: { title: string; links: typeof coreLinks; pathname: string; onNavigate: () => void }) {
  return (
    <div className="mb-8">
      <p className="mb-2 px-3 text-xs font-medium tracking-wide text-subtle uppercase">{title}</p>
      <nav className="space-y-0.5">
        {links.map((link) => {
          const active = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onNavigate}
              className="group relative flex items-center gap-2.5 overflow-hidden rounded-md px-3 py-2 text-sm transition-all duration-200 ease-out active:scale-[0.97]"
              style={{
                background: active ? "var(--accent-soft)" : "transparent",
                color: active ? "var(--accent)" : "var(--text-secondary)",
                fontWeight: active ? 600 : 400,
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = "var(--accent-soft)";
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = "transparent";
              }}
            >
              <span
                className="absolute top-0 left-0 h-full w-0.5 transition-transform duration-200 ease-out"
                style={{
                  background: "var(--accent)",
                  transform: active ? "scaleY(1)" : "scaleY(0)",
                }}
              />
              <span className="transition-transform duration-200 ease-out group-hover:translate-x-0.5">
                <Icon size={16} />
              </span>
              <span className="transition-transform duration-200 ease-out group-hover:translate-x-0.5">
                {link.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function SidebarBalances() {
  const { address, isConnected } = useAccount();

  const { data: usdcBalance } = useReadContract({
    address: ADDRESSES.usdc,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: isConnected, refetchInterval: 15000 },
    chainId: 5042002,
  });
  const { data: eurcBalance } = useReadContract({
    address: ADDRESSES.eurc,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: isConnected, refetchInterval: 15000 },
    chainId: 5042002,
  });
  const { data: cirbtcBalance } = useReadContract({
    address: ADDRESSES.cirbtc,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: isConnected, refetchInterval: 15000 },
    chainId: 5042002,
  });

  if (!isConnected) return null;

  return (
    <div className="mb-6 space-y-1 px-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-subtle">USDC</span>
        <span className="font-data text-secondary">{usdcBalance !== undefined ? formatUnits(usdcBalance as bigint, 6) : "—"}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-subtle">EURC</span>
        <span className="font-data text-secondary">{eurcBalance !== undefined ? formatUnits(eurcBalance as bigint, 6) : "—"}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-subtle">cirBTC</span>
        <span className="font-data text-secondary">{cirbtcBalance !== undefined ? formatUnits(cirbtcBalance as bigint, 8) : "—"}</span>
      </div>
    </div>
  );
}

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  const { address } = useAccount();
  const { data: ownerAddress } = useReadContract({
    address: ADDRESSES.insurancePool,
    abi: INSURANCE_POOL_ABI,
    functionName: "owner",
    chainId: 5042002,
  });
  const isOwner = !!address && !!ownerAddress && address.toLowerCase() === (ownerAddress as string).toLowerCase();

  return (
    <>
      <Link href="/" className="mb-4 flex items-center gap-2 px-3 font-semibold">
        <Image src="/ledgerflow-logo.jpeg" alt="Ledgerflow" width={24} height={24} className="rounded-md" />
        Ledgerflow
      </Link>
      <div className="mb-6 px-3">
        <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
      </div>
      <SidebarBalances />
      <div className="mb-8">
        <Link
          href="/app"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors"
          style={{
            background: pathname === "/app" ? "var(--accent-soft)" : "transparent",
            color: pathname === "/app" ? "var(--accent)" : "var(--text-secondary)",
            fontWeight: pathname === "/app" ? 600 : 400,
          }}
        >
          <LayoutDashboard size={16} />
          Dashboard
        </Link>
      </div>
      <NavGroup title="Lending" links={coreLinks} pathname={pathname} onNavigate={onNavigate} />
      <NavGroup title="Agents" links={agentLinks} pathname={pathname} onNavigate={onNavigate} />
      {isOwner && (
        <Link
          href="/app/admin"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors"
          style={{
            background: pathname === "/app/admin" ? "var(--accent-soft)" : "transparent",
            color: pathname === "/app/admin" ? "var(--accent)" : "var(--text-secondary)",
            fontWeight: pathname === "/app/admin" ? 600 : 400,
          }}
        >
          <Settings size={16} />
          Admin
        </Link>
      )}
    </>
  );
}

function FixedHeader() {
  const { title, subtitle } = useHeaderInfo();
  if (!title) return null;
  return (
    <div className="hairline shrink-0 border-b px-4 py-5 md:px-8">
      <h1 className="mb-1" style={{ fontSize: "var(--text-h2)" }}>{title}</h1>
      <p className="text-sm text-muted">{subtitle}</p>
    </div>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col md:flex-row">
      {/* Mobile top bar — hidden on desktop */}
      <div className="hairline flex shrink-0 items-center justify-between border-b px-4 py-3 md:hidden">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Image src="/ledgerflow-logo.jpeg" alt="Ledgerflow" width={27} height={27} className="rounded-md" />
          Ledgerflow
        </Link>
        <button onClick={() => setDrawerOpen(true)} aria-label="Open menu">
          <Menu size={22} />
        </button>
      </div>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="card absolute top-0 left-0 h-full w-72 overflow-y-auto rounded-none border-r px-4 py-6">
            <button onClick={() => setDrawerOpen(false)} aria-label="Close menu" className="mb-4 ml-auto block">
              <X size={20} />
            </button>
            <SidebarContent pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      {/* Desktop sidebar — its own independent scroll, never moves with main content */}
      <aside className="hairline hidden w-64 shrink-0 overflow-y-auto border-r px-4 py-6 md:block">
        <SidebarContent pathname={pathname} onNavigate={() => {}} />
      </aside>

      {/* Main column — a genuine fixed header row (never scrolls) plus a separate scrollable content row below it */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <FixedHeader />
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto max-w-2xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageHeaderProvider>
      <AppShell>{children}</AppShell>
    </PageHeaderProvider>
  );
}