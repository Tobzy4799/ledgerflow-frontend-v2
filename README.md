# Ledgerflow Frontend

The real, complete frontend for **Ledgerflow**, a stablecoin-native DeFi protocol on Arc that unifies lending, borrowing, swaps, liquidity, autonomous agents, and cross-chain bridging into a single programmable settlement engine.

**Live:** [ledgerflow-protocol.netlify.app](https://ledgerflow-protocol.netlify.app)

This replaces the earlier plain test console (previously in `ledgerflow-test`) with a fully designed, production-quality interface covering every feature built across both the DeFi Track and the Agentic Economy Track.

## Stack

- **Next.js 16** (App Router, webpack build — see note below)
- **Tailwind CSS 4**
- **wagmi v2 + viem v2**
- **RainbowKit** for wallet connection
- **Circle's Developer-Controlled Wallets SDK** (Executor's fee collection)

## Design

A restrained, high-contrast design with near-white/near-black surfaces, a single teal accent, tabular numerals for financial data, thin hairline borders instead of heavy shadows. Full dark mode support.

## Features

### Marketing site (`/`)
Hero, live platform stats (real on-chain data, animated count-up), feature grid across both layers, "How It Works" for both the lending flow and agent setup flow.

### The app (`/app`)

**Dashboard** - position overview, live utilization warning (matching Guardian's exact on-chain thresholds), supply/LP/active-rule summaries, live asset prices.

**Core lending layer**
- **Earn** — supply USDC, earn interest
- **Borrow** — deposit EURC/cirBTC collateral, borrow USDC (with insurance-skim transparency)
- **Swap** — oracle-anchored pricing, both assets, both directions
- **Liquidity Pool** — add/remove liquidity, scarce-side bonus incentive
- **Bridge** — three genuine paths: App Kit gasless (both directions), and manual CCTP as a fee-free alternative
- **Liquidation** — auto-discovers currently-liquidatable positions, no need to already know an address

**Agent layer** — each with its own separate wallet and authorization
- **Guardian** — autonomous position protection (warns at 70% utilization, repays at 75%)
- **Executor** — plain-English command execution
- **Conditional Agents** — price-triggered and recurring DCA rules

**Insurance Pool** — mandatory borrow skim funds lender protection; user-facing claim filing, admin-managed approval/payout (moved to `/app/admin`)

**Admin** (`/app/admin`, owner-gated) — treasury revenue, insurance reserve, agent wallet gas monitoring with top-up, claims management

## Local development

```bash
npm install
cp .env.example .env.local  # fill in real values
npm run dev
```

**Important:** this project uses webpack, not Turbopack (Next.js 16's default) — RainbowKit currently has unresolved compatibility issues with Turbopack. Both `dev` and `build` scripts already include the `--webpack` flag.

## Related repos

- [ledgerflow-contracts](https://github.com/Tobzy4799/ledgerflow-contracts) — smart contracts
- [ledgerflow-agent](https://github.com/Tobzy4799/ledgerflow-agent) — Guardian, Executor backend, Conditional Agents loop, price keeper
