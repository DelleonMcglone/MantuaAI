// Chat API routes: userId-based sessions, persisted messages, and AI handler.
import type { Express, NextFunction, Request, Response } from "express";
import { z } from "zod";
import OpenAI from "openai";
import { storage } from "../storage";
import { parseVoiceCommand } from "../../shared/voiceCommandParser";
import { duneService } from "../services/duneService";
import { matchDuneQuery, matchSQLTemplate, fillTemplateParams, getAllQueries, getAllSQLTemplates } from "../services/duneQueries";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// ── Dune CLI tool handlers (used by AI chat) ──────────────────────────────

async function fetchDuneResults(queryId: number): Promise<string> {
  try {
    const result = await duneService.getLatestResults(queryId);
    const rows = result.rows ?? [];
    if (rows.length === 0) return 'No data returned from Dune query.';
    return `Dune query ${queryId} returned ${result.metadata.row_count} rows:\n${JSON.stringify(rows.slice(0, 10), null, 2)}`;
  } catch (err) {
    return `Failed to fetch Dune data: ${err instanceof Error ? err.message : 'Unknown error'}`;
  }
}

async function searchDune(query: string): Promise<string> {
  // Search curated queries
  const matched = matchDuneQuery(query);
  if (matched) {
    return `Found curated query: [${matched.id}] ${matched.name} — ${matched.description}. Use query_id: ${matched.id}`;
  }

  // Search SQL templates
  const template = matchSQLTemplate(query);
  if (template) {
    return `Found SQL template: "${template.name}" — ${template.description}. This can be run with dune_run_sql.`;
  }

  const all = getAllQueries();
  const templates = getAllSQLTemplates();
  return `No match for "${query}". Available curated queries:\n${all.map(q => `- [${q.id}] ${q.name}`).join('\n')}\n\nSQL templates:\n${templates.map(t => `- ${t.name}: ${t.description}`).join('\n')}`;
}

async function runDuneSQL(sql: string): Promise<string> {
  try {
    const result = await duneService.runSQL(sql);
    const rows = result.rows ?? [];
    if (rows.length === 0) return 'SQL query returned no rows.';
    return `SQL returned ${result.metadata.row_count} rows:\n${JSON.stringify(rows.slice(0, 10), null, 2)}`;
  } catch (err) {
    return `SQL execution failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
  }
}

async function searchDuneTables(keyword: string, chain?: string): Promise<string> {
  try {
    const tables = await duneService.searchTables(keyword, { chain, limit: 10 });
    if (tables.length === 0) return `No tables found for "${keyword}".`;
    return `Found ${tables.length} tables:\n${tables.map(t => `- ${t.full_name}${t.description ? ` — ${t.description}` : ''}`).join('\n')}`;
  } catch (err) {
    return `Table search failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
  }
}

const createSessionSchema = z.object({
  userId: z.string().min(1).max(64),
  title: z.string().max(255).optional(),
});

const createMessageSchema = z.object({
  sessionId: z.string().uuid("sessionId must be a UUID"),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(10000, "Content exceeds 10,000 characters"),
  metadata: z.record(z.unknown()).optional().nullable(),
});

const aiChatSchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().min(1).max(10000),
  chainId: z.number().optional(),
});

