/**
 * scripts/deploy-stable-hook.ts
 *
 * Deploy StableProtectionHook to Base Sepolia via CREATE2 deterministic deployer.
 * The factory at 0x4e59b44847b379578588920cA78FbF26c0B4956C uses raw calldata:
 *   calldata = salt (32 bytes) + initCode
 *
 * Then initialize a USDC/EURC pool with the hook (DYNAMIC_FEE_FLAG).
 */
import {
  createWalletClient,
  createPublicClient,
  http,
  getAddress,
  parseAbi,
  encodeAbiParameters,
  parseAbiParameters,
  keccak256,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { readFileSync, writeFileSync } from 'fs';
import * as dotenv from 'dotenv';
dotenv.config();

const RPC_URL      = 'https://sepolia.base.org';
const BASESCAN     = 'https://sepolia.basescan.org/tx/';
const POOL_MANAGER = '0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408' as `0x${string}`;
const USDC_ADDR    = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`;
const EURC_ADDR    = '0x808456652fdb597867f38412077A9182bf77359F' as `0x${string}`;

// Deterministic CREATE2 deployer — calldata format: salt(32b) + initcode
const CREATE2_FACTORY = '0x4e59b44847b379578588920cA78FbF26c0B4956C' as `0x${string}`;

// Mined salt → hook address 0xB5faDA071CD56b3F56632F6771356C3e3834a0C0
const SALT         = '0x000000000000000000000000000000000000000000000000000000000000048b' as `0x${string}`;
const EXPECTED_HOOK = '0xB5faDA071CD56b3F56632F6771356C3e3834a0C0' as `0x${string}`;

// Uniswap v4 LPFeeLibrary.DYNAMIC_FEE_FLAG = 0x800000
const DYNAMIC_FEE_FLAG = 0x800000;
const SQRT_PRICE_1_1   = BigInt('79228162514264337593543950336');

const POOL_MANAGER_ABI = parseAbi([
  'function initialize((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, uint160 sqrtPriceX96) returns (int24 tick)',
]);

async function main() {
  const walletData = JSON.parse(readFileSync('docs/agent-wallet.json', 'utf8'));
  const pk = walletData.privateKey as `0x${string}`;

  const account      = privateKeyToAccount(pk);
  const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(RPC_URL) });
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });

  console.log('Deployer:', account.address);

  const bytecodeHex = readFileSync('/tmp/hook-compile/StableProtectionHook.bytecode', 'utf8').trim();
  // ABI-encode IPoolManager constructor arg
  const constructorArg = POOL_MANAGER.slice(2).padStart(64, '0');
  const initcodeHex = bytecodeHex.startsWith('0x') ? bytecodeHex.slice(2) : bytecodeHex;

  // ── Step 1: Deploy hook via CREATE2 factory ─────────────────────────────────
  const existingCode = await publicClient.getBytecode({ address: EXPECTED_HOOK });
  let deployTxHash: `0x${string}` | null = null;

  if (existingCode && existingCode.length > 2) {
    console.log(`Hook already deployed at ${EXPECTED_HOOK}`);
  } else {
    console.log(`\nDeploying StableProtectionHook...`);
    console.log(`Expected address: ${EXPECTED_HOOK}`);

    // Factory calldata = salt (32 bytes, no 0x prefix) + initcode (no 0x prefix)
    const saltHex = SALT.slice(2); // 64 hex chars = 32 bytes
    const calldata = `0x${saltHex}${initcodeHex}${constructorArg}` as `0x${string}`;

    deployTxHash = await walletClient.sendTransaction({
      to: CREATE2_FACTORY,
      data: calldata,
      gas: 6_000_000n,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: deployTxHash });
    console.log(`Deploy TX:  ${BASESCAN}${deployTxHash}`);
    console.log(`Status:     ${receipt.status}`);

    if (receipt.status !== 'success') throw new Error('Deployment TX failed');

    const code = await publicClient.getBytecode({ address: EXPECTED_HOOK });
    if (!code || code.length <= 2) {
      throw new Error(`Hook not deployed at ${EXPECTED_HOOK} — CREATE2 address mismatch?`);
    }
    console.log(`Hook deployed ✅  (${code.length / 2 - 1} bytes)`);
  }

  // ── Step 2: Initialize USDC/EURC pool with hook ────────────────────────────
  const [currency0, currency1] = getAddress(USDC_ADDR) < getAddress(EURC_ADDR)
    ? [USDC_ADDR, EURC_ADDR]
    : [EURC_ADDR, USDC_ADDR];

  const poolKey = { currency0, currency1, fee: DYNAMIC_FEE_FLAG, tickSpacing: 1, hooks: EXPECTED_HOOK };

  // Compute pool ID
  const poolKeyEncoded = encodeAbiParameters(
    parseAbiParameters('address, address, uint24, int24, address'),
    [currency0, currency1, DYNAMIC_FEE_FLAG, 1, EXPECTED_HOOK]
  );
  const poolId = keccak256(poolKeyEncoded);

  console.log(`\nPool key:`, poolKey);
  console.log(`Pool ID: ${poolId}`);
  console.log(`Initializing pool at 1:1 price...`);

  let initTxHash: `0x${string}` | null = null;
  try {
    initTxHash = await walletClient.writeContract({
      address: POOL_MANAGER,
      abi: POOL_MANAGER_ABI,
      functionName: 'initialize',
      args: [poolKey, SQRT_PRICE_1_1],
    });
    const initReceipt = await publicClient.waitForTransactionReceipt({ hash: initTxHash });
    console.log(`\nPool Init TX: ${BASESCAN}${initTxHash}`);
    console.log(`Status: ${initReceipt.status}`);
    if (initReceipt.status !== 'success') throw new Error('Pool init failed');
    console.log(`Pool initialized ✅`);
  } catch (e: any) {
    const msg = e.shortMessage || e.message || String(e);
    if (msg.includes('AlreadyInitialized') || msg.includes('PoolAlreadyInitialized') || msg.includes('0x7983c051')) {
      console.log(`Pool already initialized ✅`);
    } else {
      throw e;
    }
  }

  const result = {
    hookAddress: EXPECTED_HOOK,
    salt: SALT,
    poolId,
    poolKey: { ...poolKey, fee: `0x${DYNAMIC_FEE_FLAG.toString(16)}` },
    deployTxHash,
    initTxHash,
    basescanDeploy: deployTxHash ? `${BASESCAN}${deployTxHash}` : 'pre-existing',
    basescanInit: initTxHash ? `${BASESCAN}${initTxHash}` : 'pre-existing',
  };
  writeFileSync('docs/stable-hook-deployment.json', JSON.stringify(result, null, 2));

  console.log('\n=== STABLE PROTECTION HOOK DEPLOYED ===');
  console.log(`Hook:    ${EXPECTED_HOOK}`);
  console.log(`PoolId:  ${poolId}`);
  if (deployTxHash) console.log(`Deploy:  ${BASESCAN}${deployTxHash}`);
  if (initTxHash)   console.log(`Init:    ${BASESCAN}${initTxHash}`);
}

main().catch(console.error);
