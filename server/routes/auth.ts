/**
 * auth.ts
 * GET  /api/auth/nonce  — returns a one-time nonce for the given wallet
 * POST /api/auth/verify — verifies SIWE message + signature, sets session cookie
 * POST /api/auth/logout — clears session cookie
 */

import { Router, type Request, type Response } from 'express';
import { z }                                    from 'zod';
import { generateNonce, verifySiweMessage, createSession, SESSION_COOKIE } from '../lib/walletAuth';
import { authLimiter }                          from '../lib/rateLimiter';
import { trackEvent }                           from '../lib/analytics';

const router = Router();

router.get('/nonce', authLimiter, (req: Request, res: Response) => {
  const address = req.query.address as string;
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address))
    return res.status(400).json({ error: 'Invalid wallet address.' });
  res.json({ nonce: generateNonce(address) });
});

router.post('/verify', authLimiter, async (req: Request, res: Response) => {
  const schema = z.object({
    message:   z.string().min(1),
    signature: z.string().regex(/^0x[a-fA-F0-9]+$/),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });

  try {
    const address = await verifySiweMessage(parsed.data.message, parsed.data.signature);
    const token   = createSession(address);
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   24 * 60 * 60 * 1000,
    });
    // Track wallet connection after successful verification
    await trackEvent('wallet_connected', { address });
    res.json({ address, authenticated: true });
  } catch (err: any) {
    res.status(401).json({ error: err.message ?? 'Verification failed.' });
  }
});

router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie(SESSION_COOKIE);
  res.json({ success: true });
});

export default router;
