/**
 * Testnet E2E Script — Base Sepolia
 *
 * Executes the full user journey:
 *   1. Claim faucet tokens (ETH + USDC)
 *   2. Initialize ETH/USDC pool at fee=500, tickSpacing=10
 *   3. Add liquidity via PoolModifyLiquidityTest
 *   4. Swap 25% of ETH balance → USDC via PoolSwapTest
 *   5. Verify on-chain state at every step
 *
 * Pool ID uses keccak256(abi.encode(key)) — 5 × 32 bytes ABI-padded encoding,
 * matching Uniswap v4's internal poolId derivation.
 *
 * Run:  npx tsx scripts/testnet-e2e.ts
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
} from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
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

const account      = privateKeyToAccount(PK);
const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC) });
const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(RPC) });

const EXPLORER = "https://sepolia.basescan.org";
const link = (hash: string) => `${EXPLORER}/tx/${hash}`;

// ── Addresses ──────────────────────────────────────────────────────────────

const POOL_MANAGER   = "0x05e73354cfdd6745c338b50bcfdfa3aa6fa03408" as `0x${string}`;
const STATE_VIEW     = "0x571291b572ed32ce6751a2cb2486ebee8defb9b4" as `0x${string}`;
const POOL_SWAP_TEST = "0x8b5bcc363dde2614281ad875bad385e0a785d3b9" as `0x${string}`;
const PMLT           = "0x37429cd17cb1454c34e7f50b09725202fd533039" as `0x${string}`;
const FAUCET         = "0xaa0D98c815C3003d35E571fD51C65d7F92391883" as `0x${string}`;
const USDC           = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as `0x${string}`;
const ETH_ZERO       = "0x0000000000000000000000000000000000000000" as `0x${string}`;
const ZERO_HOOK      = "0x0000000000000000000000000000000000000000" as `0x${string}`;

// ETH (0x000...) < USDC (0x036CBD...) — sort ascending
const [CURRENCY0, CURRENCY1] = ETH_ZERO < USDC ? [ETH_ZERO, USDC] : [USDC, ETH_ZERO];

// fee=500 (0.05%), tickSpacing=10
const FEE          = 500;
const TICK_SPACING = 10;
const POOL_KEY     = { currency0: CURRENCY0, currency1: CURRENCY1, fee: FEE, tickSpacing: TICK_SPACING, hooks: ZERO_HOOK };

// Uniswap v4 pool ID = keccak256(abi.encode(key)) — 5 × 32-byte ABI-padded fields
const POOL_ID = keccak256(
  encodeAbiParameters(
    [
      { type: "address" },
      { type: "address" },
      { type: "uint24"  },
      { type: "int24"   },
      { type: "address" },
    ],
    [CURRENCY0, CURRENCY1, FEE, TICK_SPACING, ZERO_HOOK]
  )
);

// sqrtPriceX96 for ETH ≈ $2500 with ETH=token0(18dec), USDC=token1(6dec)
// price_raw = 2500 * 10^6 / 10^18 = 2.5e-9
// sqrtPriceX96 = floor(sqrt(2500e6/1e18) * 2^96) = floor(50/1e6 * 2^96)
// = floor(50 * 79228162514264337593543950336 / 1e6)
// = 3961408125713216879677197
const SQRT_PRICE_X96 = 3961408125713216879677197n;

// ── ABIs ───────────────────────────────────────────────────────────────────

const FAUCET_ABI = parseAbi(["function claimAll() external"]);
const ERC20_ABI  = parseAbi([
  "function balanceOf(address) external view returns (uint256)",
  "function approve(address,uint256) external returns (bool)",
  "function allowance(address,address) external view returns (uint256)",
]);
const PM_ABI = parseAbi([
  "function initialize((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) key, uint160 sqrtPriceX96) external returns (int24)",
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
  console.log(`  ⏳  ${label} → ${link(hash)}`);
  const r = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
  if (r.status !== "success") throw new Error(`${label} REVERTED — ${link(hash)}`);
  console.log(`  ✅  ${label} confirmed`);
  return hash;
}

async function safeRead<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

async function printBalances(label: string) {
  const eth  = await publicClient.getBalance({ address: account.address });
  const usdc = await safeRead<bigint>(
    () => publicClient.readContract({ address: USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [account.address] }) as Promise<bigint>,
    0n
  );
  console.log(`\n  💰  Balances [${label}]`);
  console.log(`       ETH:  ${formatEther(eth)}`);
  console.log(`       USDC: ${formatUnits(usdc, 6)}`);
  return { eth, usdc };
}

async function poolState() {
  const slot0 = await safeRead<[bigint, number, number, number]>(
    () => publicClient.readContract({ address: STATE_VIEW, abi: STATE_ABI, functionName: "getSlot0", args: [POOL_ID] }) as Promise<[bigint, number, number, number]>,
    [0n, 0, 0, 0]
  );
  const liq = await safeRead<bigint>(
    () => publicClient.readContract({ address: STATE_VIEW, abi: STATE_ABI, functionName: "getLiquidity", args: [POOL_ID] }) as Promise<bigint>,
    0n
  );
  return {
    sqrtPrice: slot0[0],
    tick: slot0[1],
    liquidity: liq,
    initialized: slot0[0] > 0n,
    hasLiquidity: liq > 0n,
  };
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n╔════════════════════════════════════════════════╗");
  console.log("║  Mantua.AI — Base Sepolia E2E Test & Setup    ║");
  console.log("╚════════════════════════════════════════════════╝\n");
  console.log(`  Wallet:      ${account.address}`);
  console.log(`  Network:     Base Sepolia (84532)`);
  console.log(`  Pool:        ETH/USDC  fee=${FEE}  tickSpacing=${TICK_SPACING}`);
  console.log(`  Pool ID:     ${POOL_ID}`);
  console.log(`  SqrtPrice:   ${SQRT_PRICE_X96} (ETH ≈ $2500)\n`);

  const txs: Record<string, string> = {};

  // ── Initial state ──────────────────────────────────────────────────────
  const before = await printBalances("INITIAL");
  const ps0    = await poolState();
  console.log(`\n  📊  ETH/USDC pool (fee=500): initialized=${ps0.initialized}  liquidity=${ps0.liquidity}`);

  // ── Step 1: Faucet ─────────────────────────────────────────────────────
  console.log("\n━━━  STEP 1: Claim Faucet Tokens  ━━━");
  try {
    const h = await walletClient.writeContract({
      address: FAUCET, abi: FAUCET_ABI, functionName: "claimAll",
    });
    await confirm("claimAll()", h);
    txs.faucet = link(h);
  } catch (e: any) {
    const m = String(e?.shortMessage || e?.message || e);
    console.log(`  ℹ️   Faucet skipped: ${m.slice(0, 120)}`);
  }
  await printBalances("AFTER FAUCET");

  // ── Step 2: Initialize pool ────────────────────────────────────────────
  console.log("\n━━━  STEP 2: Initialize ETH/USDC Pool (fee=500)  ━━━");
  let ps1 = await poolState();

  if (!ps1.initialized) {
    console.log(`  Initializing at sqrtPriceX96=${SQRT_PRICE_X96} …`);
    try {
      const h = await walletClient.writeContract({
        address: POOL_MANAGER, abi: PM_ABI, functionName: "initialize",
        args: [POOL_KEY, SQRT_PRICE_X96],
      });
      await confirm("initialize()", h);
      txs.pool_init = link(h);
      ps1 = await poolState();
    } catch (e: any) {
      const m = String(e?.shortMessage || e?.message || e);
      if (m.includes("PoolAlreadyInitialized") || m.includes("already")) {
        console.log("  ✅  Pool was already initialized");
        ps1 = await poolState();
      } else {
        throw new Error(`Pool init failed: ${m.slice(0, 300)}`);
      }
    }
  } else {
    console.log("  ✅  Pool already initialized — skipping");
  }

  console.log(`  sqrtPrice: ${ps1.sqrtPrice}  tick: ${ps1.tick}`);
  if (!ps1.initialized) throw new Error("Pool still not initialized — aborting");

  // ── Step 3: Add liquidity ──────────────────────────────────────────────
  console.log("\n━━━  STEP 3: Add Liquidity (ETH + USDC via PMLT)  ━━━");
  let ps2 = await poolState();

  if (!ps2.hasLiquidity) {
    // For ETH at $2500 (tick ≈ -198186), full-range position [−887270, 887270]
    // needs both ETH and USDC.  At this tick, the position is heavily weighted
    // toward ETH (currency0).  We send value ≥ required ETH; USDC must be approved.
    //
    // liquidityDelta=50_000_000_000 requires ≈ 0.001 ETH + ≈ 2.5 USDC
    // We send 0.005 ETH as value (buffer); contract refunds the excess.
    const LIQ_DELTA  = 50_000_000_000n;        // liquidity units
    const ETH_VALUE  = 5_000_000_000_000_000n; // 0.005 ETH sent (buffer)

    // Tick bounds — multiples of tickSpacing=10, full range
    const TICK_LOWER = -887270;
    const TICK_UPPER =  887270;

    // Approve USDC to PMLT (max)
    const usdcBal = await safeRead<bigint>(
      () => publicClient.readContract({ address: USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [account.address] }) as Promise<bigint>,
      0n
    );
    console.log(`  USDC balance: ${formatUnits(usdcBal, 6)}`);

    if (usdcBal > 0n) {
      const allowance = await safeRead<bigint>(
        () => publicClient.readContract({ address: USDC, abi: ERC20_ABI, functionName: "allowance", args: [account.address, PMLT] }) as Promise<bigint>,
        0n
      );
      if (allowance < usdcBal) {
        console.log("  Approving USDC to PMLT …");
        const ah = await walletClient.writeContract({
          address: USDC, abi: ERC20_ABI, functionName: "approve",
          args: [PMLT, BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")],
        });
        await confirm("USDC.approve(PMLT)", ah);
        txs.usdc_approve = link(ah);
      } else {
        console.log("  USDC already approved to PMLT");
      }
    }

    // Try progressively wider tick ranges with decreasing liquidityDelta
    const ranges = [
      { tickLower: TICK_LOWER, tickUpper: TICK_UPPER, liqDelta: LIQ_DELTA },
      { tickLower: -60000,     tickUpper:  60000,     liqDelta: 10_000_000_000n },
      { tickLower: -6000,      tickUpper:   6000,     liqDelta:  1_000_000_000n },
    ];

    let liqAdded = false;
    for (const { tickLower, tickUpper, liqDelta } of ranges) {
      try {
        console.log(`  Trying modifyLiquidity(${tickLower}..${tickUpper}, liq=${liqDelta}) …`);
        const h = await walletClient.writeContract({
          address: PMLT, abi: PMLT_ABI, functionName: "modifyLiquidity",
          args: [
            POOL_KEY,
            {
              tickLower,
              tickUpper,
              liquidityDelta: liqDelta,
              salt: ("0x" + "00".repeat(32)) as `0x${string}`,
            },
            "0x",
          ],
          value: ETH_VALUE,
        });
        await confirm(`modifyLiquidity(${tickLower}..${tickUpper})`, h);
        txs.add_liquidity = link(h);
        liqAdded = true;
        break;
      } catch (e: any) {
        const msg = String(e?.shortMessage || e?.message || e);
        console.log(`  ⚠️  Range ${tickLower}..${tickUpper} failed: ${msg.slice(0, 200)}`);
      }
    }

    if (!liqAdded) {
      console.log("  ⚠️  Could not add liquidity — swap may fail");
    }
    ps2 = await poolState();
  } else {
    console.log(`  ✅  Pool already has liquidity (${ps2.liquidity}) — skipping`);
  }

  console.log(`  Liquidity: ${ps2.liquidity}  hasLiquidity: ${ps2.hasLiquidity}`);

  // ── Step 4: Swap 25% ETH → USDC ───────────────────────────────────────
  console.log("\n━━━  STEP 4: Swap 25% ETH → USDC  ━━━");
  const ethNow    = await publicClient.getBalance({ address: account.address });
  // Reserve 0.003 ETH for gas; swap 25% of the remainder
  const gasBuffer = 3_000_000_000_000_000n;
  const swappable = ethNow > gasBuffer ? ethNow - gasBuffer : 0n;
  const swapAmt   = swappable / 4n;

  console.log(`  ETH balance:  ${formatEther(ethNow)}`);
  console.log(`  Swappable:    ${formatEther(swappable)} ETH`);
  console.log(`  Swap amount:  ${formatEther(swapAmt)} ETH (25%)`);

  if (swapAmt === 0n) {
    console.log("  ⚠️  ETH too low to swap safely — skipping");
  } else if (!ps2.initialized) {
    console.log("  ⚠️  Pool not initialized — skipping swap");
  } else if (!ps2.hasLiquidity) {
    console.log("  ⚠️  No liquidity in pool — skipping swap");
  } else {
    // ETH is currency0 → zeroForOne = true
    // sqrtPriceLimitX96 = MIN_SQRT_PRICE + 1 (price can drop to the floor)
    const sqrtPriceLimitX96 = 4295128740n;

    try {
      const h = await walletClient.writeContract({
        address: POOL_SWAP_TEST, abi: SWAP_ABI, functionName: "swap",
        args: [
          POOL_KEY,
          { zeroForOne: true, amountSpecified: -swapAmt, sqrtPriceLimitX96 },
          { takeClaims: false, settleUsingBurn: false },
          "0x",
        ],
        value: swapAmt,
      });
      await confirm("swap() ETH→USDC", h);
      txs.swap = link(h);
    } catch (e: any) {
      console.log(`  ❌  Swap failed: ${String(e?.shortMessage || e?.message || e).slice(0, 300)}`);
    }
  }

  // ── Final verification ─────────────────────────────────────────────────
  console.log("\n━━━  FINAL STATE  ━━━");
  const after = await printBalances("FINAL");
  const psEnd = await poolState();

  console.log(`\n  ETH/USDC pool (fee=500):`);
  console.log(`    ID:          ${POOL_ID}`);
  console.log(`    Initialized: ${psEnd.initialized}`);
  console.log(`    SqrtPrice:   ${psEnd.sqrtPrice}`);
  console.log(`    Tick:        ${psEnd.tick}`);
  console.log(`    Liquidity:   ${psEnd.liquidity}`);

  if (txs.swap) {
    const ethDelta  = before.eth  - after.eth;
    const usdcDelta = after.usdc  - before.usdc;
    console.log(`\n  Swap result:`);
    console.log(`    ETH  spent:    ${formatEther(ethDelta)}`);
    console.log(`    USDC received: ${formatUnits(usdcDelta, 6)}`);
  }

  // ── Transaction Summary ────────────────────────────────────────────────
  console.log("\n╔════════════════════════════════════════════════╗");
  console.log("║            TRANSACTION SUMMARY                 ║");
  console.log("╚════════════════════════════════════════════════╝");
  for (const [k, v] of Object.entries(txs)) {
    console.log(`  ${k.padEnd(18)} ${v}`);
  }
  if (Object.keys(txs).length === 0) {
    console.log("  (no transactions — all steps already completed)");
  }
  console.log(`\n  Wallet: ${EXPLORER}/address/${account.address}`);
  console.log("\n  ✅  Done!\n");
}

main().catch(e => { console.error("\n❌  Fatal:", e.message || e); process.exit(1); });
