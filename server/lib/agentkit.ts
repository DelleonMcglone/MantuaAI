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
import { getLangChainTools }       from "@coinbase/agentkit-langchain";
import { createReactAgent }        from "@langchain/langgraph/prebuilt";
import { ChatOpenAI }              from "@langchain/openai";
import { HumanMessage }            from "@langchain/core/messages";
import { DynamicStructuredTool }   from "@langchain/core/tools";
import { z }                       from "zod";
import {
  getAllTokenPrices,
  getTokenPrice,
  getTokenPriceHistory,
  getTokenValueUSD,
  formatTokenPrice,
  MantuaToken,
} from "../services/coinGeckoService";

// ── CoinGecko tools for the LangChain agent ───────────────────────────────────
const coinGeckoTools = [
  new DynamicStructuredTool({
    name: "get_all_token_prices",
    description: "Get current USD prices for all 4 Mantua tokens: ETH, USDC, cbBTC, EURC. Use this when the user asks about prices generally or wants a market overview.",
    schema: z.object({}),
    func: async () => {
      const prices = await getAllTokenPrices();
      return prices.map(formatTokenPrice).join("\n");
    },
  }),
  new DynamicStructuredTool({
    name: "get_token_price",
    description: "Get the current USD price for a specific token. Use when the user asks about a single token price.",
    schema: z.object({
      token: z.enum(["ETH", "USDC", "cbBTC", "EURC"]).describe("Token symbol"),
    }),
    func: async ({ token }) => {
      const price = await getTokenPrice(token as MantuaToken);
      return formatTokenPrice(price);
    },
  }),
  new DynamicStructuredTool({
    name: "get_token_price_history",
    description: "Get historical price data for a token to show trends over time.",
    schema: z.object({
      token: z.enum(["ETH", "USDC", "cbBTC", "EURC"]).describe("Token symbol"),
      days: z.number().describe("Number of days of history: 1, 7, 14, 30, or 90"),
    }),
    func: async ({ token, days }) => {
      const validDays = [1, 7, 14, 30, 90];
      const d = (validDays.includes(days) ? days : 7) as 1 | 7 | 14 | 30 | 90;
      const history = await getTokenPriceHistory(token as MantuaToken, d);
      const first = history.prices[0]?.price ?? 0;
      const last  = history.prices[history.prices.length - 1]?.price ?? 0;
      const change = first > 0 ? (((last - first) / first) * 100).toFixed(2) : "0.00";
      return (
        `${token} price over last ${d} days:\n` +
        `Start: $${first.toFixed(2)}\n` +
        `Current: $${last.toFixed(2)}\n` +
        `Change: ${Number(change) >= 0 ? "+" : ""}${change}%\n` +
        `Data points: ${history.prices.length}`
      );
    },
  }),
  new DynamicStructuredTool({
    name: "calculate_token_value",
    description: "Calculate the USD value of a specific amount of a token. Use when the user asks 'how much is X ETH worth' or similar.",
    schema: z.object({
      token: z.enum(["ETH", "USDC", "cbBTC", "EURC"]).describe("Token symbol"),
      amount: z.number().describe("Amount of the token"),
    }),
    func: async ({ token, amount }) => {
      const result = await getTokenValueUSD(token as MantuaToken, amount);
      return result.formatted;
    },
  }),
];

// Singleton instances — initialized once on first call
let _agentKit: AgentKit | null = null;
let _agent: ReturnType<typeof createReactAgent> | null = null;
let _walletAddress: string | null = null;
let _initPromise: Promise<AgentKit> | null = null;

function isConfiguredValue(value: string | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && !/^your_.+_here$/i.test(trimmed);
}

/**
 * Validate that all required env vars are present.
 * Throws a descriptive error if any are missing.
 */
function validateEnvVars(): void {
  const missing: string[] = [];
  if (!isConfiguredValue(process.env.CDP_API_KEY_ID))     missing.push('CDP_API_KEY_ID');
  if (!isConfiguredValue(process.env.CDP_API_KEY_SECRET)) missing.push('CDP_API_KEY_SECRET');
  if (!isConfiguredValue(process.env.CDP_WALLET_SECRET))  missing.push('CDP_WALLET_SECRET');

  const hasOpenAI = isConfiguredValue(process.env.AI_INTEGRATIONS_OPENAI_API_KEY) ||
                    isConfiguredValue(process.env.OPENAI_API_KEY);
  const hasAnthropic = isConfiguredValue(process.env.ANTHROPIC_API_KEY);
  if (!hasOpenAI && !hasAnthropic) missing.push('OPENAI_API_KEY (or ANTHROPIC_API_KEY)');

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
      `Get CDP keys at https://portal.cdp.coinbase.com/`
    );
  }
}

