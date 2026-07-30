export const ADDRESSES = {
  vault: "0x637097eDEc208D6Ea335F6153932a2019CFc978C",
  agentAuth: "0x3a289c11935623Ec2be5Ab151bf57A3bA325C556",
  hooks: "0x1663c706Bde3702e8A71ce7a8A744b4917661553",
  pool: "0xa1AE1d05EF5867cDAb1aF1e1280C54F5cCdc4966",
  insurancePool: "0x3e17769614a42AeD8624ab4AD7A359631c7413bD",
  usdc: "0x3600000000000000000000000000000000000000",
  eurc: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
  cirbtc: "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF",
  gatewayWallet: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9",
} as const;

export const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

export const VAULT_ABI = [
  {
    type: "function",
    name: "totalDebt",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalSupplyShares",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "depositCollateral",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdrawCollateral",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "borrow",
    inputs: [{ name: "usdcAmount", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "repay",
    inputs: [{ name: "usdcAmount", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "supply",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdrawSupply",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "supplyShares",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getExchangeRate",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "collateralBalances",
    inputs: [
      { name: "user", type: "address" },
      { name: "token", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getCollateralValueUSD",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "debt",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "collateralAssets",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      { name: "approved", type: "bool" },
      { name: "tokenDecimals", type: "uint8" },
      { name: "priceUSD", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getUtilizationBps",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getLiquidationInfo",
    inputs: [
      { name: "user", type: "address" },
      { name: "collateralToken", type: "address" },
    ],
    outputs: [
      { name: "liquidatable", type: "bool" },
      { name: "currentDebt", type: "uint256" },
      { name: "availableCollateral", type: "uint256" },
      { name: "maxNormalRepay", type: "uint256" },
      { name: "isCritical", type: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "previewLiquidation",
    inputs: [
      { name: "user", type: "address" },
      { name: "collateralToken", type: "address" },
      { name: "repayAmount", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "liquidate",
    inputs: [
      { name: "user", type: "address" },
      { name: "collateralToken", type: "address" },
      { name: "repayAmount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

export const POOL_ABI = [
  {
    type: "function",
    name: "addLiquidity",
    inputs: [
      { name: "token", type: "address" },
      { name: "tokenAmount", type: "uint256" },
      { name: "usdcAmount", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "swapUSDCForToken",
    inputs: [
      { name: "token", type: "address" },
      { name: "usdcIn", type: "uint256" },
      { name: "minTokenOut", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "swapTokenForUSDC",
    inputs: [
      { name: "token", type: "address" },
      { name: "tokenIn", type: "uint256" },
      { name: "minUsdcOut", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "quoteSwap",
    inputs: [
      { name: "token", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "tokenToUsdc", type: "bool" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getReserves",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      { name: "tokenReserve", type: "uint256" },
      { name: "usdcReserve", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "removeLiquidity",
    inputs: [
      { name: "token", type: "address" },
      { name: "shareAmount", type: "uint256" },
    ],
    outputs: [
      { name: "tokenAmount", type: "uint256" },
      { name: "usdcAmount", type: "uint256" },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getShares",
    inputs: [
      { name: "token", type: "address" },
      { name: "provider", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const AGENT_AUTH_ABI = [
  {
    type: "function",
    name: "authorizeAgent",
    inputs: [
      { name: "agent", type: "address" },
      { name: "maxPerAction", type: "uint256" },
      { name: "dailyLimit", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "revokeAgent",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "isAuthorized",
    inputs: [
      { name: "user", type: "address" },
      { name: "agent", type: "address" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "authorizations",
    inputs: [
      { name: "user", type: "address" },
      { name: "agent", type: "address" },
    ],
    outputs: [
      { name: "active", type: "bool" },
      { name: "maxPerAction", type: "uint256" },
      { name: "dailyLimit", type: "uint256" },
      { name: "spentToday", type: "uint256" },
      { name: "dayStart", type: "uint256" },
    ],
    stateMutability: "view",
  },
] as const;

export const GATEWAY_WALLET_ABI = [
  {
    type: "function",
    name: "deposit",
    inputs: [
      { name: "token", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "totalBalance",
    inputs: [
      { name: "token", type: "address" },
      { name: "depositor", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "availableBalance",
    inputs: [
      { name: "token", type: "address" },
      { name: "depositor", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "initiateWithdrawal",
    inputs: [
      { name: "token", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdraw",
    inputs: [{ name: "token", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdrawalBlock",
    inputs: [
      { name: "token", type: "address" },
      { name: "depositor", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const INSURANCE_POOL_ABI = [
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "reserveBalance",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "payPremium",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "fileClaim",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [{ name: "claimId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "approveClaim",
    inputs: [{ name: "claimId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "payClaim",
    inputs: [{ name: "claimId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "sweepSurplus",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "to", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;