export function registerChatRoutes(app: Express): void {
  // GET /api/chat/sessions/:userId — all sessions for a user, newest first
  app.get("/api/chat/sessions/:userId", async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      if (!userId || userId.length > 64) {
        res.status(400).json({ error: "Invalid userId" });
        return;
      }
      const sessions = await storage.getChatSessionsByUserId(userId);
      res.json({
        sessions: sessions.map((s) => ({
          id: s.id,
          title: s.title,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        })),
      });
    } catch {
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  });

  // POST /api/chat/sessions — userId path; falls through to legacy handler if no userId
  app.post(
    "/api/chat/sessions",
    async (req: Request, res: Response, next: NextFunction) => {
      if (!req.body?.userId) {
        return next();
      }
      try {
        const data = createSessionSchema.parse(req.body);
        const session = await storage.createChatSession({
          userId: data.userId,
          title: data.title ?? "New Chat",
        });
        res.json({
          session: {
            id: session.id,
            title: session.title,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
          },
        });
      } catch (err) {
        if (err instanceof z.ZodError) {
          res.status(400).json({ error: err.errors[0]?.message ?? "Invalid request" });
        } else {
          res.status(500).json({ error: "Failed to create session" });
        }
      }
    }
  );

  // GET /api/chat/messages/:sessionId — messages ordered ASC; 404 if session missing
  app.get("/api/chat/messages/:sessionId", async (req: Request, res: Response) => {
    try {
      const session = await storage.getChatSession(req.params.sessionId);
      if (!session) {
        res.status(404).json({ error: "Session not found" });
        return;
      }
      const messages = await storage.getChatMessages(req.params.sessionId);
      res.json({
        messages: messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          metadata: (m as typeof m & { metadata?: unknown }).metadata ?? null,
          createdAt: m.createdAt,
        })),
      });
    } catch {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // POST /api/chat/messages — saves message with optional metadata; 400 on bad input
  app.post(
    "/api/chat/messages",
    async (req: Request, res: Response, next: NextFunction) => {
      // Only handle requests that match our schema (sessionId as UUID + role enum)
      const roleValues = ["user", "assistant", "system"];
      if (!req.body?.role || !roleValues.includes(req.body.role)) {
        return next();
      }
      try {
        const data = createMessageSchema.parse(req.body);
        const session = await storage.getChatSession(data.sessionId);
        if (!session) {
          res.status(404).json({ error: "Session not found" });
          return;
        }
        const message = await storage.createChatMessage({
          sessionId: data.sessionId,
          role: data.role,
          content: data.content,
          metadata: data.metadata ?? null,
        } as Parameters<typeof storage.createChatMessage>[0]);
        await storage.updateChatSessionTimestamp(data.sessionId);
        res.json({
          message: {
            id: message.id,
            sessionId: message.sessionId,
            role: message.role,
            content: message.content,
            metadata: (message as typeof message & { metadata?: unknown }).metadata ?? null,
            createdAt: message.createdAt,
          },
        });
      } catch (err) {
        if (err instanceof z.ZodError) {
          res.status(400).json({ error: err.errors[0]?.message ?? "Invalid request" });
        } else {
          res.status(500).json({ error: "Failed to create message" });
        }
      }
    }
  );

  // PATCH /api/chat/sessions/:id — update session title
  app.patch("/api/chat/sessions/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { title } = req.body;
      if (!title || typeof title !== 'string' || title.length > 255) {
        res.status(400).json({ error: "title must be a non-empty string under 255 chars" });
        return;
      }
      await storage.updateChatSessionTitle(id, title.slice(0, 255));
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to update session title" });
    }
  });

  // POST /api/ai/chat — parse command and generate AI response
  app.post("/api/ai/chat", async (req: Request, res: Response) => {
    try {
      const { sessionId, message, chainId } = aiChatSchema.parse(req.body);
      const parsed = parseVoiceCommand(message);
      const metadata = parsed ? { command: parsed } : undefined;
      const content = await generateResponse(message, parsed, chainId);
      res.json({ content, metadata, sessionId });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: err.errors[0]?.message ?? "Invalid request" });
      } else {
        res.status(500).json({ error: "AI handler failed" });
      }
    }
  });
}

const CHAIN_NAMES: Record<number, string> = {
  84532: 'Base Sepolia',
  1301: 'Unichain Sepolia',
};

function buildSystemPrompt(chainId?: number): string {
  const chainName = chainId ? (CHAIN_NAMES[chainId] ?? 'an EVM testnet') : 'Base Sepolia';
  const isUnichain = chainId === 1301;

  let prompt =
    `You are Mantua, an AI assistant for a DeFi trading platform. ` +
    `The user is currently connected to ${chainName}. ` +
    `Help users with swaps, liquidity positions, portfolio management, and on-chain actions. Be concise and specific. `;

  if (isUnichain) {
    prompt +=
      `\n\nUnichain-specific context:\n` +
      `- Unichain Sepolia (Chain ID 1301) is Uniswap Labs' own L2 chain.\n` +
      `- Use the Uniswap Trading API (https://api-docs.uniswap.org) for swap quotes and routing on Unichain.\n` +
      `- Supported tokens on Unichain Sepolia: ETH (native), USDC (0x31d0220469e10c4E71834a79b1f276d740d3768F), EURC (0x18fB358Bc74054B0c2530C48eF23f8A8D464cb18).\n` +
      `- Uniswap v4 PoolManager on Unichain Sepolia: 0x00b036b58a818b1bc34d502d3fe730db729e62ac\n` +
      `- Block explorer: https://sepolia.uniscan.xyz\n` +
      `- ETH faucet: https://console.optimism.io/faucet\n` +
      `- USDC/EURC faucet: https://faucet.circle.com/`;
  } else {
    prompt +=
      `\n\nBase Sepolia context:\n` +
      `- Supported tokens: ETH, cbBTC (0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf), USDC (0x036CbD53842c5426634e7929541eC2318f3dCF7e), EURC (0x808456652fdb597867f38412077A9182bf77359).\n` +
      `- Uniswap v4 PoolManager on Base Sepolia: 0x05e73354cfdd6745c338b50bcfdfa3aa6fa03408\n` +
      `- Block explorer: https://sepolia.basescan.org\n` +
      `- ETH+token faucet: https://portal.cdp.coinbase.com/products/faucet`;
  }

  return prompt;
}

