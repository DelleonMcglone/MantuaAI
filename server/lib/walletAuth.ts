/**
 * walletAuth.ts
 * SIWE (Sign-In with Ethereum) wallet verification.
 *
 * Flow:
 *   1. Client calls GET /api/auth/nonce?address=0x… → one-time nonce
 *   2. Client signs the nonce with their wallet (wagmi signMessage)
 *   3. Client calls POST /api/auth/verify with { message, signature }
 *   4. Server verifies → issues session token in httpOnly cookie
 *   5. Protected routes check via requireWalletAuth middleware
 */

import { SiweMessage }                    from 'siwe';
import { type Request, type Response, type NextFunction } from 'express';
import crypto                              from 'crypto';

// In-memory stores — swap for Redis in production
const nonces:   Map<string, { nonce: string; expiresAt: number }> = new Map();
const sessions: Map<string, { address: string; expiresAt: number }> = new Map();

const NONCE_TTL_MS   = 5  * 60 * 1000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const SESSION_COOKIE = 'mantua_session';

/** Generate and store a one-time nonce for the given wallet address. */
export function generateNonce(address: string): string {
  const nonce = crypto.randomBytes(16).toString('hex');
  nonces.set(address.toLowerCase(), { nonce, expiresAt: Date.now() + NONCE_TTL_MS });
  return nonce;
}

/** Verify a SIWE message + signature. Returns the verified address or throws. */
export async function verifySiweMessage(message: string, signature: string): Promise<string> {
  const siweMsg = new SiweMessage(message);
  const result  = await siweMsg.verify({ signature });
  if (!result.success) throw new Error('Signature verification failed');

  const address = siweMsg.address.toLowerCase();
  const stored  = nonces.get(address);
  if (!stored)                    throw new Error('Nonce not found. Request a new nonce.');
  if (Date.now() > stored.expiresAt) { nonces.delete(address); throw new Error('Nonce expired.'); }
  if (stored.nonce !== siweMsg.nonce) throw new Error('Nonce mismatch.');

  nonces.delete(address); // Consume nonce immediately to prevent replay attacks
  return address;
}

/** Create a session after successful verification. Returns the session token. */
export function createSession(address: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { address, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

/** Middleware: require a valid wallet session. Attaches req.walletAddress. */
export function requireWalletAuth(req: Request, res: Response, next: NextFunction) {
  const token = (req as any).cookies?.[SESSION_COOKIE];
  if (!token) return res.status(401).json({ error: 'Authentication required.' });

  const session = sessions.get(token);
  if (!session)                    return res.status(401).json({ error: 'Invalid session.' });
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }

  (req as any).walletAddress = session.address;
  next();
}
