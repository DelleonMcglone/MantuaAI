/**
 * analytics.ts
 * POST /api/analytics/event — lightweight event ingestion from the frontend.
 * Only accepts a whitelist of safe event names.
 */

import { Router, type Request, type Response } from 'express';
import { z }                                    from 'zod';
import { trackEvent, type EventName }           from '../lib/analytics';

const router = Router();

const ALLOWED_EVENTS: [EventName, ...EventName[]] = [
  'wallet_connected', 'voice_command', 'text_command',
  'swap_executed', 'swap_with_hook', 'liquidity_added', 'bet_placed', 'page_view',
];

const EventSchema = z.object({
  event:      z.enum(ALLOWED_EVENTS),
  sessionId:  z.string().max(100).optional(),
  properties: z.record(z.unknown()).optional(),
  address:    z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
});

router.post('/event', async (req: Request, res: Response) => {
  const parsed = EventSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: 'Invalid event', details: parsed.error.flatten() });

  await trackEvent(parsed.data.event, {
    address:    parsed.data.address,
    sessionId:  parsed.data.sessionId,
    properties: parsed.data.properties,
  });

  res.json({ ok: true });
});

export default router;
