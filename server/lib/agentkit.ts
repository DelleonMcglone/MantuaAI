/**
 * agentkit.ts
 * Singleton AgentKit instance for Mantua.AI.
 * Uses CdpEvmWalletProvider (CDP v2) with idempotency key for wallet persistence.
 * Same wallet address is returned on every server restart.
 *
 * Action providers included:
 *   walletActionProvider  — get_wallet_details, native_transfer, get_balance
 *   cdpApiActionProvider  — request_faucet_funds, swap_assets, deploy_token
 *   erc20ActionProvider   — transfer_erc20, get_erc20_balance
 *   pythActionProvider    — get_price
 *
 * Required env vars:
 *   CDP_API_KEY_ID       — from https://portal.cdp.coinbase.com/
 *   CDP_API_KEY_SECRET   — from https://portal.cdp.coinbase.com/
 *   CDP_WALLET_SECRET    — any secure random string; persists wallet identity
 *   ANTHROPIC_API_KEY    — from https://console.anthropic.com/
 */

import {
  AgentKit,
  CdpEvmWalletProvider,
  walletActionProvider,
  cdpApiActionProvider,
  erc20ActionProvider,
  pythActionProvider,
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { createReactAgent }  from "@langchain/langgraph/prebuilt";
import { ChatAnthropic }     from "@langchain/anthropic";
import { HumanMessage }      from "@langchain/core/messages";

// Singleton instances — initialized once on first call
let _agentKit: AgentKit | null = null;
let _agent: ReturnType<typeof createReactAgent> | null = null;
let _walletAddress: string | null = null;
let _initPromise: Promise<AgentKit> | null = null;

/**
 * Validate that all required env vars are present.
 * Throws a descriptive error if any are missing.
 */
function validateEnvVars(): void {
  const missing: string[] = [];
  if (!process.env.CDP_API_KEY_ID)     missing.push('CDP_API_KEY_ID');
  if (!process.env.CDP_API_KEY_SECRET) missing.push('CDP_API_KEY_SECRET');
  if (!process.env.CDP_WALLET_SECRET)  missing.push('CDP_WALLET_SECRET');
  if (!process.env.ANTHROPIC_API_KEY)  missing.push('ANTHROPIC_API_KEY');

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
      `Get CDP keys at https://portal.cdp.coinbase.com/ | ` +
      `Get Anthropic key at https://console.anthropic.com/`
    );
  }
}

export async function getAgentKit(): Promise<AgentKit> {
  if (_agentKit) return _agentKit;

  // Prevent concurrent initializations
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    validateEnvVars();

    console.log('[AgentKit] Initializing CDP wallet provider...');

    const walletProvider = await CdpEvmWalletProvider.configureWithWallet({
      apiKeyId:       process.env.CDP_API_KEY_ID!,
      apiKeySecret:   process.env.CDP_API_KEY_SECRET!,
      walletSecret:   process.env.CDP_WALLET_SECRET!,
      networkId:      process.env.CDP_AGENT_NETWORK_ID ?? process.env.NETWORK_ID ?? "base-sepolia",
      idempotencyKey: process.env.IDEMPOTENCY_KEY ?? "mantua-agent-wallet-v1",
    });

    _agentKit = await AgentKit.from({
      walletProvider,
      actionProviders: [
        walletActionProvider(),
        cdpApiActionProvider({
          apiKeyId:     process.env.CDP_API_KEY_ID!,
          apiKeySecret: process.env.CDP_API_KEY_SECRET!,
        }),
        erc20ActionProvider(),
        pythActionProvider(),
      ],
    });

    // Cache wallet address from tool
    try {
      const tools = await getLangChainTools(_agentKit);
      const walletTool = tools.find(t => t.name === "get_wallet_details");
      if (walletTool) {
        const result = await walletTool.invoke({});
        const match = String(result).match(/0x[a-fA-F0-9]{40}/);
        if (match) {
          _walletAddress = match[0];
          console.log('[AgentKit] Wallet address:', _walletAddress);
        }
      }
    } catch {
      // non-fatal
    }

    return _agentKit;
  })();

  try {
    return await _initPromise;
  } catch (err) {
    _initPromise = null;
    throw err;
  }
}

