/**
 * prices.ts
 * REST endpoints for CoinGecko price data.
 *
 * GET  /api/prices              — all 4 token prices in one call
 * GET  /api/prices/:token       — single token price (ETH, USDC, cbBTC, EURC)
 * GET  /api/prices/:token/history?days=7  — price history chart data
 */

import { Router, Request, Response } from "express";
import {
  getAllTokenPrices,
  getTokenPrice,
  getTokenPriceHistory,
  MantuaToken,
  COINGECKO_IDS,
} from "../services/coinGeckoService";

const router = Router();
const VALID_TOKENS = Object.keys(COINGECKO_IDS) as MantuaToken[];

// GET /api/prices — all 4 tokens
router.get("/", async (_req: Request, res: Response) => {
  try {
    const prices = await getAllTokenPrices();
    res.json(prices);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Price fetch failed" });
  }
});

// GET /api/prices/:token — single token (must come before /:token/history)
router.get("/:token", async (req: Request, res: Response) => {
  const token = req.params.token.toUpperCase() as MantuaToken;
  if (!VALID_TOKENS.includes(token)) {
    return res.status(400).json({ error: `Unknown token: ${token}. Valid: ${VALID_TOKENS.join(", ")}` });
  }
  try {
    const price = await getTokenPrice(token);
    res.json(price);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Price fetch failed" });
  }
});

// GET /api/prices/:token/history?days=7
router.get("/:token/history", async (req: Request, res: Response) => {
  const token = req.params.token.toUpperCase() as MantuaToken;
  if (!VALID_TOKENS.includes(token)) {
    return res.status(400).json({ error: `Unknown token: ${token}` });
  }
  const days = parseInt(req.query.days as string) || 7;
  const validDays = [1, 7, 14, 30, 90];
  if (!validDays.includes(days)) {
    return res.status(400).json({ error: `Invalid days. Use: ${validDays.join(", ")}` });
  }
  try {
    const history = await getTokenPriceHistory(token, days as 1 | 7 | 14 | 30 | 90);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "History fetch failed" });
  }
});

export default router;
