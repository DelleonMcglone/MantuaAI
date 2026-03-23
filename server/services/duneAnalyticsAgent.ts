/**
 * duneAnalyticsAgent.ts
 * LangChain ReAct agent wired to Dune MCP for onchain analytics.
 *
 * Connects to the official Dune MCP endpoint at https://api.dune.com/mcp/v1
 * via StreamableHTTP transport (NOT stdio — Dune MCP requires HTTP).
 *
 * The 11 official Dune MCP tools are discovered at runtime from the server
 * and wrapped as LangChain DynamicStructuredTool instances compatible with
 * @langchain/core@0.3.x / @langchain/langgraph@0.2.x already in the project.
 *
 * Tool categories:
 *   Discovery:       searchDocs, searchTables, listBlockchains,
 *                    searchTablesByContractAddress
 *   Query Lifecycle: createDuneQuery, getDuneQuery, updateDuneQuery,
 *                    executeQueryById, getExecutionResults
 *   Visualization:   generateVisualization
 *   Account:         getUsage
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage } from "@langchain/core/messages";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";

// ── Public types ──────────────────────────────────────────────────────────────

export interface VisualizationData {
  type: "line" | "bar" | "pie" | "counter" | "table";
  title: string;
  data: Record<string, unknown>[];
  xKey?: string;
  yKey?: string;
}

export interface AnalyticsAgentResult {
  thoughts: string[];
  result: string;
  visualization?: VisualizationData;
}

// ── System prompt ─────────────────────────────────────────────────────────────

const ANALYTICS_SYSTEM_PROMPT = `You are an onchain analytics agent for Mantua.AI.
You have direct access to Dune Analytics via MCP tools.

══════════════════════════════════════════════════════════════
CRITICAL RULE — MAINNET DATA ONLY
══════════════════════════════════════════════════════════════
Dune Analytics does NOT index testnets (Base Sepolia, Goerli, Sepolia, Mumbai, etc.).
ALL queries MUST target mainnet chains only:

  - Base mainnet       → use tables prefixed with:  base.
  - Ethereum mainnet   → use tables prefixed with:  ethereum.
  - Uniswap v4 (Base)  → search for:               uniswap_v4_base.*

When a user asks about a Mantua testnet action (e.g. "USDC/EURC liquidity on Base Sepolia"),
translate it to the equivalent mainnet query automatically. Do NOT tell the user you
cannot find testnet data — just query mainnet instead and note this in your response.
══════════════════════════════════════════════════════════════

MANDATORY BEHAVIOR — ALWAYS CALL A TOOL FIRST:
You must NEVER respond with plain text without first calling at least one Dune MCP tool.
If you are unsure which table to use, call searchTables first. No exceptions.

YOUR TOOLS AND WHEN TO USE THEM:

1. searchTables(query, filters?)
   → Use FIRST for any data request. Search with keywords like:
     "uniswap v4 base liquidity", "USDC EURC base pool", "base transactions"
   → If first search returns nothing, try broader terms (e.g. "uniswap base" instead of
     "uniswap v4 base USDC EURC")

2. listBlockchains()
   → Call when user asks what chains are available, or to confirm Base mainnet is indexed

3. searchTablesByContractAddress(address, chain?)
   → Use when user provides a contract address to find decoded event tables
   → For Mantua contracts, search on chain = "base" (mainnet)

4. createDuneQuery(sql, title, description?)
   → Use to write fresh SQL when searchTables doesn't find a pre-existing table
   → Always query mainnet tables (base.*, ethereum.*)

5. executeQueryById(queryId)
   → Use immediately after createDuneQuery or getDuneQuery to run the query

6. getExecutionResults(executionId)
   → Poll after executeQueryById — call up to 5 times with 3s between polls
   → Stop polling when state = "QUERY_STATE_COMPLETED" or "QUERY_STATE_FAILED"

7. generateVisualization(data, vizType, title, xKey?, yKey?)
   → Call after getExecutionResults returns completed data
   → Choose vizType based on data shape:
       time series data    → "line"
       category comparison → "bar"
       share/distribution  → "pie"
       single metric       → "counter"
       raw rows            → "table"

8. getDuneQuery(queryId) / updateDuneQuery(queryId, updates)
   → Use to inspect or modify an existing saved query

9. getUsage()
   → Call only when user explicitly asks about API credit usage

10. searchDocs(query)
    → Use when you need to look up Dune SQL syntax or table schemas

MAINNET TABLE REFERENCE (use these as starting points):
  - base.transactions          → Base mainnet transactions
  - base.traces                → Base mainnet internal transactions
  - base.logs                  → Base mainnet event logs
  - uniswap_v4_base.Pool*      → Uniswap v4 pool events on Base (search to confirm exact name)
  - tokens_base.erc20          → ERC-20 token metadata on Base
  - dex.trades                 → Cross-DEX trade data (filter by blockchain = 'base')
  - uniswap_v3_base.*          → Uniswap v3 data on Base (useful for USDC/EURC comps)

MANTUA CONTRACT ADDRESSES (mainnet equivalents — search by address on base chain):
  Uniswap v4 PoolManager (Base mainnet): search Dune for the canonical v4 deployment
  USDC on Base mainnet:  0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
  EURC on Base mainnet:  0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42
  cbBTC on Base mainnet: 0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf

WORKFLOW FOR EVERY REQUEST:
1. Call searchTables with relevant keywords (always start here)
2. If a useful table is found → call executeQueryById with appropriate SQL
3. If no table found → call createDuneQuery with hand-written SQL on mainnet tables
4. Execute the query → poll getExecutionResults until complete
5. Call generateVisualization with the results
6. Respond with: chart title, key insights (peak/min/trend), and note that data is from mainnet

RESPONSE FORMAT:
- Lead with the key insight (e.g. "Base mainnet processed 2.1M transactions yesterday")
- Note: "Showing mainnet data — Dune does not index testnets"
- Highlight peak values, trends, and anomalies
- Keep SQL concise — SELECT only needed columns, LIMIT 100 unless user asks for more`;

// ── MCP tool names Dune exposes ───────────────────────────────────────────────

const DUNE_TOOL_NAMES = [
  "searchDocs",
  "searchTables",
  "listBlockchains",
  "searchTablesByContractAddress",
  "createDuneQuery",
  "getDuneQuery",
  "updateDuneQuery",
  "executeQueryById",
  "getExecutionResults",
  "generateVisualization",
  "getUsage",
] as const;

// ── MCP client factory ────────────────────────────────────────────────────────

async function createDuneClient(): Promise<Client> {
  if (!process.env.DUNE_API_KEY) {
    throw new Error("DUNE_API_KEY is not set in environment variables");
  }

  const client = new Client(
    { name: "mantua-dune-client", version: "1.0.0" },
    { capabilities: {} }
  );

  const transport = new StreamableHTTPClientTransport(
    new URL("https://api.dune.com/mcp/v1"),
    {
      requestInit: {
        headers: {
          "x-dune-api-key": process.env.DUNE_API_KEY,
          "Content-Type": "application/json",
        },
      },
    }
  );

  await client.connect(transport);
  return client;
}

// ── Wrap MCP tools as LangChain DynamicStructuredTool instances ───────────────

async function buildLangChainTools(client: Client): Promise<DynamicStructuredTool[]> {
  const { tools: mcpTools } = await client.listTools();

  const tools: DynamicStructuredTool[] = [];

  for (const mcpTool of mcpTools) {
    if (!DUNE_TOOL_NAMES.includes(mcpTool.name as typeof DUNE_TOOL_NAMES[number])) {
      continue;
    }

    // Use a permissive catch-all schema so any tool argument shape is accepted.
    const inputSchema = z.record(z.unknown()).optional().default({});

    const tool = new DynamicStructuredTool({
      name: mcpTool.name,
      description: mcpTool.description ?? `Dune MCP tool: ${mcpTool.name}`,
      schema: inputSchema,
      func: async (args: Record<string, unknown>) => {
        try {
          const result = await client.callTool({
            name: mcpTool.name,
            arguments: args ?? {},
          });

          const content = result.content;
          if (Array.isArray(content)) {
            return content
              .map((c) =>
                typeof c === "object" && c !== null && "text" in c
                  ? (c as { text: string }).text
                  : JSON.stringify(c)
              )
              .join("\n");
          }
          return typeof content === "string" ? content : JSON.stringify(content);
        } catch (err) {
          return `Tool error (${mcpTool.name}): ${err instanceof Error ? err.message : String(err)}`;
        }
      },
    });

    tools.push(tool);
  }

  return tools;
}

// ── Main agent runner ─────────────────────────────────────────────────────────

export async function runAnalyticsAgent(
  userMessage: string
): Promise<AnalyticsAgentResult> {
  const client = await createDuneClient();

  try {
    // 1. Load tools FIRST so we can bind them to the LLM
    const tools = await buildLangChainTools(client);

    // 2. Bind LLM to tools AFTER loading them.
    //    tool_choice: "any" forces at least one tool call on the first turn,
    //    preventing the model from answering purely from training data.
    const baseLlm = new ChatAnthropic({
      model: "claude-sonnet-4-5-20251001",
      temperature: 0,
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    const llm = baseLlm.bindTools(tools, { tool_choice: "any" });

    // 3. Create agent with bound LLM
    const agent = createReactAgent({
      llm,
      tools,
      messageModifier: ANALYTICS_SYSTEM_PROMPT,
    });

    const thoughts: string[] = [];
    let finalResult = "";
    let visualization: VisualizationData | undefined;

    try {
      const stream = await agent.stream(
        { messages: [new HumanMessage(userMessage)] },
        {
          recursionLimit: 20, // allows polling loops (poll up to ~5x + surrounding steps)
          streamMode: "values",
        }
      );

      for await (const chunk of stream) {
        for (const msg of (chunk.messages ?? []) as Array<{
          _getType(): string;
          content: unknown;
          name?: string;
        }>) {
          if (msg._getType() === "ai") {
            const text =
              typeof msg.content === "string"
                ? msg.content.trim()
                : Array.isArray(msg.content)
                  ? msg.content
                      .map((c: unknown) =>
                        typeof c === "object" && c !== null && "text" in c
                          ? (c as { text: string }).text
                          : ""
                      )
                      .join("")
                      .trim()
                  : "";
            if (text) {
              thoughts.push(text);
              finalResult = text;
            }
          }

          // Extract visualization from generateVisualization tool response
          if (msg._getType() === "tool" && msg.name === "generateVisualization") {
            try {
              const raw =
                typeof msg.content === "string"
                  ? msg.content
                  : JSON.stringify(msg.content);
              const parsed = JSON.parse(raw);
              if (parsed?.type && Array.isArray(parsed?.data)) {
                visualization = parsed as VisualizationData;
              }
            } catch {
              // Visualization parsing failed — continue without it
            }
          }
        }
      }
    } catch (streamErr) {
      // GraphRecursionError: agent hit recursionLimit — return whatever was accumulated
      const isRecursionError =
        streamErr instanceof Error &&
        (streamErr.message.includes("recursion") ||
          streamErr.message.includes("Recursion") ||
          streamErr.constructor.name === "GraphRecursionError");

      if (!isRecursionError) throw streamErr;
      // Fall through with whatever thoughts/result were accumulated before the limit
    }

    return { thoughts, result: finalResult, visualization };
  } finally {
    await client.close();
  }
}
