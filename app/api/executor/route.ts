import { NextRequest, NextResponse } from "next/server";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

const SELLER_ENDPOINT = `${process.env.AGENT_API_URL || "http://localhost:3001"}/executor/run-command`;
const VAULT_ADDRESS = process.env.VAULT_ADDRESS!;
const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS!;
const EXECUTOR_PAYER_WALLET_ID = process.env.EXECUTOR_PAYER_WALLET_ID!;

const circleClient = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY!,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
});


export async function POST(req: NextRequest) {
  const { prompt, userAddress } = await req.json();

  if (!prompt || typeof prompt !== "string") {
    return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
  }
  if (!userAddress) {
    return NextResponse.json({ error: "Missing userAddress — required to collect the service fee from the correct user" }, { status: 400 });
  }

  // Collect a small, genuine fee from the user actually using this feature —
  // a plain contract call via the Executor's own authorized wallet, using the
  // same AgentAuth authorization and standing approval as Guardian's repayFor.
  // No signing flow, no CLI dependency — works identically anywhere (local,
  // Vercel, Railway, etc.).
  try {
    await circleClient.createContractExecutionTransaction({
      walletId: EXECUTOR_PAYER_WALLET_ID,
      contractAddress: VAULT_ADDRESS,
      abiFunctionSignature: "collectServiceFee(address,uint256,address)",
      abiParameters: [userAddress, "1000", TREASURY_ADDRESS], // $0.001 fee
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    });
  } catch (err) {
    return NextResponse.json({ error: `Could not collect service fee — make sure you've authorized the Executor as an agent and have a standing USDC approval set: ${(err as Error).message}` }, { status: 402 });
  }

  try {
    const res = await fetch(SELLER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}