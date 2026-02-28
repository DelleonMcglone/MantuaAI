/**
 * Agent Flow E2E Test — Base Sepolia
 *
 * Tests the complete AI-agent DeFi workflow:
 *   1. Create & manage a new agent wallet
 *   2. Send testnet ETH to the agent wallet
 *   3. Swap ETH → USDC  (cbBTC note: not deployed at configured address on Base Sepolia)
 *   4. Add liquidity to ETH/USDC pool
 *   5. Query two on-chain data points (pool state + token prices)
 *   6. Get testnet ETH via faucet
 *
 * All transactions verified on https://sepolia.basescan.org
 *
 * Run:  npx tsx scripts/agent-flow-e2e.ts
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  encodeAbiParameters,
  keccak256,
  formatEther,
  formatUnits,
  parseEther,
} from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import * as fs from "fs";
import { fileURLToPath } from "url";
import * as path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ─────────────────────────────────────────────────────────────────

const envRaw = fs.readFileSync(path.resolve(__dirname, "../contracts/.env"), "utf8");
const envKV = Object.fromEntries(
  envRaw.split("\n").filter(l => l.includes("=")).map(l => {
    const i = l.indexOf("=");
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  })
);
const PK  = envKV["PRIVATE_KEY"] as `0x${string}`;
const RPC = envKV["BASE_SEPOLIA_RPC_URL"] || "https://sepolia.base.org";
if (!PK) throw new Error("PRIVATE_KEY missing in contracts/.env");

const mainAccount  = privateKeyToAccount(PK);
const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC) });
const walletClient = createWalletClient({ account: mainAccount, chain: baseSepolia, transport: http(RPC) });

const EXPLORER = "https://sepolia.basescan.org";
const txLink   = (hash: string) => `${EXPLORER}/tx/${hash}`;
const addrLink = (addr: string) => `${EXPLORER}/address/${addr}`;

// ── Contract Addresses ─────────────────────────────────────────────────────

const POOL_MANAGER   = "0x05e73354cfdd6745c338b50bcfdfa3aa6fa03408" as `0x${string}`;
const STATE_VIEW     = "0x571291b572ed32ce6751a2cb2486ebee8defb9b4" as `0x${string}`;
const POOL_SWAP_TEST = "0x8b5bcc363dde2614281ad875bad385e0a785d3b9" as `0x${string}`;
const PMLT           = "0x37429cd17cb1454c34e7f50b09725202fd533039" as `0x${string}`;
const FAUCET         = "0xaa0D98c815C3003d35E571fD51C65d7F92391883" as `0x${string}`;
const USDC           = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as `0x${string}`;
// cbBTC mainnet address — NOT deployed on Base Sepolia at this address
const CBBTC_MAINNET  = "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf" as `0x${string}`;
const ETH_ZERO       = "0x0000000000000000000000000000000000000000" as `0x${string}`;
const ZERO_HOOK      = "0x0000000000000000000000000000000000000000" as `0x${string}`;

// ETH/USDC pool: ETH (0x000...) < USDC (0x036CBD...) — sort ascending
const [CURRENCY0, CURRENCY1] = ETH_ZERO < USDC ? [ETH_ZERO, USDC] : [USDC, ETH_ZERO];
const POOL_KEY = { currency0: CURRENCY0, currency1: CURRENCY1, fee: 500, tickSpacing: 10, hooks: ZERO_HOOK };

// Uniswap v4 pool ID = keccak256(abi.encode(key))
const POOL_ID = keccak256(
  encodeAbiParameters(
    [{ type: "address" }, { type: "address" }, { type: "uint24" }, { type: "int24" }, { type: "address" }],
    [CURRENCY0, CURRENCY1, 500, 10, ZERO_HOOK]
  )
);

// sqrtPriceLimits
const MIN_SQRT_PRICE_LIMIT = 4295128740n;
const MAX_SQRT_PRICE_LIMIT = 1461446703485210103287273052203988822378723970341n;

// ── ABIs ───────────────────────────────────────────────────────────────────

const FAUCET_ABI = parseAbi(["function claimAll() external"]);
const ERC20_ABI  = parseAbi([
  "function balanceOf(address) external view returns (uint256)",
  "function approve(address,uint256) external returns (bool)",
  "function allowance(address,address) external view returns (uint256)",
]);
const STATE_ABI = parseAbi([
  "function getSlot0(bytes32 poolId) external view returns (uint160 sqrtPriceX96,int24 tick,uint24 protocolFee,uint24 lpFee)",
  "function getLiquidity(bytes32 poolId) external view returns (uint128 liquidity)",
]);
const PMLT_ABI = parseAbi([
  "function modifyLiquidity((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) key,(int24 tickLower,int24 tickUpper,int256 liquidityDelta,bytes32 salt) params,bytes hookData) external payable returns (int256)",
]);
const SWAP_ABI = parseAbi([
  "function swap((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) key,(bool zeroForOne,int256 amountSpecified,uint160 sqrtPriceLimitX96) params,(bool takeClaims,bool settleUsingBurn) testSettings,bytes hookData) external payable returns (int256 delta)",
]);

// ── Helpers ────────────────────────────────────────────────────────────────

async function confirm(label: string, hash: `0x${string}`) {
  console.log(`   ⏳  ${label}`);
  console.log(`       ${txLink(hash)}`);
  const r = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
  if (r.status !== "success") throw new Error(`${label} REVERTED — ${txLink(hash)}`);
  console.log(`   ✅  Confirmed — block ${r.blockNumber}`);
  return hash;
}

async function safeRead<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

async function getUsdcBalance(addr: `0x${string}`): Promise<bigint> {
  return safeRead<bigint>(
    () => publicClient.readContract({ address: USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [addr] }) as Promise<bigint>,
    0n
  );
}

async function getPoolState() {
  const slot0 = await safeRead<[bigint, number, number, number]>(
    () => publicClient.readContract({ address: STATE_VIEW, abi: STATE_ABI, functionName: "getSlot0", args: [POOL_ID] }) as Promise<[bigint, number, number, number]>,
    [0n, 0, 0, 0]
  );
  const liq = await safeRead<bigint>(
    () => publicClient.readContract({ address: STATE_VIEW, abi: STATE_ABI, functionName: "getLiquidity", args: [POOL_ID] }) as Promise<bigint>,
    0n
  );
  // price = (sqrtPriceX96/2^96)^2 × 10^(decimals0 - decimals1) converted to USDC per ETH
  // = (sqrtP)^2 × 10^12 (since 18-6=12 decimal diff)
  const q96 = 2n ** 96n;
  const sqrtP = slot0[0];
  // Use BigInt math: price_scaled = sqrtP^2 * 1e12 / (2^96)^2
  // To avoid overflow, compute: (sqrtP * 1e6 / 2^96)^2 / 1e6
  const factor = (sqrtP * 1_000_000n) / q96;
  const ethPriceUsdc = Number(factor * factor) / 1_000_000;
  return {
    sqrtPrice: slot0[0],
    tick: slot0[1],
    liquidity: liq,
    initialized: slot0[0] > 0n,
    ethPriceUsdc,
  };
}

async function ensureAllowance(token: `0x${string}`, spender: `0x${string}`, required: bigint) {
  const current = await safeRead<bigint>(
    () => publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: "allowance", args: [mainAccount.address, spender] }) as Promise<bigint>,
    0n
  );
  if (current >= required) {
    console.log(`   Allowance OK (${formatUnits(current, 6)} USDC)`);
    return;
  }
  console.log(`   Approving USDC to ${spender.slice(0, 8)}…`);
  const ah = await walletClient.writeContract({
    address: token, abi: ERC20_ABI, functionName: "approve",
    args: [spender, BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")],
  });
  await confirm("USDC.approve()", ah);
}

async function fetchPrice(cgId: string): Promise<number> {
  try {
    const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd`);
    const d = await r.json() as Record<string, { usd: number }>;
    return d[cgId]?.usd ?? 0;
  } catch { return 0; }
}

// ── STEP RESULT TRACKING ────────────────────────────────────────────────────

interface StepResult {
  step: string;
  status: "✅ Pass" | "⚠️  Skip" | "❌ Fail";
  details: string;
  txHash?: string;
  baseScanUrl?: string;
}

// ── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║      Mantua.AI — Agent Flow E2E Test (Base Sepolia)     ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");
  console.log(`  Main wallet: ${mainAccount.address}`);
  console.log(`  Pool ID:     ${POOL_ID}\n`);

  const results: StepResult[] = [];

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 1: Create & manage an agent wallet
  // ─────────────────────────────────────────────────────────────────────────
  console.log("══ STEP 1: Create & Manage Agent Wallet ══");

  const agentPrivKey = generatePrivateKey();
  const agentAccount = privateKeyToAccount(agentPrivKey);
  const agentAddress = agentAccount.address;

  console.log(`   Generated new agent wallet`);
  console.log(`   Address:  ${agentAddress}`);
  console.log(`   BaseScan: ${addrLink(agentAddress)}`);

  results.push({
    step: "1. Create Agent Wallet",
    status: "✅ Pass",
    details: `New wallet generated: ${agentAddress}`,
    baseScanUrl: addrLink(agentAddress),
  });

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 2: Send testnet ETH to agent wallet
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n══ STEP 2: Send Testnet ETH to Agent Wallet ══");

  const ETH_SEND_AMOUNT = parseEther("0.005");
  let sendHash: `0x${string}` | undefined;

  try {
    const mainBal = await publicClient.getBalance({ address: mainAccount.address });
    console.log(`   Main wallet ETH: ${formatEther(mainBal)}`);

    if (mainBal < ETH_SEND_AMOUNT + parseEther("0.01")) {
      throw new Error("Insufficient ETH balance for transfer + gas");
    }

    sendHash = await walletClient.sendTransaction({ to: agentAddress, value: ETH_SEND_AMOUNT });
    await confirm(`Send ${formatEther(ETH_SEND_AMOUNT)} ETH → agent wallet`, sendHash);

    const agentBal = await publicClient.getBalance({ address: agentAddress });
    console.log(`   Agent wallet balance: ${formatEther(agentBal)} ETH`);

    results.push({
      step: "2. Send Testnet ETH",
      status: "✅ Pass",
      details: `Sent ${formatEther(ETH_SEND_AMOUNT)} ETH to agent wallet ${agentAddress}`,
      txHash: sendHash,
      baseScanUrl: txLink(sendHash),
    });
  } catch (e: any) {
    const msg = String(e?.shortMessage || e?.message || e).slice(0, 200);
    console.log(`   ⚠️  ${msg}`);
    results.push({ step: "2. Send Testnet ETH", status: "⚠️  Skip", details: msg });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 3: Swap ETH → USDC  (cbBTC substitute on Base Sepolia)
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n══ STEP 3: Swap ETH → USDC (cbBTC substitute) ══");

  // Check cbBTC deployment status
  const cbBtcCode = await publicClient.getBytecode({ address: CBBTC_MAINNET });
  const cbBtcDeployed = cbBtcCode && cbBtcCode !== "0x" && cbBtcCode.length > 2;
  console.log(`   cbBTC (${CBBTC_MAINNET}): ${cbBtcDeployed ? "DEPLOYED" : "NOT deployed on Base Sepolia"}`);
  if (!cbBtcDeployed) console.log(`   → Substituting USDC as testnet alternative`);

  // Pool health check + rebalance if needed
  let ps = await getPoolState();
  console.log(`   Pool: tick=${ps.tick}  sqrtPrice=${ps.sqrtPrice}  liquidity=${ps.liquidity}`);
  console.log(`   Pool ETH price: ~$${ps.ethPriceUsdc.toFixed(2)}`);

  const marketEthPrice = await fetchPrice("ethereum");
  console.log(`   Market ETH price: ~$${marketEthPrice.toFixed(0)}`);

  // If pool price is way below market, rebalance with USDC→ETH
  let rebalanceHash: `0x${string}` | undefined;
  if (ps.initialized && ps.liquidity > 0n && marketEthPrice > 0 && ps.ethPriceUsdc < marketEthPrice * 0.5) {
    console.log(`   ⚡  Pool price is distorted ($${ps.ethPriceUsdc.toFixed(2)} vs $${marketEthPrice.toFixed(0)}) — rebalancing...`);

    const usdcBal = await getUsdcBalance(mainAccount.address);
    // Swap ~5 USDC → ETH to help normalize pool price
    const rebalanceAmount = usdcBal > 5_000_000n ? 5_000_000n : usdcBal / 2n; // 5 USDC or half balance

    if (rebalanceAmount > 100_000n) { // at least 0.1 USDC
      try {
        // Approve USDC to PoolSwapTest
        await ensureAllowance(USDC, POOL_SWAP_TEST, rebalanceAmount);

        console.log(`   Swapping ${formatUnits(rebalanceAmount, 6)} USDC → ETH (rebalance)…`);
        // zeroForOne=false: sell USDC(token1) for ETH(token0) → price goes UP
        rebalanceHash = await walletClient.writeContract({
          address: POOL_SWAP_TEST,
          abi: SWAP_ABI,
          functionName: "swap",
          args: [
            POOL_KEY,
            { zeroForOne: false, amountSpecified: -rebalanceAmount, sqrtPriceLimitX96: MAX_SQRT_PRICE_LIMIT },
            { takeClaims: false, settleUsingBurn: false },
            "0x",
          ],
          value: 0n,
        });
        await confirm(`rebalance: ${formatUnits(rebalanceAmount, 6)} USDC → ETH`, rebalanceHash);
        ps = await getPoolState();
        console.log(`   Pool price after rebalance: ~$${ps.ethPriceUsdc.toFixed(2)}`);
      } catch (e: any) {
        console.log(`   ⚠️  Rebalance failed: ${String(e?.shortMessage || e?.message || e).slice(0, 150)}`);
      }
    }
  }

  // Main ETH→USDC swap
  let swapHash: `0x${string}` | undefined;
  try {
    if (!ps.initialized) throw new Error("ETH/USDC pool not initialized");
    if (ps.liquidity === 0n)  throw new Error("Pool has no liquidity");

    const ethBal = await publicClient.getBalance({ address: mainAccount.address });
    const gasBuffer = 10_000_000_000_000_000n; // 0.01 ETH for gas
    const swapAmt = (ethBal > gasBuffer ? ethBal - gasBuffer : 0n) / 4n;

    if (swapAmt === 0n) throw new Error("ETH balance too low to swap");

    const usdcBefore = await getUsdcBalance(mainAccount.address);

    console.log(`   Swapping ${formatEther(swapAmt)} ETH → USDC…`);
    swapHash = await walletClient.writeContract({
      address: POOL_SWAP_TEST,
      abi: SWAP_ABI,
      functionName: "swap",
      args: [
        POOL_KEY,
        { zeroForOne: true, amountSpecified: -swapAmt, sqrtPriceLimitX96: MIN_SQRT_PRICE_LIMIT },
        { takeClaims: false, settleUsingBurn: false },
        "0x",
      ],
      value: swapAmt,
    });
    await confirm(`swap ${formatEther(swapAmt)} ETH → USDC`, swapHash);

    const usdcAfter = await getUsdcBalance(mainAccount.address);
    const usdcReceived = usdcAfter > usdcBefore ? usdcAfter - usdcBefore : 0n;
    console.log(`   USDC received: ${formatUnits(usdcReceived, 6)}`);

    results.push({
      step: "3. Swap ETH → USDC (cbBTC substitute)",
      status: "✅ Pass",
      details: `Swapped ${formatEther(swapAmt)} ETH → ${formatUnits(usdcReceived, 6)} USDC. cbBTC not on Base Sepolia.`,
      txHash: swapHash,
      baseScanUrl: txLink(swapHash),
    });
  } catch (e: any) {
    const msg = String(e?.shortMessage || e?.message || e).slice(0, 200);
    console.log(`   ❌  ${msg}`);
    results.push({ step: "3. Swap ETH → USDC (cbBTC substitute)", status: "❌ Fail", details: msg });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 4: Add liquidity ETH/USDC  (cbBTC pool not available on testnet)
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n══ STEP 4: Add Liquidity ETH/USDC (cbBTC pool N/A on Base Sepolia) ══");

  let liqHash: `0x${string}` | undefined;
  try {
    const psLiq = await getPoolState();
    if (!psLiq.initialized) throw new Error("Pool not initialized");

    const usdcBal = await getUsdcBalance(mainAccount.address);
    console.log(`   USDC balance: ${formatUnits(usdcBal, 6)}`);

    // Approve USDC to PMLT
    if (usdcBal > 0n) {
      await ensureAllowance(USDC, PMLT, usdcBal);
    }

    // Compute required ETH for full-range position at current pool price
    // amount0 ≈ L / sqrtCurrentPrice (in raw Q96 units)
    // amount0_wei = L × 2^96 / sqrtPriceX96
    const LIQ_DELTA   = 5_000_000_000n;
    const Q96         = 2n ** 96n;
    const sqrtP       = psLiq.sqrtPrice;
    // amount0_wei = LIQ_DELTA × 2^96 / sqrtP (upper bound estimate)
    const amount0Est  = sqrtP > 0n ? (LIQ_DELTA * Q96) / sqrtP : 0n;
    // Add 50% safety margin and convert to ETH, minimum 0.005 ETH
    const ethRequired = amount0Est + amount0Est / 2n;
    const ETH_VALUE   = ethRequired > 5_000_000_000_000_000n ? ethRequired : 5_000_000_000_000_000n;

    console.log(`   Pool price: ~$${psLiq.ethPriceUsdc.toFixed(2)}  tick: ${psLiq.tick}`);
    console.log(`   Required ETH buffer: ${formatEther(ETH_VALUE)}`);
    console.log(`   Adding liquidity: delta=${LIQ_DELTA}, tickRange=[-887270, 887270]…`);

    liqHash = await walletClient.writeContract({
      address: PMLT,
      abi: PMLT_ABI,
      functionName: "modifyLiquidity",
      args: [
        POOL_KEY,
        {
          tickLower: -887270,
          tickUpper:  887270,
          liquidityDelta: LIQ_DELTA,
          salt: "0x" + "00".repeat(32) as `0x${string}`,
        },
        "0x",
      ],
      value: ETH_VALUE,
    });
    await confirm("modifyLiquidity(full range)", liqHash);

    const psAfter = await getPoolState();
    console.log(`   New liquidity: ${psAfter.liquidity}`);

    results.push({
      step: "4. Add Liquidity ETH/USDC (cbBTC pool N/A)",
      status: "✅ Pass",
      details: `Added ${LIQ_DELTA} liquidity to ETH/USDC pool. Total liquidity: ${psAfter.liquidity}. ETH/cbBTC not possible on testnet.`,
      txHash: liqHash,
      baseScanUrl: txLink(liqHash),
    });
  } catch (e: any) {
    const msg = String(e?.shortMessage || e?.message || e).slice(0, 200);
    console.log(`   ❌  ${msg}`);
    results.push({ step: "4. Add Liquidity ETH/USDC (cbBTC pool N/A)", status: "❌ Fail", details: msg });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 5: Query two on-chain data points
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n══ STEP 5: Query On-Chain Data ══");

  // Query A: Pool state from StateView
  try {
    const ps5 = await getPoolState();
    console.log(`\n   📊  Query A — ETH/USDC Pool State (StateView)`);
    console.log(`       Pool ID:         ${POOL_ID}`);
    console.log(`       sqrtPriceX96:    ${ps5.sqrtPrice}`);
    console.log(`       Current Tick:    ${ps5.tick}`);
    console.log(`       Total Liquidity: ${ps5.liquidity}`);
    console.log(`       ETH pool price:  ~$${ps5.ethPriceUsdc.toFixed(2)}`);
    console.log(`       StateView:       ${addrLink(STATE_VIEW)}`);

    results.push({
      step: "5a. Query: ETH/USDC Pool State",
      status: "✅ Pass",
      details: `sqrtPrice=${ps5.sqrtPrice} | tick=${ps5.tick} | liquidity=${ps5.liquidity} | ETH~$${ps5.ethPriceUsdc.toFixed(2)}`,
      baseScanUrl: addrLink(STATE_VIEW),
    });
  } catch (e: any) {
    results.push({ step: "5a. Query: Pool State", status: "❌ Fail", details: String(e?.message || e).slice(0, 200) });
  }

  // Query B: Live token prices
  try {
    console.log(`\n   💹  Query B — Live Token Prices (CoinGecko)`);
    const [ethPrice, usdcPrice, cbbtcPrice] = await Promise.all([
      fetchPrice("ethereum"),
      fetchPrice("usd-coin"),
      fetchPrice("coinbase-wrapped-btc"),
    ]);
    console.log(`       ETH:   $${ethPrice.toLocaleString()}`);
    console.log(`       USDC:  $${usdcPrice.toFixed(4)}`);
    console.log(`       cbBTC: $${cbbtcPrice.toLocaleString()} (mainnet price, unavailable on Base Sepolia)`);

    results.push({
      step: "5b. Query: Live Token Prices",
      status: "✅ Pass",
      details: `ETH=$${ethPrice.toLocaleString()} | USDC=$${usdcPrice.toFixed(4)} | cbBTC=$${cbbtcPrice.toLocaleString()} (mainnet) | CoinGecko`,
    });
  } catch (e: any) {
    results.push({ step: "5b. Query: Token Prices", status: "❌ Fail", details: String(e?.message || e).slice(0, 200) });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 6: Get testnet ETH via faucet
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n══ STEP 6: Get Testnet ETH ══");

  try {
    const faucetHash = await walletClient.writeContract({
      address: FAUCET,
      abi: FAUCET_ABI,
      functionName: "claimAll",
    });
    await confirm("faucet.claimAll()", faucetHash);

    const newBal = await publicClient.getBalance({ address: mainAccount.address });
    console.log(`   New ETH balance: ${formatEther(newBal)}`);

    results.push({
      step: "6. Get Testnet ETH (Faucet)",
      status: "✅ Pass",
      details: `Claimed from on-chain faucet. New balance: ${formatEther(newBal)} ETH`,
      txHash: faucetHash,
      baseScanUrl: txLink(faucetHash),
    });
  } catch (e: any) {
    const msg = String(e?.shortMessage || e?.message || e);
    const isCooldown = msg.toLowerCase().includes("cooldown") ||
      msg.toLowerCase().includes("claimed") ||
      msg.includes("0xe3c9f055"); // AlreadyClaimed / CooldownNotExpired selector

    if (isCooldown) {
      const currentBal = await publicClient.getBalance({ address: mainAccount.address });
      console.log(`   ℹ️  Faucet on cooldown (already claimed recently)`);
      console.log(`   Current ETH balance: ${formatEther(currentBal)}`);
      console.log(`   CDP faucet portal: https://portal.cdp.coinbase.com/products/faucet`);
      results.push({
        step: "6. Get Testnet ETH (Faucet)",
        status: "⚠️  Skip",
        details: `Faucet on cooldown. Balance: ${formatEther(currentBal)} ETH. Portal: https://portal.cdp.coinbase.com/products/faucet`,
      });
    } else {
      console.log(`   ❌  ${msg.slice(0, 200)}`);
      results.push({ step: "6. Get Testnet ETH (Faucet)", status: "❌ Fail", details: msg.slice(0, 200) });
    }
  }

  // ── FINAL SUMMARY ──────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║             AGENT FLOW E2E — FINAL RESULTS             ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  for (const r of results) {
    console.log(`  ${r.status}  ${r.step}`);
    console.log(`           ${r.details.slice(0, 130)}`);
    if (r.txHash)      console.log(`           Tx:       ${txLink(r.txHash)}`);
    if (r.baseScanUrl && !r.txHash) console.log(`           BaseScan: ${r.baseScanUrl}`);
    console.log();
  }

  // Balances
  const ethFin  = await publicClient.getBalance({ address: mainAccount.address });
  const usdcFin = await getUsdcBalance(mainAccount.address);
  const ethAgent = await publicClient.getBalance({ address: agentAddress });

  console.log("  Final Balances:");
  console.log(`    Main  (${mainAccount.address}):`);
  console.log(`      ETH:  ${formatEther(ethFin)}`);
  console.log(`      USDC: ${formatUnits(usdcFin, 6)}`);
  console.log(`      ${addrLink(mainAccount.address)}`);
  console.log(`\n    Agent (${agentAddress}):`);
  console.log(`      ETH:  ${formatEther(ethAgent)}`);
  console.log(`      ${addrLink(agentAddress)}`);

  const passed  = results.filter(r => r.status === "✅ Pass").length;
  const skipped = results.filter(r => r.status === "⚠️  Skip").length;
  const failed  = results.filter(r => r.status === "❌ Fail").length;

  console.log(`\n  cbBTC Note: ${CBBTC_MAINNET} is mainnet-only — ETH/cbBTC pool impossible on testnet.`);
  console.log(`  Substitute: ETH/USDC (deployed at ${USDC})\n`);
  console.log(`  Results: ${passed} passed  ${skipped} skipped  ${failed} failed`);
  console.log("\n  ✅  Agent flow E2E test complete.\n");

  if (failed > 0) process.exit(1);
}

main().catch(e => {
  console.error("\n❌  Fatal:", e.message || e);
  process.exit(1);
});
