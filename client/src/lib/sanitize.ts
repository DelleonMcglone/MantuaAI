/**
 * sanitize.ts
 * Sanitizes user-provided strings before API submission or state storage.
 * Strips HTML tags and enforces length limits per input type.
 */

import DOMPurify from 'dompurify';

const LIMITS = {
  chatMessage:     500,
  searchQuery:     200,
  walletAddress:   42,
  transactionNote: 100,
} as const;

type InputType = keyof typeof LIMITS;

/**
 * Strips HTML/script tags and trims to the max length for the given input type.
 */
export function sanitizeInput(raw: string, type: InputType): string {
  if (typeof raw !== 'string') return '';
  const clean = DOMPurify.sanitize(raw, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  return clean.trim().slice(0, LIMITS[type]);
}

/** Validates an Ethereum address format (0x + 40 hex chars). */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/** Validates a transaction hash format (0x + 64 hex chars). */
export function isValidTxHash(hash: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}
