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

async function generateResponse(
  message: string,
  parsed: ReturnType<typeof parseVoiceCommand>,
  chainId?: number,
): Promise<string> {
  if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: buildSystemPrompt(chainId),
          },
          { role: "user", content: message },
        ],
        max_tokens: 400,
      });
      return completion.choices[0]?.message?.content ?? fallbackResponse(message, parsed);
    } catch {
      return fallbackResponse(message, parsed);
    }
  }
  return fallbackResponse(message, parsed);
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