const DUNE_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'dune_get_query_results',
      description: 'Fetch on-chain analytics data from a saved Dune Analytics query by ID. Use when the user asks about blockchain data, DeFi metrics, TVL, volume, wallet activity, protocol analytics, gas fees, token transfers, or any on-chain statistics.',
      parameters: {
        type: 'object',
        properties: {
          query_id: {
            type: 'number',
            description: 'The Dune query ID to fetch results from. Known IDs: 1252207 (NFT rankings), 3374572 (DEX volume), 4559580 (Uniswap v4 Base), 3468667 (ETH gas).',
          },
        },
        required: ['query_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'dune_search_queries',
      description: 'Search for relevant Dune queries and SQL templates by topic. Use to discover what data is available before querying.',
      parameters: {
        type: 'object',
        properties: {
          search_term: {
            type: 'string',
            description: 'The search term (e.g. "Uniswap v4 Base", "ETH gas", "stablecoin volume", "wallet activity")',
          },
        },
        required: ['search_term'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'dune_run_sql',
      description: 'Execute arbitrary DuneSQL to query blockchain data directly. Use when pre-built queries don\'t cover the user\'s question. Supports all DuneSQL syntax including JOINs, aggregations, and cross-chain queries. Tables include: ethereum.transactions, dex.trades, dex.pools, prices.usd, tokens.transfers, etc.',
      parameters: {
        type: 'object',
        properties: {
          sql: {
            type: 'string',
            description: 'The DuneSQL query to execute. Keep queries efficient with LIMIT and partition filters (e.g. WHERE block_time > NOW() - INTERVAL \'7\' DAY).',
          },
        },
        required: ['sql'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'dune_search_tables',
      description: 'Search for blockchain data tables in Dune by keyword and optionally filter by chain. Use to discover which tables and schemas contain the data you need.',
      parameters: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: 'Table search keyword (e.g. "uniswap", "erc20", "nft", "lending")',
          },
          chain: {
            type: 'string',
            description: 'Optional blockchain filter (e.g. "ethereum", "base", "arbitrum", "polygon")',
          },
        },
        required: ['keyword'],
      },
    },
  },
];

async function generateResponse(
  message: string,
  parsed: ReturnType<typeof parseVoiceCommand>,
  chainId?: number,
): Promise<string> {
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    return fallbackResponse(message, parsed);
  }

  try {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: buildSystemPrompt(chainId) },
      { role: 'user', content: message },
    ];

    // First call — allow AI to use Dune tools if relevant
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      tools: DUNE_TOOLS,
      tool_choice: 'auto',
      max_tokens: 600,
    });

    const choice = completion.choices[0];
    if (!choice) return fallbackResponse(message, parsed);

    // Handle tool calls (Dune lookups)
    if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls?.length) {
      const toolMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        ...messages,
        choice.message,
      ];

      for (const toolCall of choice.message.tool_calls) {
        let toolResult: string;
        const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;

        if (toolCall.function.name === 'dune_get_query_results') {
          toolResult = await fetchDuneResults(args.query_id as number);
        } else if (toolCall.function.name === 'dune_search_queries') {
          toolResult = await searchDune(args.search_term as string);
        } else if (toolCall.function.name === 'dune_run_sql') {
          toolResult = await runDuneSQL(args.sql as string);
        } else if (toolCall.function.name === 'dune_search_tables') {
          toolResult = await searchDuneTables(args.keyword as string, args.chain as string | undefined);
        } else {
          toolResult = 'Unknown tool';
        }

        toolMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResult,
        });
      }

      // Second call — let AI summarise the Dune data
      const finalCompletion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: toolMessages,
        max_tokens: 600,
      });
      return finalCompletion.choices[0]?.message?.content ?? fallbackResponse(message, parsed);
    }

    return choice.message?.content ?? fallbackResponse(message, parsed);
  } catch {
    return fallbackResponse(message, parsed);
  }
}

function fallbackResponse(
  message: string,
  parsed: ReturnType<typeof parseVoiceCommand>
): string {
  if (!parsed) return `I received: "${message}". How can I assist you with DeFi today?`;
  if (parsed.type === "swap") {
    return (
      `Detected swap: ${parsed.amount} ${parsed.fromToken} → ${parsed.toToken}` +
      (parsed.hook ? ` via ${parsed.hook}` : "") +
      `. Opening the swap interface.`
    );
  }
  return (
    `Liquidity ${parsed.action}: ${parsed.token0}/${parsed.token1}` +
    (parsed.hook ? ` with ${parsed.hook}` : "") +
    `. Opening the liquidity interface.`
  );
}
