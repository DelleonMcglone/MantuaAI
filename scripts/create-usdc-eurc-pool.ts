/**
 * scripts/create-usdc-eurc-pool.ts
 *
 * Purpose: Initialize a Uniswap v4 USDC/EURC pool on Base Sepolia.
 * Uses the target wallet (0xbaac...DC87) which has ETH, USDC, EURC.
 *
 * NOTE: The Stable Protection Hook must be deployed to Base Sepolia with
 * `forge script script/Deploy.s.sol:Deploy --rpc-url https://sepolia.base.org`
 * before this script can use it. Set STABLE_PROTECTION_HOOK_ADDRESS in .env.
 * Without it, this script uses address(0) (no hook) to create a standard pool.
 *
 * Usage: PRIVATE_KEY=0x... npx tsx scripts/create-usdc-eurc-pool.ts
 * Or set PRIVATE_KEY in .env
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  parseUnits,
  getAddress,
  zeroAddress,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const RPC_URL     = 'https://sepolia.base.org';
const BASESCAN_TX = 'https://sepolia.basescan.org/tx/';

const POOL_MANAGER = '0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408' as `0x${string}`;
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`;
const EURC_ADDRESS = '0x808456652fdb597867f38412077A9182bf77359F' as `0x${string}`;

// Hook address — set env var STABLE_PROTECTION_HOOK_ADDRESS after deploying the hook
// Falls back to address(0) for a standard (no-hook) pool
const STABLE_PROTECTION_HOOK = (
  process.env.STABLE_PROTECTION_HOOK_ADDRESS ?? zeroAddress
) as `0x${string}`;

// For a standard pool with no hook: use fee = 500 (0.05%) or 3000 (0.3%)
// For Stable Protection Hook: fee must be 0x800000 (DYNAMIC_FEE_FLAG)
const FEE          = STABLE_PROTECTION_HOOK === zeroAddress ? 500 : 0x800000;
const TICK_SPACING = STABLE_PROTECTION_HOOK === zeroAddress ? 10  : 10;

// sqrtPriceX96 for 1:1 price (USDC:EURC ≈ 1:1 at launch)
const INITIAL_SQRT_PRICE = BigInt('79228162514264337593543950336');

const POOL_MANAGER_ABI = [
  {
    name: 'initialize',
    type: 'function',
    inputs: [
      {
        name: 'key',
        type: 'tuple',
        components: [
          { name: 'currency0', type: 'address' },
          { name: 'currency1', type: 'address' },
          { name: 'fee',       type: 'uint24'  },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'hooks',    type: 'address'  },
        ],
      },
      { name: 'sqrtPriceX96', type: 'uint160' },
    ],
    outputs: [{ name: 'tick', type: 'int24' }],
    stateMutability: 'nonpayable',
  },
] as const;

async function createPool(): Promise<void> {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error('PRIVATE_KEY not set in .env');

  const account      = privateKeyToAccount(pk as `0x${string}`);
  const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(RPC_URL) });
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });

  console.log('Creating USDC/EURC Pool on Base Sepolia');
  console.log(`Account: ${account.address}`);
  console.log(`Hook:    ${STABLE_PROTECTION_HOOK === zeroAddress ? 'None (address(0))' : STABLE_PROTECTION_HOOK}`);
  console.log(`Fee:     ${FEE} (${FEE === 0x800000 ? 'DYNAMIC_FEE_FLAG' : FEE + ' bps / 100'})\n`);

  // Sort tokens — Uniswap v4 requires currency0 < currency1
  const [currency0, currency1] =
    getAddress(USDC_ADDRESS) < getAddress(EURC_ADDRESS)
      ? [USDC_ADDRESS, EURC_ADDRESS]
      : [EURC_ADDRESS, USDC_ADDRESS];

  const poolKey = {
    currency0,
    currency1,
    fee:         FEE,
    tickSpacing: TICK_SPACING,
    hooks:       STABLE_PROTECTION_HOOK,
  };

  console.log('Pool Key:', poolKey);
  console.log('\nInitializing pool...');

  const initTx = await walletClient.writeContract({
    address:      POOL_MANAGER,
    abi:          POOL_MANAGER_ABI,
    functionName: 'initialize',
    args:         [poolKey, INITIAL_SQRT_PRICE],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: initTx });
  const basescanLink = `${BASESCAN_TX}${initTx}`;

  console.log(`\n[OK] Pool Initialized!`);
  console.log(`     TX Hash:  ${initTx}`);
  console.log(`     BaseScan: ${basescanLink}`);
  console.log(`     Block:    ${receipt.blockNumber}`);
  console.log(`     Status:   ${receipt.status}`);

  if (receipt.status !== 'success') {
    throw new Error(`Pool initialization FAILED — check: ${basescanLink}`);
  }

  const result = { poolKey, txHash: initTx, basescanLink, blockNumber: receipt.blockNumber.toString() };
  fs.mkdirSync('docs', { recursive: true });
  fs.writeFileSync('docs/pool-usdc-eurc-result.json', JSON.stringify(result, null, 2));
  console.log('\nResult saved to docs/pool-usdc-eurc-result.json');

  // Update e2e doc
  const docPath = 'docs/e2e-test-results.md';
  if (fs.existsSync(docPath)) {
    let content = fs.readFileSync(docPath, 'utf8');
    content = content.replace(
      '- [ ] Pool TX: https://sepolia.basescan.org/tx/[HASH]',
      `- [x] Pool TX: ${basescanLink}`
    );
    fs.writeFileSync(docPath, content);
    console.log('Updated docs/e2e-test-results.md');
  }
}

createPool().catch(console.error);
