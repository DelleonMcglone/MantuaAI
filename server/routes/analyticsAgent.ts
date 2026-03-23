/**
 * analyticsAgent.ts
 * POST /api/agent/analytics — Dune MCP analytics agent endpoint.
 *
 * Routes natural-language analytics queries to the LangChain ReAct agent
 * backed by the official Dune MCP server at https://api.dune.com/mcp/v1.
 *
 * Request:  { message: string }
 * Response: { thoughts: string[], result: string, visualization?: VisualizationData }
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { runAnalyticsAgent } from "../services/duneAnalyticsAgent";

const router = Router();

const AnalyticsRequestSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(2000, "Message too long — max 2000 characters"),
});

// POST /api/agent/analytics
router.post("/", async (req: Request, res: Response): Promise<void> => {
  const parsed = AnalyticsRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request",
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  if (!process.env.DUNE_API_KEY) {
    res.status(503).json({
      error: "Analytics service unavailable — DUNE_API_KEY not configured",
    });
    return;
  }

  try {
    const result = await runAnalyticsAgent(parsed.data.message);
    res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Analytics Agent Error]", message);
    res.status(500).json({ error: "Analytics agent failed", details: message });
  }
});

export default router;
