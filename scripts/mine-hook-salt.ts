/**
 * scripts/mine-hook-salt.ts
 * Mine a CREATE2 salt for StableProtectionHook on Base Sepolia.
 * Hook flags: BEFORE_INITIALIZE (0x2000) | BEFORE_SWAP (0x0080) | AFTER_SWAP (0x0040) = 0x20C0
 */
import { getContractAddress, keccak256 } from 'viem';
import { readFileSync } from 'fs';

// Hook permission bits required in the hook address (lower 14 bits)
const HOOK_FLAGS = BigInt(0x2000 | 0x0080 | 0x0040); // 0x20C0
const MASK = BigInt('0x3FFF'); // 14 bits

// Standard CREATE2 factory (Nick's factory, deployed everywhere)
const CREATE2_FACTORY = '0x4e59b44847b379578588920cA78FbF26c0B4956C' as `0x${string}`;
const POOL_MANAGER   = '0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408' as `0x${string}`;

const bytecodeHex = readFileSync('/tmp/hook-compile/StableProtectionHook.bytecode', 'utf8').trim();
// ABI-encode pool manager address as constructor arg
const constructorArg = POOL_MANAGER.slice(2).padStart(64, '0');
const initcode = (bytecodeHex + constructorArg) as `0x${string}`;

console.log(`initcode: ${initcode.length / 2} bytes`);
console.log(`Target flags: 0x${HOOK_FLAGS.toString(16).toUpperCase()} (lower 14 bits of hook address)`);
console.log('Mining...');

const MAX = 2_000_000;
for (let salt = 0; salt <= MAX; salt++) {
  const saltBytes = ('0x' + salt.toString(16).padStart(64, '0')) as `0x${string}`;
  const addr = getContractAddress({
    from: CREATE2_FACTORY,
    bytecode: initcode,
    opcode: 'CREATE2',
    salt: saltBytes,
  });
  const addrBigInt = BigInt(addr);
  if ((addrBigInt & MASK) === HOOK_FLAGS) {
    console.log(`\nFOUND salt=${salt}`);
    console.log(`Hook address: ${addr}`);
    console.log(`Salt hex: ${saltBytes}`);
    console.log(`Address suffix: 0x${(addrBigInt & MASK).toString(16).padStart(4, '0').toUpperCase()}`);
    process.exit(0);
  }
  if (salt % 100_000 === 0 && salt > 0) process.stdout.write(`${salt}...`);
}
console.log(`\nNo salt found in ${MAX} iterations`);
process.exit(1);
