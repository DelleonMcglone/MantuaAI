/**
 * analytics.ts
 * Server-side analytics event tracking.
 * All wallet addresses are hashed (SHA-256) before storage — no PII stored raw.
 *
 * Event types:
 *   wallet_connected  — user connects a wallet
 *   voice_command     — voice command submitted
 *   text_command      — text command submitted
 *   swap_executed     — swap without a hook
 *   swap_with_hook    — swap that used a Uniswap v4 hook
 *   liquidity_added   — LP position opened
 *   bet_placed        — prediction market bet
 *   page_view         — view navigation event
 */

import crypto              from 'crypto';
import { db }              from '../db';
import { analyticsEvents } from '../../shared/schema';

export type EventName =
  | 'wallet_connected'
  | 'voice_command'
  | 'text_command'
  | 'swap_executed'
  | 'swap_with_hook'
  | 'liquidity_added'
  | 'bet_placed'
  | 'page_view';

/** Hash a wallet address for privacy-safe storage (not reversible, not PII). */
export function hashWallet(address: string): string {
  return crypto.createHash('sha256').update(address.toLowerCase()).digest('hex');
}

/** Track an analytics event. Never throws — analytics must not break the app. */
export async function trackEvent(
  event:    EventName,
  options?: {
    address?:    string;
    sessionId?:  string;
    properties?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await db.insert(analyticsEvents).values({
      event,
      walletHash: options?.address ? hashWallet(options.address) : null,
      sessionId:  options?.sessionId  ?? null,
      properties: options?.properties ?? null,
    });
  } catch (err) {
    console.error('[Analytics] Failed to track event:', event, err);
  }
}
