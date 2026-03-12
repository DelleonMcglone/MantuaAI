// Chat API routes: userId-based sessions, persisted messages, and AI handler.
import type { Express, NextFunction, Request, Response } from "express";
import { z } from "zod";
import OpenAI from "openai";
import { storage } from "../storage";
import { parseVoiceCommand } from "../../shared/voiceCommandParser";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const DUNE_API_KEY = process.env.DUNE_API_KEY ?? '';
const DUNE_BASE_URL = 'https://api.dune.com/api/v1';

async function fetchDuneResults(queryId: number): Promise<string> {
  try {
    const headers = { 'X-DUNE-API-KEY': DUNE_API_KEY, 'Content-Type': 'application/json' };

    // Execute
    const execRes = await fetch(`${DUNE_BASE_URL}/query/${queryId}/execute`, {
      method: 'POST', headers, body: JSON.stringify({}),
    });
    if (!execRes.ok) return `Dune execute error: ${execRes.status}`;
    const { execution_id } = await execRes.json() as { execution_id: string };

    // Poll
    let state = 'PENDING';
    for (let i = 0; i < 5 && !state.includes('COMPLETED') && !state.includes('FAILED'); i++) {
      await new Promise(r => setTimeout(r, 2000));
      const s = await fetch(`${DUNE_BASE_URL}/execution/${execution_id}/status`, { headers });
      if (s.ok) { state = ((await s.json()) as { state: string }).state; }
    }
    if (!state.includes('COMPLETED')) return `Dune query timed out (state: ${state})`;

    // Results
    const resRes = await fetch(`${DUNE_BASE_URL}/execution/${execution_id}/results?limit=10`, { headers });
    if (!resRes.ok) return `Dune results error: ${resRes.status}`;
    const json = await resRes.json() as { result?: { rows: unknown[] } };
    const rows = json.result?.rows ?? [];
    if (rows.length === 0) return 'No data returned from Dune query.';
    return `Dune query ${queryId} returned ${rows.length} rows:\n${JSON.stringify(rows.slice(0, 5), null, 2)}`;
  } catch (err) {
    return `Failed to fetch Dune data: ${err instanceof Error ? err.message : 'Unknown error'}`;
  }
}

// Curated DeFi query IDs for Dune search fallback (public queries that work on free tier)
const DUNE_CURATED: Array<{ id: number; name: string; keywords: string[] }> = [
  { id: 1252207, name: 'NFT Marketplace Rankings', keywords: ['nft', 'opensea', 'blur', 'marketplace'] },
  { id: 3374572, name: 'DEX Volume Overview', keywords: ['dex', 'volume', 'swap', 'uniswap', 'defi'] },
  { id: 4559580, name: 'Uniswap v4 Base Activity', keywords: ['uniswap', 'v4', 'base', 'pool', 'hook'] },
  { id: 3468667, name: 'ETH Gas Analytics', keywords: ['gas', 'gwei', 'fee', 'eth gas'] },
];

async function searchDune(query: string): Promise<string> {
  const lower = query.toLowerCase();
  const matches = DUNE_CURATED.filter(q => q.keywords.some(kw => lower.includes(kw)));
  if (matches.length > 0) {
    return matches.map(m => `- [${m.id}] ${m.name} → use query_id: ${m.id}`).join('\n');
  }
  return `No pre-configured Dune queries match "${query}". Available topics: NFT marketplaces (1252207), DEX volume (3374572), Uniswap v4 Base (4559580), ETH gas (3468667).`;
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
      description: 'Fetch on-chain analytics data from a Dune Analytics query. Use when the user asks about blockchain data, DeFi metrics, TVL, volume, wallet activity, protocol analytics, gas fees, token transfers, or any on-chain statistics.',
      parameters: {
        type: 'object',
        properties: {
          query_id: {
            type: 'number',
            description: 'The Dune query ID to fetch results from. Use well-known DeFi query IDs.',
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
      description: 'Search Dune Analytics for queries related to a topic. Use to discover relevant on-chain data queries when you don\'t know a specific query ID.',
      parameters: {
        type: 'object',
        properties: {
          search_term: {
            type: 'string',
            description: 'The search term to find relevant Dune queries (e.g. "Uniswap v4 Base", "ETH gas", "USDC transfers")',
          },
        },
        required: ['search_term'],
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
