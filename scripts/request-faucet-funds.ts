/**
 * scripts/request-faucet-funds.ts
 *
 * Purpose: Request testnet tokens from Coinbase Developer Platform faucet
 * for Base Sepolia network. Supports ETH, USDC, EURC, and cbBTC.
 *
 * Usage: npx tsx scripts/request-faucet-funds.ts
 *
 * Prerequisites:
 *   - CDP_API_KEY_ID set in .env
 *   - CDP_API_KEY_SECRET set in .env
 */

import { CdpClient } from '@coinbase/cdp-sdk';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const TARGET_ADDRESS = '0xbaacDCFfA93B984C914014F83Ee28B68dF88DC87';
const BASESCAN_TX_URL = 'https://sepolia.basescan.org/tx/';
const NETWORK = 'base-sepolia';

const TOKENS_TO_REQUEST = [
  { name: 'ETH',   token: 'eth'   as const },
  { name: 'USDC',  token: 'usdc'  as const },
  { name: 'EURC',  token: 'eurc'  as const },
  { name: 'cbBTC', token: 'cbbtc' as const },
];

interface FaucetResult {
  token: string;
  success: boolean;
  txHash?: string;
  basescanLink?: string;
  error?: string;
}

async function requestFaucetFunds(): Promise<void> {
  console.log('Mantua.AI — CDP Faucet Fund Request');
  console.log('==========================================');
  console.log(`Target: ${TARGET_ADDRESS}`);
  console.log(`Network: ${NETWORK}\n`);

  if (!process.env.CDP_API_KEY_ID || !process.env.CDP_API_KEY_SECRET) {
    throw new Error('CDP_API_KEY_ID and CDP_API_KEY_SECRET must be set in .env');
  }

  const cdp = new CdpClient({
    apiKeyId:     process.env.CDP_API_KEY_ID,
    apiKeySecret: process.env.CDP_API_KEY_SECRET,
  });

  const results: FaucetResult[] = [];

  for (const { name, token } of TOKENS_TO_REQUEST) {
    console.log(`\nRequesting ${name}...`);
    try {
      const faucetResult = await cdp.evm.requestFaucet({
        address: TARGET_ADDRESS,
        token,
        network: NETWORK,
      });

      const txHash      = faucetResult.transactionHash;
      const basescanLink = `${BASESCAN_TX_URL}${txHash}`;

      results.push({ token: name, success: true, txHash, basescanLink });
      console.log(`[OK] ${name} faucet success!`);
      console.log(`     TX Hash: ${txHash}`);
      console.log(`     BaseScan: ${basescanLink}`);

      // Brief pause between requests to avoid rate-limiting
      await new Promise(r => setTimeout(r, 3000));
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      results.push({ token: name, success: false, error: errorMsg });
      console.error(`[FAIL] ${name}: ${errorMsg}`);
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Persist results
  fs.mkdirSync('docs', { recursive: true });
  fs.writeFileSync('docs/faucet-results.json', JSON.stringify(results, null, 2));
  console.log('\nResults saved to docs/faucet-results.json');

  // Update e2e test results doc
  updateTestResults(results);

  // Print summary
  console.log('\n==========================================');
  console.log('FAUCET SUMMARY');
  console.log('==========================================');
  for (const r of results) {
    if (r.success) {
      console.log(`[OK] ${r.token}: ${r.basescanLink}`);
    } else {
      console.log(`[FAIL] ${r.token}: ${r.error}`);
    }
  }
}

function updateTestResults(results: FaucetResult[]): void {
  const docPath = 'docs/e2e-test-results.md';
  if (!fs.existsSync(docPath)) return;

  let content = fs.readFileSync(docPath, 'utf8');
  for (const r of results) {
    if (r.success && r.basescanLink) {
      const pad = r.token === 'cbBTC' ? '' : r.token === 'USDC' || r.token === 'EURC' ? '  ' : '   ';
      const oldLine = `- [ ] ${r.token}:${pad} TX: https://sepolia.basescan.org/tx/[HASH]`;
      const newLine = `- [x] ${r.token}:${pad} TX: ${r.basescanLink}`;
      content = content.replace(oldLine, newLine);
    }
  }
  fs.writeFileSync(docPath, content);
  console.log('\nUpdated docs/e2e-test-results.md');
}

requestFaucetFunds().catch(console.error);
