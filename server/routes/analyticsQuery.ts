/**
 * analyticsQuery.ts
 * GET /api/analytics/summary — aggregated metrics for the dashboard.
 * Protected: only callable in development or with ANALYTICS_SECRET header.
 */

import { Router, type Request, type Response } from 'express';
import { db }                                   from '../db';
import { analyticsEvents }                      from '../../shared/schema';
import { sql, gte, and, eq }                    from 'drizzle-orm';

const router = Router();

function requireAnalyticsAccess(req: Request, res: Response, next: Function) {
  if (process.env.NODE_ENV !== 'production') return next();
  const secret = req.headers['x-analytics-secret'];
  if (secret !== process.env.ANALYTICS_SECRET)
    return res.status(403).json({ error: 'Access denied.' });
  next();
}

router.get('/summary', requireAnalyticsAccess, async (req: Request, res: Response) => {
  try {
    const days  = Math.min(parseInt(req.query.days as string) || 30, 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [{ uniqueWallets }] = await db
      .select({ uniqueWallets: sql<number>`count(distinct wallet_hash)` })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.event, 'wallet_connected'), gte(analyticsEvents.createdAt, since)));

    const [{ voiceCount }] = await db
      .select({ voiceCount: sql<number>`count(*)` })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.event, 'voice_command'), gte(analyticsEvents.createdAt, since)));

    const [{ textCount }] = await db
      .select({ textCount: sql<number>`count(*)` })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.event, 'text_command'), gte(analyticsEvents.createdAt, since)));

    const [{ hookSwaps }] = await db
      .select({ hookSwaps: sql<number>`count(*)` })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.event, 'swap_with_hook'), gte(analyticsEvents.createdAt, since)));

    const [{ plainSwaps }] = await db
      .select({ plainSwaps: sql<number>`count(*)` })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.event, 'swap_executed'), gte(analyticsEvents.createdAt, since)));

    const dailyEvents = await db
      .select({
        date:  sql<string>`date(created_at)`,
        event: analyticsEvents.event,
        count: sql<number>`count(*)`,
      })
      .from(analyticsEvents)
      .where(gte(analyticsEvents.createdAt, since))
      .groupBy(sql`date(created_at)`, analyticsEvents.event)
      .orderBy(sql`date(created_at) asc`);

    const totalCommands = +voiceCount + +textCount;
    const totalSwaps    = +hookSwaps  + +plainSwaps;

    res.json({
      period: `${days}d`,
      metrics: {
        uniqueWallets:      +uniqueWallets,
        voiceCommandPct:    totalCommands > 0 ? ((+voiceCount / totalCommands) * 100).toFixed(1) : '0',
        hookAdoptionPct:    totalSwaps    > 0 ? ((+hookSwaps  / totalSwaps)    * 100).toFixed(1) : '0',
        totalVoiceCommands: +voiceCount,
        totalTextCommands:  +textCount,
        totalSwaps,
        hookSwaps:          +hookSwaps,
      },
      dailyEvents,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
