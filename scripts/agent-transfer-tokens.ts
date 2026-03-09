/**
 * scripts/agent-transfer-tokens.ts
 *
 * Purpose: Agent wallet (0xB84eC39...) sends testnet tokens to the target wallet.
 * Uses viem for direct ERC20 transfers with the agent's private key.
 *
 * Usage: npx tsx scripts/agent-transfer-tokens.ts
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  parseUnits,
  parseEther,
  erc20Abi,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import * as fs from 'fs';

const RPC_URL     = 'https://sepolia.base.org';
const BASESCAN_TX = 'https://sepolia.basescan.org/tx/';

const TARGET    = '0xbaacDCFfA93B984C914014F83Ee28B68dF88DC87' as `0x${string}`;
const USDC_ADDR = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`;
const EURC_ADDR = '0x808456652fdb597867f38412077A9182bf77359F' as `0x${string}`;
const CBBTC_ADDR = '0xcbb7c0006f23900c38eb856149f799620fcb8a4a' as `0x${string}`;

const TRANSFERS = [
  { name: 'USDC',  address: USDC_ADDR,  amount: parseUnits('1', 6) },
  { name: 'EURC',  address: EURC_ADDR,  amount: parseUnits('1', 6) },
  { name: 'cbBTC', address: CBBTC_ADDR, amount: parseUnits('0.0001', 8) },
];

async function agentTransfer(): Promise<void> {
  const walletData = JSON.parse(fs.readFileSync('docs/agent-wallet.json', 'utf8'));
  if (!walletData.privateKey) throw new Error('Private key not found in docs/agent-wallet.json');

  const account = privateKeyToAccount(walletData.privateKey as `0x${string}`);
  const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(RPC_URL) });
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });

  console.log(`Agent transferring tokens to ${TARGET}`);
  console.log(`From: ${account.address}\n`);

  const results: { name: string; txHash: string; basescanLink: string }[] = [];

  // Transfer ETH first (small amount)
  console.log('Sending 0.001 ETH...');
  try {
    const ethTx = await walletClient.sendTransaction({
      to: TARGET,
      value: parseEther('0.001'),
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: ethTx });
    const link = `${BASESCAN_TX}${ethTx}`;
    results.push({ name: 'ETH', txHash: ethTx, basescanLink: link });
    console.log(`[OK] ETH: ${link} (${receipt.status})`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[FAIL] ETH: ${msg}`);
    results.push({ name: 'ETH', txHash: 'FAILED', basescanLink: 'N/A' });
  }

  // Transfer ERC20 tokens
  for (const t of TRANSFERS) {
    console.log(`\nSending ${t.name}...`);
    try {
      const tx = await walletClient.writeContract({
        address: t.address,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [TARGET, t.amount],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      const link = `${BASESCAN_TX}${tx}`;
      results.push({ name: t.name, txHash: tx, basescanLink: link });
      console.log(`[OK] ${t.name}: ${link} (${receipt.status})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[FAIL] ${t.name}: ${msg}`);
      results.push({ name: t.name, txHash: 'FAILED', basescanLink: 'N/A' });
    }
  }

  fs.writeFileSync('docs/agent-transfer-result.json', JSON.stringify(results, null, 2));
  console.log('\nResults saved to docs/agent-transfer-result.json');

  // Update e2e doc — pick the first successful transfer TX
  const successTx = results.find(r => r.txHash !== 'FAILED');
  if (successTx) {
    const docPath = 'docs/e2e-test-results.md';
    let content = fs.readFileSync(docPath, 'utf8');
    content = content.replace(
      '- [ ] Transfer TX: https://sepolia.basescan.org/tx/[HASH]',
      `- [x] Transfer TX: ${successTx.basescanLink}`
    );
    fs.writeFileSync(docPath, content);
    console.log('Updated docs/e2e-test-results.md');
  }

  console.log('\n==========================================');
  for (const r of results) {
    console.log(`${r.name}: ${r.basescanLink}`);
  }
}

agentTransfer().catch(console.error);
