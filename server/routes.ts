import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import cookieParser from "cookie-parser";
import { storage } from "./storage";
import {
  insertChatSessionSchema,
  insertChatMessageSchema,
  insertUserSchema,
  insertUserPreferencesSchema,
  insertPositionSchema,
  insertAgentActionSchema,
  insertHookEventSchema
} from "../shared/schema";
import { z } from "zod";
import OpenAI, { toFile } from "openai";
import { registerChatRoutes } from "./routes/chat";
import { registerAgentRoutes } from "./routes/agent";
import { generalLimiter, agentLimiter } from "./lib/rateLimiter";
import authRouter          from "./routes/auth";
import analyticsRouter     from "./routes/analytics";
import analyticsQueryRouter from "./routes/analyticsQuery";
import poolsRouter         from "./routes/pools";
import portfolioRouter     from "./routes/portfolio";
import duneRouter          from "./routes/dune";

// ============ VOICE TRANSCRIPTION SETUP ============

const openaiVoice = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// In-memory rate limiter: 10 requests per minute per session
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(sessionId: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(sessionId);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(sessionId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count += 1;
  return true;
}

// Simple multipart/form-data parser for a single binary field
function parseMultipartField(
  body: Buffer,
  boundary: string
): { data: Buffer; contentType: string } | null {
  const boundaryLine = Buffer.from(`--${boundary}`);
  const start = body.indexOf(boundaryLine);
  if (start === -1) return null;

  const headerStart = start + boundaryLine.length + 2; // skip \r\n
  const headerEnd = body.indexOf(Buffer.from('\r\n\r\n'), headerStart);
  if (headerEnd === -1) return null;

  const headerSection = body.slice(headerStart, headerEnd).toString('utf8');
  const ctMatch = /content-type:\s*([^\r\n]+)/i.exec(headerSection);
  const contentType = ctMatch ? ctMatch[1].trim() : 'application/octet-stream';

  const dataStart = headerEnd + 4;
  const nextBoundary = Buffer.from(`\r\n--${boundary}`);
  const dataEnd = body.indexOf(nextBoundary, dataStart);
  if (dataEnd === -1) return null;

  return { data: body.slice(dataStart, dataEnd), contentType };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Cookie parser needed for wallet auth sessions
  app.use(cookieParser());

  // Rate limiting — general /api limit, then stricter /api/agent limit
  app.use('/api', generalLimiter);
  app.use('/api/agent', agentLimiter);

  // Auth and analytics routes
  app.use('/api/auth',      authRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/analytics', analyticsQueryRouter);
  app.use('/api/pools',     poolsRouter);
  app.use('/api/portfolio', portfolioRouter);
  app.use('/api/dune',      duneRouter);

  // Register new userId-based chat routes first (they fall through for legacy requests)
  registerChatRoutes(app);

  // Register AgentKit routes
  registerAgentRoutes(app);

  // ============ USERS ============
  app.post("/api/users", async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);
      const existing = await storage.getUser(data.walletAddress);
      if (existing) {
        res.json(existing);
        return;
      }
      const user = await storage.createUser(data);
      await storage.createUserPreferences({ walletAddress: data.walletAddress });
      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create user" });
      }
    }
  });

  app.get("/api/users/:walletAddress", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.walletAddress);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // ============ USER PREFERENCES ============
  app.get("/api/users/:walletAddress/preferences", async (req, res) => {
    try {
      const prefs = await storage.getUserPreferences(req.params.walletAddress);
      if (!prefs) {
        res.status(404).json({ error: "Preferences not found" });
        return;
      }
      res.json(prefs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch preferences" });
    }
  });

  app.patch("/api/users/:walletAddress/preferences", async (req, res) => {
    try {
      const prefs = await storage.updateUserPreferences(req.params.walletAddress, req.body);
      if (!prefs) {
        res.status(404).json({ error: "Preferences not found" });
        return;
      }
      res.json(prefs);
    } catch (error) {
      res.status(500).json({ error: "Failed to update preferences" });
    }
  });

  // ============ CHAT SESSIONS ============
  app.post("/api/chat/sessions", async (req, res) => {
    try {
      const data = insertChatSessionSchema.parse(req.body);
      const session = await storage.createChatSession(data);
      res.json(session);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create chat session" });
      }
    }
  });

  app.get("/api/chat/sessions", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const walletAddress = req.query.wallet as string | undefined;
      const sessions = await storage.getRecentChatSessions(limit, walletAddress);
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch chat sessions" });
    }
  });

  app.get("/api/chat/sessions/:id", async (req, res) => {
    try {
      const session = await storage.getChatSession(req.params.id);
      if (!session) {
        res.status(404).json({ error: "Session not found" });
        return;
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch chat session" });
    }
  });

  app.delete("/api/chat/sessions/:id", async (req, res) => {
    try {
      await storage.deleteChatSession(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete chat session" });
    }
  });

  // ============ CHAT MESSAGES ============
  app.post("/api/chat/messages", async (req, res) => {
    try {
      const data = insertChatMessageSchema.parse(req.body);
      const message = await storage.createChatMessage(data);
      await storage.updateChatSessionTimestamp(data.sessionId);
      res.json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create message" });
      }
    }
  });

  app.get("/api/chat/messages/:sessionId", async (req, res) => {
    try {
      const messages = await storage.getChatMessages(req.params.sessionId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // ============ VOICE TRANSCRIPTION ============
  // P1-041: POST /api/voice/transcribe
  // Accepts multipart/form-data with field "audio", transcribes via Whisper-1
  app.post(
    "/api/voice/transcribe",
    (req: Request, res: Response, next) => {
      // Collect raw body for multipart parsing
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        (req as Request & { rawBuffer: Buffer }).rawBuffer = Buffer.concat(chunks);
        next();
      });
      req.on('error', () => res.status(500).json({ error: 'Failed to read request body' }));
    },
    async (req: Request, res: Response) => {
      try {
        // Rate limiting: use session cookie or IP as identifier
        const sessionId: string =
          (req.headers['x-session-id'] as string) ||
          (req.socket.remoteAddress ?? 'unknown');
        if (!checkRateLimit(sessionId)) {
          return res.status(429).json({ error: 'Rate limit exceeded. Maximum 10 requests per minute.' });
        }

        // Parse multipart/form-data
        const contentType = req.headers['content-type'] ?? '';
        const boundaryMatch = /boundary=([^\s;]+)/.exec(contentType);
        if (!boundaryMatch) {
          return res.status(400).json({ error: 'Missing multipart boundary in Content-Type' });
        }
        const boundary = boundaryMatch[1];

        const rawBuffer = (req as Request & { rawBuffer: Buffer }).rawBuffer;
        if (!rawBuffer || rawBuffer.length === 0) {
          return res.status(400).json({ error: 'Empty request body' });
        }

        const field = parseMultipartField(rawBuffer, boundary);
        if (!field) {
          return res.status(400).json({ error: 'Could not parse audio field from multipart body' });
        }

        // Validate content type is audio
        if (!field.contentType.startsWith('audio/') && !field.contentType.startsWith('video/webm')) {
          return res.status(400).json({ error: 'Uploaded file must be an audio type' });
        }

        if (field.data.length === 0) {
          return res.status(400).json({ error: 'Audio data is empty' });
        }

        // Determine file extension from MIME type for Whisper
        const ext = field.contentType.includes('ogg') ? 'ogg'
          : field.contentType.includes('mp4') ? 'mp4'
          : field.contentType.includes('mpeg') || field.contentType.includes('mp3') ? 'mp3'
          : 'webm';

        // Pass audio to Whisper in-memory (no disk writes)
        const audioFile = await toFile(field.data, `audio.${ext}`, { type: field.contentType });

        const transcription = await openaiVoice.audio.transcriptions.create({
          model: 'whisper-1',
          file: audioFile,
        });

        if (!transcription.text || transcription.text.trim() === '') {
          return res.status(200).json({ transcript: '' });
        }

        return res.json({ transcript: transcription.text });
      } catch (err: unknown) {
        console.error('[voice/transcribe] Error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        // Check for OpenAI API errors
        if (message.includes('401') || message.includes('invalid_api_key')) {
          return res.status(503).json({ error: 'Transcription service unavailable. Please try again later.' });
        }
        return res.status(500).json({ error: 'Voice transcription failed. Please try again.' });
      }
    }
  );

  // ============ POSITIONS ============
  app.post("/api/positions", async (req, res) => {
    try {
      const data = insertPositionSchema.parse(req.body);
      const position = await storage.createPosition(data);
      res.json(position);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create position" });
      }
    }
  });

  app.get("/api/positions", async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string;
      if (!walletAddress) {
        res.status(400).json({ error: "wallet query parameter required" });
        return;
      }
      const positions = await storage.getPositionsByWallet(walletAddress);
      res.json(positions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch positions" });
    }
  });

  app.get("/api/positions/:id", async (req, res) => {
    try {
      const position = await storage.getPosition(req.params.id);
      if (!position) {
        res.status(404).json({ error: "Position not found" });
        return;
      }
      res.json(position);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch position" });
    }
  });

  app.patch("/api/positions/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      const position = await storage.updatePositionStatus(req.params.id, status);
      if (!position) {
        res.status(404).json({ error: "Position not found" });
        return;
      }
      res.json(position);
    } catch (error) {
      res.status(500).json({ error: "Failed to update position status" });
    }
  });

  // ============ AGENT ACTIONS ============
  app.post("/api/agent-actions", async (req, res) => {
    try {
      const data = insertAgentActionSchema.parse(req.body);
      const action = await storage.createAgentAction(data);
      res.json(action);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create agent action" });
      }
    }
  });

  app.get("/api/agent-actions", async (req, res) => {
    try {
      const walletAddress = req.query.wallet as string;
      const status = req.query.status as string | undefined;
      if (!walletAddress) {
        res.status(400).json({ error: "wallet query parameter required" });
        return;
      }
      const actions = await storage.getAgentActionsByWallet(walletAddress, status);
      res.json(actions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch agent actions" });
    }
  });

  app.get("/api/agent-actions/:id", async (req, res) => {
    try {
      const action = await storage.getAgentAction(req.params.id);
      if (!action) {
        res.status(404).json({ error: "Agent action not found" });
        return;
      }
      res.json(action);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch agent action" });
    }
  });

  app.post("/api/agent-actions/:id/approve", async (req, res) => {
    try {
      const action = await storage.approveAgentAction(req.params.id);
      if (!action) {
        res.status(404).json({ error: "Agent action not found" });
        return;
      }
      res.json(action);
    } catch (error) {
      res.status(500).json({ error: "Failed to approve agent action" });
    }
  });

  app.patch("/api/agent-actions/:id/status", async (req, res) => {
    try {
      const { status, txHash } = req.body;
      const action = await storage.updateAgentActionStatus(req.params.id, status, txHash);
      if (!action) {
        res.status(404).json({ error: "Agent action not found" });
        return;
      }
      res.json(action);
    } catch (error) {
      res.status(500).json({ error: "Failed to update agent action status" });
    }
  });

  // ============ HOOK EVENTS ============
  app.post("/api/hook-events", async (req, res) => {
    try {
      const data = insertHookEventSchema.parse(req.body);
      const event = await storage.createHookEvent(data);
      res.json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create hook event" });
      }
    }
  });

  app.get("/api/hook-events", async (req, res) => {
    try {
      const poolAddress = req.query.pool as string | undefined;
      const hookType = req.query.type as string | undefined;
      
      if (poolAddress) {
        const events = await storage.getHookEventsByPool(poolAddress);
        res.json(events);
        return;
      }
      if (hookType) {
        const events = await storage.getHookEventsByType(hookType);
        res.json(events);
        return;
      }
      res.status(400).json({ error: "pool or type query parameter required" });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch hook events" });
    }
  });

  // ============ ANALYTICS QUERY GENERATION ============
  const analyticsOutputSchema = z.object({
    graphql:     z.string(),
    chartType:   z.enum(['line', 'bar', 'pie', 'table', 'stat']),
    title:       z.string(),
    description: z.string(),
    variables:   z.record(z.string()).optional().default({}),
  });

  const ANALYTICS_SCHEMA_CONTEXT = `You are a GraphQL query generator for the Mantua.AI subgraph.
Available entities: Protocol, Swap, SwapHourData, Pool, Token, Position, Vault, VaultDeposit, VaultDayData, ProtocolDayData.
Return ONLY a JSON object with: graphql (query string), chartType (line|bar|pie|table|stat), title, description, variables (object).`;

  app.post("/api/analytics/generate-query", async (req: Request, res: Response) => {
    try {
      const { message } = req.body;
      if (!message || typeof message !== 'string' || message.length > 500) {
        return res.status(400).json({ error: "message is required (max 500 chars)" });
      }

      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 1000,
        messages: [
          { role: "system", content: ANALYTICS_SCHEMA_CONTEXT },
          { role: "user", content: message },
        ],
      });

      const text = completion.choices?.[0]?.message?.content ?? '';
      const clean = text.replace(/```json|```/g, '').trim();

      let parsed: unknown;
      try {
        parsed = JSON.parse(clean);
      } catch {
        return res.status(422).json({ error: "AI returned invalid JSON" });
      }

      const validated = analyticsOutputSchema.safeParse(parsed);
      if (!validated.success) {
        return res.status(422).json({ error: "AI output did not match expected schema" });
      }

      res.json(validated.data);
    } catch (err) {
      console.error("[analytics] Query generation error:", err);
      res.status(500).json({ error: "Failed to generate analytics query" });
    }
  });

  return httpServer;
}
