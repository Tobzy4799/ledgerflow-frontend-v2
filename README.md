# Ledgerflow Frontend

The real, complete frontend for **Ledgerflow** — a stablecoin-native DeFi protocol on Arc that unifies lending, borrowing, swaps, liquidity, autonomous agents, and cross-chain bridging into a single programmable settlement engine.

**Live:** [ledgerflow-protocol.xyz](https://ledgerflow-protocol.xyz)

This replaces the earlier plain test console (previously in `ledgerflow-test`) with a fully designed, production-quality interface covering every feature built across both the DeFi Track and the Agentic Economy Track.

## Stack

- **Next.js 16** (App Router, webpack build — see note below)
- **Tailwind CSS 4**
- **wagmi v2 + viem v2**
- **RainbowKit** for wallet connection with real multi-wallet modal (MetaMask, Rabby, Phantom, WalletConnect) with proper wallet icons, not a hand-built dropdown
- **Circle's Developer-Controlled Wallets SDK** (Executor's fee collection)
- **Resend** for real email notifications from Guardian and Conditional Agents

## Design

A restrained, high-contrast design system with near-white/near-black surfaces, a single teal accent, tabular numerals for financial data, thin hairline borders instead of heavy shadows. Full dark mode support. Fixed sidebar header (logo, wallet connection, balances) with independently scrollable navigation and content areas.

## Features

### Marketing site (`/`)
Hero, live platform stats (real on-chain data, animated count-up), feature grid across both layers, "How It Works" for both the lending flow and agent setup flow.

### The app (`/app`)

**Dashboard** — position overview, live utilization warning (matching Guardian's exact on-chain thresholds), supply/LP/active-rule summaries, live asset prices, and where users set the email address used for Guardian and Conditional Agent notifications.

**Core lending layer**
- **Earn** — supply USDC, earn interest
- **Borrow** — deposit EURC/cirBTC collateral, borrow USDC (with insurance-skim transparency)
- **Swap** — oracle-anchored pricing, both assets, both directions
- **Liquidity Pool** — add/remove liquidity, scarce-side bonus incentive
- **Bridge** — three genuine paths: App Kit gasless (both directions), and manual CCTP as a fee-free alternative
- **Liquidation** — auto-discovers currently-liquidatable positions across every known borrower, no need to already know an address

**Agent layer** — each with its own separate wallet and authorization
- **Guardian** — autonomous position protection (warns at 70% utilization, repays at 75%); sends real email notifications for both events
- **Executor** — plain-English command execution
- **Conditional Agents** — price-triggered and recurring DCA rules; needs its own pool approval (separate from the standing vault approval) for whichever asset it trades, including USDC for buy-direction rules; sends email notifications on both success and failure

**Insurance Pool** — mandatory borrow skim funds lender protection; purely user-facing here — reserve balance (clearly distinguished from platform revenue), platform-wide bad debt, claim filing

**Admin** (`/app/admin`, owner-gated) — treasury revenue, insurance reserve, agent wallet gas monitoring with top-up, claims approval/payout

## Local development

```bash
npm install
cp .env.example .env.local  # fill in real values
npm run dev
```

**Important:** this project uses webpack, not Turbopack (Next.js 16's default) because RainbowKit currently has unresolved compatibility issues with Turbopack. Both `dev` and `build` scripts already include the `--webpack` flag.

**Required environment variables** include a WalletConnect Project ID (free from [cloud.reown.com](https://cloud.reown.com)) for RainbowKit — see `.env.example` for the full list.

## Related repos

- [ledgerflow-contracts](https://github.com/Tobzy4799/ledgerflow-contracts) — smart contracts
- [ledgerflow-agent](https://github.com/Tobzy4799/ledgerflow-agent) — Guardian, Executor backend, Conditional Agents loop, price keeper, email notifications