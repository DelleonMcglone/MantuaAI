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

const ANALYTICS_SYSTEM_PROMPT = `You are an onchain analytics agent for Mantua.AI,
a DeFi platform on Base Sepolia. You have direct access to Dune Analytics via MCP tools.

YOUR CAPABILITIES:
- searchTables: Find the right Dune tables for any protocol or chain
- listBlockchains: Show available chains (always include Base Sepolia: chain_id = 84532)
- searchTablesByContractAddress: Find decoded events for a specific contract
- createDuneQuery: Write and save SQL queries for onchain data
- executeQueryById: Run a saved query and get an execution ID
- getExecutionResults: Fetch results from an execution (poll until complete)
- generateVisualization: Turn query results into charts the UI can render
- getDuneQuery / updateDuneQuery: Manage existing queries
- getUsage: Check API credit consumption
- searchDocs: Look up Dune documentation

MANTUA-SPECIFIC CONTEXT:
- Primary chain: Base Sepolia (chainId: 84532)
- Tokens: ETH (native), USDC, cbBTC, EURC
- Stable pair: USDC/EURC — uses Stable Protection Hook
- PoolManager: 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408
- PoolSwapTest: 0x8b5bcc363dde2614281ad875bad385e0a785d3b9
- PoolModifyLiquidityTest: 0x37429cd17cb1454c34e7f50b09725202fd533039

WORKFLOW FOR DATA QUERIES:
1. Use searchTables or searchTablesByContractAddress to find the right table
2. Create or reference an existing query with appropriate SQL
3. Execute the query with executeQueryById
4. Poll getExecutionResults until state = "QUERY_STATE_COMPLETED"
5. Call generateVisualization with the results
6. Return a clear summary with key insights highlighted

IMPORTANT:
- Always confirm what data you are fetching before executing queries
- Surface key insights (peak values, trends, anomalies) in your response
- Keep SQL queries focused — SELECT only needed columns with LIMIT clauses
- If a query takes >30 seconds, inform the user it is still running`;

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

    // Build a Zod schema from the MCP JSON Schema input definition.
    // Use z.record(z.unknown()) as a permissive catch-all so that any tool
    // argument shape is accepted without needing to hand-code every schema.
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
              .map((c) => (typeof c === "object" && c !== null && "text" in c ? (c as { text: string }).text : JSON.stringify(c)))
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
    const tools = await buildLangChainTools(client);

    const llm = new ChatAnthropic({
      model: "claude-sonnet-4-5-20251001",
      temperature: 0,
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const agent = createReactAgent({
      llm,
      tools,
      messageModifier: ANALYTICS_SYSTEM_PROMPT,
    });

    const thoughts: string[] = [];
    let finalResult = "";
    let visualization: VisualizationData | undefined;

    const stream = await agent.stream(
      { messages: [new HumanMessage(userMessage)] },
      { streamMode: "values" }
    );

    for await (const chunk of stream) {
      for (const msg of (chunk.messages ?? []) as Array<{ _getType(): string; content: unknown; name?: string }>) {
        if (msg._getType() === "ai") {
          const text = typeof msg.content === "string"
            ? msg.content.trim()
            : Array.isArray(msg.content)
              ? msg.content.map((c: unknown) => (typeof c === "object" && c !== null && "text" in c ? (c as { text: string }).text : "")).join("").trim()
              : "";
          if (text) {
            thoughts.push(text);
            finalResult = text;
          }
        }

        // Extract visualization from generateVisualization tool response
        if (msg._getType() === "tool" && msg.name === "generateVisualization") {
          try {
            const raw = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
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

    return { thoughts, result: finalResult, visualization };
  } finally {
    await client.close();
  }
}
