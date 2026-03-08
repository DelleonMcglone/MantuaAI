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
import { ChatOpenAI }        from "@langchain/openai";
import { HumanMessage }      from "@langchain/core/messages";

// Singleton instances — initialized once on first call
let _agentKit: AgentKit | null = null;
let _agent: ReturnType<typeof createReactAgent> | null = null;
let _walletAddress: string | null = null;
let _initPromise: Promise<AgentKit> | null = null;

export async function getAgentKit(): Promise<AgentKit> {
  if (_agentKit) return _agentKit;

  // Prevent concurrent initializations
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const walletProvider = await CdpEvmWalletProvider.configureWithWallet({
      apiKeyId:       process.env.CDP_API_KEY_ID!,
      apiKeySecret:   process.env.CDP_API_KEY_SECRET!,
      walletSecret:   process.env.CDP_WALLET_SECRET!,
      networkId:      process.env.NETWORK_ID ?? "base-sepolia",
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
        if (match) _walletAddress = match[0];
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

  const llm = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0,
    apiKey: process.env.OPENAI_API_KEY,
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

Always:
- Show the full BaseScan link after every transaction: https://sepolia.basescan.org/tx/{hash}
- Show wallet address and balance after wallet operations
- Confirm token amounts and recipient before sending
- Use real on-chain data — never invent balances or prices
- Format transaction hashes as clickable links`,
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
 * Run the agent with a message and collect the full response.
 * @param message - User message to process
 * @returns Agent response text
 */
export async function runAgent(message: string): Promise<string> {
  const agent = await getAgent();

  const result = await agent.invoke({
    messages: [new HumanMessage(message)],
  });

  const lastMessage = result.messages[result.messages.length - 1];
  return typeof lastMessage.content === "string"
    ? lastMessage.content
    : JSON.stringify(lastMessage.content);
}