export async function getAgent() {
  if (_agent) return _agent;

  const kit = await getAgentKit();
  const tools = await getLangChainTools(kit);

  const llm = new ChatAnthropic({
    model: "claude-sonnet-4-6",
    temperature: 0,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  });

  _agent = createReactAgent({
    llm,
    tools,
    messageModifier: `You are Mantua's onchain AI agent. You help users manage
a CDP wallet on Base Sepolia and perform DeFi operations.

Your capabilities:
- Create/manage the agent wallet (get_wallet_details)
- Get testnet ETH and USDC from faucet (request_faucet_funds)
- Check balances (get_balance, get_erc20_balance)
- Swap tokens (swap_assets)
- Send ETH (native_transfer)
- Send ERC-20 tokens (transfer_erc20)
- Get live prices (get_price)

Deployed Infrastructure:

Base Sepolia (chainId 84532):
- PoolManager: 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408
- PoolSwapTest: 0x8b5bcc363dde2614281ad875bad385e0a785d3b9
- cbBTC: 0xcbB7C0006F23900c38EB856149F799620fcb8A4a
- USDC: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
- EURC: 0x808456652fdb597867f38412077A9182bf77359F
- Faucet: 0xaa0D98c815C3003d35E571fD51C65d7F92391883

Stable Protection Hook behavior:
- 5-zone peg monitoring: HEALTHY → MINOR → MODERATE → SEVERE → CRITICAL
- Dynamic fees: 0.5x for peg-restoring swaps, 3x for peg-worsening swaps
- Circuit breaker: blocks all swaps when deviation > 5%
- Fee: 0x800000 (DYNAMIC_FEE_FLAG), tickSpacing: 1

Testnet Faucets:
Base Sepolia:
- ETH, USDC, cbBTC, EURC: https://portal.cdp.coinbase.com/products/faucet
- ETH: https://console.optimism.io/faucet
- USDC & EURC: https://faucet.circle.com/

Always:
- Show the full BaseScan link after every transaction: https://sepolia.basescan.org/tx/{hash}
- Show wallet address and balance after wallet operations
- Confirm token amounts and recipient before sending
- Use real on-chain data — never invent balances or prices
- Format transaction hashes as clickable links
- When users ask about testnet tokens or faucets, provide the specific faucet URLs above`,
  });

  return _agent;
}

export async function getCachedWalletAddress(): Promise<string | null> {
  if (!_walletAddress) {
    try {
      await getAgentKit();
    } catch {
      return null;
    }
  }
  return _walletAddress;
}

/**
 * Lightweight wallet info — returns address without LLM call.
 */
export async function getAgentWalletInfo(): Promise<{
  address: string;
  network: string;
  baseScanUrl: string;
}> {
  validateEnvVars();
  const address = await getCachedWalletAddress();
  if (!address) {
    // Force initialization
    await getAgentKit();
    const addr = _walletAddress;
    if (!addr) throw new Error('Failed to get agent wallet address');
    return {
      address: addr,
      network: process.env.CDP_AGENT_NETWORK_ID ?? process.env.NETWORK_ID ?? 'base-sepolia',
      baseScanUrl: `https://sepolia.basescan.org/address/${addr}`,
    };
  }
  return {
    address,
    network: process.env.CDP_AGENT_NETWORK_ID ?? process.env.NETWORK_ID ?? 'base-sepolia',
    baseScanUrl: `https://sepolia.basescan.org/address/${address}`,
  };
}

/**
 * Run the agent with a message and collect the full response.
 * Returns specific error messages instead of generic "Request failed".
 */
export async function runAgent(message: string): Promise<string> {
  try {
    const agent = await getAgent();

    const result = await agent.invoke({
      messages: [new HumanMessage(message)],
    });

    const lastMessage = result.messages[result.messages.length - 1];
    return typeof lastMessage.content === "string"
      ? lastMessage.content
      : JSON.stringify(lastMessage.content);
  } catch (err: any) {
    const msg = err?.message ?? 'Unknown error';

    // Return specific, actionable errors instead of generic "Request failed"
    if (msg.includes('CDP_API_KEY_ID') || msg.includes('not set') || msg.includes('Missing required')) {
      throw new Error(
        'Agent not configured: CDP API keys are missing. ' +
        'Add CDP_API_KEY_ID, CDP_API_KEY_SECRET, CDP_WALLET_SECRET, ' +
        'and ANTHROPIC_API_KEY to your .env file.'
      );
    }

    if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('API key')) {
      throw new Error('Invalid API credentials. Check that your API keys are correct.');
    }

    if (msg.includes('wallet') || msg.includes('provider')) {
      throw new Error(`Wallet initialization failed: ${msg}`);
    }

    throw err;
  }
}
