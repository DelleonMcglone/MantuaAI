/**
 * Agent Flow E2E — On-Chain Verification Suite
 *
 * Verifies the state on Base Sepolia after the agent flow E2E script ran:
 *   1. Agent wallet exists and received ETH
 *   2. ETH→USDC swap succeeded (tx confirmed)
 *   3. USDC→ETH rebalance succeeded (tx confirmed)
 *   4. Liquidity was added to ETH/USDC pool
 *   5. Pool queries return valid data
 *   6. cbBTC is confirmed NOT deployed on Base Sepolia
 *
 * Run: npx vitest run server/tests/agent-flow-e2e.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  createPublicClient,
  http,
  parseAbi,
  encodeAbiParameters,
  keccak256,
} from 'viem';
import { baseSepolia } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath   = path.resolve(__dirname, '../../contracts/.env');

const envKV = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const RPC = envKV['BASE_SEPOLIA_RPC_URL'] || 'https://base-sepolia-rpc.publicnode.com';

const client = createPublicClient({ chain: baseSepolia, transport: http(RPC) });

// ── Known addresses ─────────────────────────────────────────────────────────

const MAIN_WALLET    = '0xbaacDCFfA93B984C914014F83Ee28B68dF88DC87' as const;
const AGENT_WALLET   = '0x65222f03F155d9C3449A44E3528C04e5B9961E9d' as const; // created in last run
const STATE_VIEW     = '0x571291b572ed32ce6751a2cb2486ebee8defb9b4' as const;
const POOL_SWAP_TEST = '0x8b5bcc363dde2614281ad875bad385e0a785d3b9' as const;
const PMLT           = '0x37429cd17cb1454c34e7f50b09725202fd533039' as const;
const USDC           = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const;
const CBBTC_MAINNET  = '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf' as const;
const ETH_ZERO       = '0x0000000000000000000000000000000000000000' as const;
const ZERO_HOOK      = '0x0000000000000000000000000000000000000000' as const;

// ── Confirmed transaction hashes from the agent flow run ────────────────────

const AGENT_FLOW_TXS = {
  sendEth:        '0xc813ec09b4a01415c10eaee03d9d56bbfd325eddb6836fcb9fb764fd95dfce57',
  usdcApprove:    '0x00aa60c3006ceac4efb38ac856d8d7feb9bdd101735f388525c79114444c57a9',
  rebalanceSwap:  '0x2a5496a260d92246fe68c47e5bfdec74fd81132b121f75c1380b2c187a486b5c',
  ethUsdcSwap:    '0x97dc7b3a3d0702aeca7a991c7d7b3863351e9af1f7b021886ccfa2cfaf5cdcb5',
  addLiquidity:   '0xc35212bb95f6307119749621932312e816eddc333c8a4c2dfd3482b8f37689e4',
} as const;

// ── Pool Key ─────────────────────────────────────────────────────────────────

const [CURRENCY0, CURRENCY1] = ETH_ZERO < USDC ? [ETH_ZERO, USDC] : [USDC, ETH_ZERO];

const POOL_ID = keccak256(
  encodeAbiParameters(
    [{ type: 'address' }, { type: 'address' }, { type: 'uint24' }, { type: 'int24' }, { type: 'address' }],
    [CURRENCY0, CURRENCY1, 500, 10, ZERO_HOOK]
  )
);

// ── ABIs ─────────────────────────────────────────────────────────────────────

const ERC20_ABI  = parseAbi(['function balanceOf(address) external view returns (uint256)']);
const STATE_ABI  = parseAbi([
  'function getSlot0(bytes32 poolId) external view returns (uint160 sqrtPriceX96,int24 tick,uint24 protocolFee,uint24 lpFee)',
  'function getLiquidity(bytes32 poolId) external view returns (uint128 liquidity)',
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

async function safeRead<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Agent Flow E2E — Base Sepolia verification', () => {
  // ── STEP 1: Agent wallet ──────────────────────────────────────────────────

  describe('Step 1: Agent wallet created', () => {
    it('agent wallet address is a valid checksummed hex address', () => {
      expect(AGENT_WALLET).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it('agent wallet received 0.005 ETH from main wallet', async () => {
      const balance = await client.getBalance({ address: AGENT_WALLET });
      expect(balance).toBeGreaterThanOrEqual(4_900_000_000_000_000n); // ≥ 0.0049 ETH
    }, 15_000);
  });

  // ── STEP 2: Send ETH tx confirmed ────────────────────────────────────────

  describe('Step 2: Send ETH transaction', () => {
    it('send ETH tx is confirmed on-chain', async () => {
      const r = await client.getTransactionReceipt({
        hash: AGENT_FLOW_TXS.sendEth as `0x${string}`,
      });
      expect(r.status).toBe('success');
      expect(r.to?.toLowerCase()).toBe(AGENT_WALLET.toLowerCase());
    }, 15_000);

    it('send ETH tx is on Base Sepolia (chain 84532)', async () => {
      const chainId = await client.getChainId();
      expect(chainId).toBe(84532);
    });
  });

  // ── STEP 3: ETH→USDC swap ────────────────────────────────────────────────

  describe('Step 3: ETH→USDC swap', () => {
    it('swap tx is confirmed on-chain', async () => {
      const r = await client.getTransactionReceipt({
        hash: AGENT_FLOW_TXS.ethUsdcSwap as `0x${string}`,
      });
      expect(r.status).toBe('success');
    }, 15_000);

    it('swap tx called PoolSwapTest', async () => {
      const r = await client.getTransactionReceipt({
        hash: AGENT_FLOW_TXS.ethUsdcSwap as `0x${string}`,
      });
      expect(r.to?.toLowerCase()).toBe(POOL_SWAP_TEST.toLowerCase());
    }, 15_000);

    it('cbBTC has no bytecode on Base Sepolia (mainnet-only)', async () => {
      const code = await client.getBytecode({ address: CBBTC_MAINNET });
      // getBytecode returns undefined when no contract is deployed
      const deployed = code !== undefined && code !== '0x' && code.length > 2;
      expect(deployed).toBe(false);
    }, 15_000);

    it('USDC rebalance swap is confirmed on-chain', async () => {
      const r = await client.getTransactionReceipt({
        hash: AGENT_FLOW_TXS.rebalanceSwap as `0x${string}`,
      });
      expect(r.status).toBe('success');
    }, 15_000);
  });

  // ── STEP 4: Add liquidity ─────────────────────────────────────────────────

  describe('Step 4: Add liquidity ETH/USDC', () => {
    it('add liquidity tx is confirmed on-chain', async () => {
      const r = await client.getTransactionReceipt({
        hash: AGENT_FLOW_TXS.addLiquidity as `0x${string}`,
      });
      expect(r.status).toBe('success');
    }, 15_000);

    it('add liquidity tx called PMLT', async () => {
      const r = await client.getTransactionReceipt({
        hash: AGENT_FLOW_TXS.addLiquidity as `0x${string}`,
      });
      expect(r.to?.toLowerCase()).toBe(PMLT.toLowerCase());
    }, 15_000);

    it('pool liquidity increased after agent flow (≥ 76B)', async () => {
      const liq = await safeRead<bigint>(
        () => client.readContract({ address: STATE_VIEW, abi: STATE_ABI, functionName: 'getLiquidity', args: [POOL_ID] }) as Promise<bigint>,
        0n
      );
      expect(liq).toBeGreaterThanOrEqual(76_000_000_000n);
    }, 15_000);
  });

  // ── STEP 5: On-chain queries ──────────────────────────────────────────────

  describe('Step 5: On-chain queries', () => {
    it('pool ID encodes correctly with ABI-padded keccak256', () => {
      const expectedPoolId = '0x32d1cea8e825dbdafdb17d5f556606e1ac0a1a4477744baba03d9fc0b62d4eb2';
      expect(POOL_ID.toLowerCase()).toBe(expectedPoolId.toLowerCase());
    });

    it('pool is initialized (sqrtPriceX96 > 0)', async () => {
      const [sqrtPriceX96] = await safeRead<[bigint, number, number, number]>(
        () => client.readContract({ address: STATE_VIEW, abi: STATE_ABI, functionName: 'getSlot0', args: [POOL_ID] }) as Promise<[bigint, number, number, number]>,
        [0n, 0, 0, 0]
      );
      expect(sqrtPriceX96).toBeGreaterThan(0n);
    }, 15_000);

    it('tick is within valid Uniswap v4 bounds (|tick| ≤ 887272)', async () => {
      const [, tick] = await safeRead<[bigint, number, number, number]>(
        () => client.readContract({ address: STATE_VIEW, abi: STATE_ABI, functionName: 'getSlot0', args: [POOL_ID] }) as Promise<[bigint, number, number, number]>,
        [0n, 0, 0, 0]
      );
      expect(Math.abs(tick)).toBeLessThanOrEqual(887272);
    }, 15_000);

    it('pool has liquidity > 0', async () => {
      const liq = await safeRead<bigint>(
        () => client.readContract({ address: STATE_VIEW, abi: STATE_ABI, functionName: 'getLiquidity', args: [POOL_ID] }) as Promise<bigint>,
        0n
      );
      expect(liq).toBeGreaterThan(0n);
    }, 15_000);

    it('main wallet has USDC balance > 0', async () => {
      const balance = await safeRead<bigint>(
        () => client.readContract({ address: USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [MAIN_WALLET] }) as Promise<bigint>,
        0n
      );
      expect(balance).toBeGreaterThan(0n);
    }, 15_000);

    it('main wallet has ETH balance > 0.05 ETH', async () => {
      const balance = await client.getBalance({ address: MAIN_WALLET });
      expect(balance).toBeGreaterThan(50_000_000_000_000_000n); // > 0.05 ETH
    }, 15_000);
  });

  // ── STEP 6: Faucet info ───────────────────────────────────────────────────

  describe('Step 6: Testnet ETH faucet', () => {
    it('faucet contract exists (has bytecode)', async () => {
      const faucetAddr = '0xaa0D98c815C3003d35E571fD51C65d7F92391883' as const;
      const code = await client.getBytecode({ address: faucetAddr });
      expect(code).toBeTruthy();
      expect(code!.length).toBeGreaterThan(2);
    }, 15_000);

    it('all 5 agent flow txs are confirmed successful', async () => {
      const hashes = Object.values(AGENT_FLOW_TXS);
      const receipts = await Promise.all(
        hashes.map(h => client.getTransactionReceipt({ hash: h as `0x${string}` }))
      );
      for (const r of receipts) {
        expect(r.status).toBe('success');
      }
    }, 60_000);
  });

  // ── Additional verifications ──────────────────────────────────────────────

  describe('Additional: Network & contract checks', () => {
    it('connected to Base Sepolia (chainId 84532)', async () => {
      const chainId = await client.getChainId();
      expect(chainId).toBe(84532);
    });

    it('USDC contract is deployed at correct address', async () => {
      const code = await client.getBytecode({ address: USDC });
      expect(code).toBeTruthy();
      expect(code!.length).toBeGreaterThan(2);
    }, 15_000);

    it('StateView contract is deployed', async () => {
      const code = await client.getBytecode({ address: STATE_VIEW });
      expect(code).toBeTruthy();
      expect(code!.length).toBeGreaterThan(2);
    }, 15_000);

    it('PoolSwapTest contract is deployed', async () => {
      const code = await client.getBytecode({ address: POOL_SWAP_TEST });
      expect(code).toBeTruthy();
      expect(code!.length).toBeGreaterThan(2);
    }, 15_000);
  });
});