export async function getAgentKit(): Promise<AgentKit> {
  if (_agentKit) return _agentKit;

  // Prevent concurrent initializations
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    // Verbose diagnostic — shows exactly which vars are present at runtime
    console.log('[AgentKit] ENV diagnostic:', {
      CDP_API_KEY_ID:                    process.env.CDP_API_KEY_ID                    ? `SET (${process.env.CDP_API_KEY_ID.slice(0, 8)}...)` : 'MISSING',
      CDP_API_KEY_SECRET:                process.env.CDP_API_KEY_SECRET                ? 'SET' : 'MISSING',
      CDP_WALLET_SECRET:                 process.env.CDP_WALLET_SECRET                 ? 'SET' : 'MISSING',
      AI_INTEGRATIONS_OPENAI_API_KEY:    process.env.AI_INTEGRATIONS_OPENAI_API_KEY    ? 'SET' : 'MISSING',
      OPENAI_API_KEY:                    process.env.OPENAI_API_KEY                    ? 'SET' : 'MISSING',
      NODE_ENV:                          process.env.NODE_ENV,
    });

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
    _agent = null; // reset so next call re-creates with fresh kit
    throw err;
  }
}

export async function getAgent() {
  if (_agent) return _agent;

  const kit = await getAgentKit();
  const agentKitTools = await getLangChainTools(kit);
  const tools = [...agentKitTools, ...coinGeckoTools];

  const llm = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0,
    openAIApiKey:
      process.env.AI_INTEGRATIONS_OPENAI_API_KEY ??
      process.env.OPENAI_API_KEY,
    configuration: {
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    },
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
- Get live token prices via CoinGecko (get_token_price, get_all_token_prices)
- Get price history and trends (get_token_price_history)
- Calculate USD value of a token amount (calculate_token_value)

PRICE DATA — powered by CoinGecko (real mainnet prices):
Use get_token_price for single token, get_all_token_prices for a market overview.
NOTE: You are on Base Sepolia testnet, but prices are real mainnet values from CoinGecko.
When a user asks "what is the ETH price" or "how much is my balance worth", use the
CoinGecko tools — this is correct behavior. Never say you don't have real-time prices.

SWAP EXECUTION RULES (mandatory):
1. amountSpecified MUST be NEGATIVE for exact-input swaps — always negate the user's amount.
2. NEVER hardcode gas — use viem's automatic gas estimation.
3. For ERC-20 tokenIn (USDC, cbBTC, EURC): check allowance, approve PoolSwapTest if needed.
4. ETH (native) requires NO approval — pass value in the transaction instead.
5. PoolSwapTest: 0x8b5bcc363dde2614281ad875bad385e0a785d3b9
6. Swap workflow: parse tokenIn/tokenOut/amount → show quote → confirm → execute → return BaseScan link.

HOOK SELECTION RULE (mandatory for all swap and liquidity operations):
- If the pair is USDC/EURC or EURC/USDC → ALWAYS use the Stable Protection Hook:
    fee: 0x800000 (DYNAMIC_FEE_FLAG), tickSpacing: 1
    Hook address: 0xB5faDA071CD56b3F56632F6771356C3e3834a0C0
- All other pairs → standard config:
    fee: 3000, tickSpacing: 60, hook: zero address (0x0000000000000000000000000000000000000000)

LIQUIDITY WORKFLOW:
1. Parse the user's message to identify tokenA, tokenB, and amounts.
2. Apply the HOOK SELECTION RULE above — never use the stable hook for non-stable pairs.
3. Confirm the pool pair, amounts, and hook config with the user before executing.
4. Check if the pool is already initialized before calling modifyLiquidity.
5. Execute via PoolModifyLiquidityTest at 0x37429cd17cb1454c34e7f50b09725202fd533039.
6. Return the BaseScan transaction link after execution.
IMPORTANT: amountSpecified must be negative for exact-input. Never hardcode gas.

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

Testnet Faucets — when users ask about testnet tokens or faucets, respond EXACTLY like this (copy this format verbatim, do not change it):
Here's where to get testnet tokens on **Base Sepolia**:

• [Coinbase CDP Faucet](https://portal.cdp.coinbase.com/products/faucet) — ETH, USDC, cbBTC, and EURC
• [Optimism Faucet](https://console.optimism.io/faucet) — ETH
• [Circle Faucet](https://faucet.circle.com/) — USDC and EURC
IMPORTANT: Use markdown link syntax [Name](url) so the faucet name is clickable. Never show raw URLs. Always use bullet points (•).

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

export async function logAgentKitHealth(): Promise<void> {
  try {
    const info = await getAgentWalletInfo();
    console.log(`[AgentKit] initialized successfully, agent wallet: ${info.address}, network: ${info.network}`);
  } catch (err) {
    const detail = err instanceof Error ? { message: err.message, stack: err.stack, name: err.name } : err;
    console.error(`[AgentKit] startup health check failed: ${JSON.stringify(detail)}`);
  }
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
        'Add CDP_API_KEY_ID, CDP_API_KEY_SECRET, and CDP_WALLET_SECRET to your .env file.'
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
