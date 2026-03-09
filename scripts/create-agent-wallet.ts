/**
 * scripts/create-agent-wallet.ts
 *
 * Purpose: Generate a new local EVM wallet on Base Sepolia and fund it with
 * testnet ETH, USDC, EURC, and cbBTC via the CDP faucet.
 *
 * Usage: npx tsx scripts/create-agent-wallet.ts
 *
 * Prerequisites:
 *   - CDP_API_KEY_ID and CDP_API_KEY_SECRET in .env
 */

import { CdpClient } from '@coinbase/cdp-sdk';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const BASESCAN_TX   = 'https://sepolia.basescan.org/tx/';
const BASESCAN_ADDR = 'https://sepolia.basescan.org/address/';
const NETWORK       = 'base-sepolia';

const TOKENS_TO_FUND = [
  { name: 'ETH',   token: 'eth'   as const },
  { name: 'USDC',  token: 'usdc'  as const },
  { name: 'EURC',  token: 'eurc'  as const },
  { name: 'cbBTC', token: 'cbbtc' as const },
];

interface AgentWalletResult {
  address: string;
  basescanLink: string;
  faucetResults: { token: string; txHash: string; basescanLink: string }[];
}

async function createAndFundAgentWallet(): Promise<AgentWalletResult> {
  console.log('Creating Mantua.AI Agent Wallet on Base Sepolia');
  console.log('====================================================\n');

  if (!process.env.CDP_API_KEY_ID || !process.env.CDP_API_KEY_SECRET) {
    throw new Error('CDP_API_KEY_ID and CDP_API_KEY_SECRET must be set in .env');
  }

  // Generate a fresh local wallet (CDP createAccount requires wallet-secret
  // in PKCS8-base64 format; faucet only needs API key auth)
  console.log('1. Generating new local EVM wallet...');
  const privateKey = generatePrivateKey();
  const viemAccount = privateKeyToAccount(privateKey);
  const agentAddress = viemAccount.address;

  console.log(`[OK] Agent wallet created!`);
  console.log(`     Address:  ${agentAddress}`);
  console.log(`     BaseScan: ${BASESCAN_ADDR}${agentAddress}\n`);

  // Initialize CDP client for faucet calls (faucet only needs API key auth)
  const cdp = new CdpClient({
    apiKeyId:     process.env.CDP_API_KEY_ID,
    apiKeySecret: process.env.CDP_API_KEY_SECRET,
  });

  // Fund with testnet tokens
  const faucetResults = [];

  for (const { name, token } of TOKENS_TO_FUND) {
    console.log(`2. Requesting ${name} from faucet...`);
    try {
      const faucetResult = await cdp.evm.requestFaucet({
        address: agentAddress,
        token,
        network: NETWORK,
      });
      const txHash = faucetResult.transactionHash;
      const link   = `${BASESCAN_TX}${txHash}`;
      faucetResults.push({ token: name, txHash, basescanLink: link });
      console.log(`   [OK] ${name}: ${link}`);
      await new Promise(r => setTimeout(r, 3000));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`   [FAIL] ${name}: ${msg}`);
      faucetResults.push({ token: name, txHash: 'FAILED', basescanLink: 'N/A' });
    }
  }

  const result: AgentWalletResult = {
    address: agentAddress,
    basescanLink: `${BASESCAN_ADDR}${agentAddress}`,
    faucetResults,
  };

  // Persist wallet and results
  fs.mkdirSync('docs', { recursive: true });
  fs.writeFileSync('docs/agent-wallet.json', JSON.stringify({
    address: agentAddress,
    privateKey,   // keep secret — never commit
    network: NETWORK,
  }, null, 2));
  fs.writeFileSync('docs/agent-wallet-result.json', JSON.stringify(result, null, 2));
  console.log('\nWallet data saved to docs/agent-wallet.json');

  // Update e2e results
  updateTestResults(result);

  console.log('\n====================================================');
  console.log('AGENT WALLET SUMMARY');
  console.log('====================================================');
  console.log(`Address: ${BASESCAN_ADDR}${agentAddress}`);
  for (const r of faucetResults) {
    console.log(`  ${r.token}: ${r.basescanLink}`);
  }

  return result;
}

function updateTestResults(result: AgentWalletResult): void {
  const docPath = 'docs/e2e-test-results.md';
  if (!fs.existsSync(docPath)) return;

  let content = fs.readFileSync(docPath, 'utf8');

  content = content.replace(
    '- [ ] New agent wallet address: 0x[ADDRESS]',
    `- [x] New agent wallet address: ${result.address} (${result.basescanLink})`
  );

  const tokenNameMap: Record<string, string> = { ETH: 'ETH', USDC: 'USDC', EURC: 'EURC', cbBTC: 'cbBTC' };
  for (const r of result.faucetResults) {
    if (r.txHash === 'FAILED') continue;
    const name = tokenNameMap[r.token] || r.token;
    const padMap: Record<string, string> = { ETH: '  ', USDC: ' ', EURC: ' ', cbBTC: '' };
    const pad = padMap[name] ?? '';
    const oldLine = `- [ ] Agent wallet TX (${name}):${pad}  https://sepolia.basescan.org/tx/[HASH]`;
    const newLine = `- [x] Agent wallet TX (${name}):${pad}  ${r.basescanLink}`;
    content = content.replace(oldLine, newLine);
  }

  fs.writeFileSync(docPath, content);
  console.log('\nUpdated docs/e2e-test-results.md');
}

createAndFundAgentWallet().catch(console.error);
