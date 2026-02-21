/**
 * Shared Voice Command Parser
 * Parses natural language transcripts into structured SwapCommand | LiquidityCommand.
 * Imported by both server (validation) and client (modal preview via @shared alias).
 */
import { normalizeToken, detectHook } from './voiceCommandTypes';
import type { SwapCommand, LiquidityCommand, VaultCommand } from './voiceCommandTypes';

export type { SwapCommand, LiquidityCommand, VaultCommand };
export { normalizeToken } from './voiceCommandTypes';
export type { HookType } from './voiceCommandTypes';

// ── Token extraction ──────────────────────────────────────────────────────
const TOKEN_RE = /\b(m?[A-Z]{2,6})\b/g;

function extractTokens(text: string): string[] {
  const upper = text.replace(/\b(ether|ethereum|bitcoin|tether)\b/gi, (w) => normalizeToken(w));
  return (upper.match(TOKEN_RE) ?? []).map(normalizeToken);
}

// ── Amount parsing ────────────────────────────────────────────────────────
function parseAmount(text: string): string | null {
  const match = /\b(\d+(?:[.,]\d+)?)\b/.exec(text);
  if (!match) return null;
  const num = parseFloat(match[1].replace(',', '.'));
  return isFinite(num) && num > 0 ? match[1].replace(',', '.') : null;
}

// ── Swap parsing ──────────────────────────────────────────────────────────
const SWAP_VERBS = /\b(swap|trade|exchange|convert|buy|sell)\b/i;
const BUY_PAT = /\bbuy\s+([a-z]+)\s+with\s+([\d.,]+)\s+([a-z]+)/i;

export function parseSwapCommand(text: string): SwapCommand | null {
  if (!SWAP_VERBS.test(text)) return null;
  const hook = detectHook(text);
  const buy = BUY_PAT.exec(text);
  if (buy) {
    const amount = buy[2].replace(',', '.');
    if (parseFloat(amount) > 0)
      return { type: 'swap', fromToken: normalizeToken(buy[3]), toToken: normalizeToken(buy[1]), amount, ...(hook ? { hook } : {}) };
  }
  const amount = parseAmount(text);
  if (!amount) return null;
  const cleaned = text.replace(SWAP_VERBS, '').replace(amount, '').replace(/\b(for|to|into|→)\b/gi, ' ');
  const [fromToken, toToken] = extractTokens(cleaned);
  if (!fromToken || !toToken) return null;
  return { type: 'swap', fromToken, toToken, amount, ...(hook ? { hook } : {}) };
}

// ── Liquidity parsing ─────────────────────────────────────────────────────
const REMOVE_RE = /\b(remove|withdraw|take out)\b/i;
const LIQUIDITY_RE = /\bliquidit/i;
const PAIR_RE = /\b(m?[A-Za-z]{2,6})[/\-](m?[A-Za-z]{2,6})\b/;

function extractAmounts(text: string): Array<{ amount: string; token: string }> {
  const res: Array<{ amount: string; token: string }> = [];
  const re = /\b(\d+(?:[.,]\d+)?)\s+(m?[A-Za-z]{2,6})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) res.push({ amount: m[1], token: normalizeToken(m[2]) });
  return res;
}

export function parseLiquidityCommand(text: string): LiquidityCommand | null {
  if (!LIQUIDITY_RE.test(text)) return null;
  const action: 'add' | 'remove' = REMOVE_RE.test(text) ? 'remove' : 'add';
  const hook = detectHook(text);
  const pairMatch = PAIR_RE.exec(text);
  if (pairMatch) {
    const token0 = normalizeToken(pairMatch[1]), token1 = normalizeToken(pairMatch[2]);
    const amounts = extractAmounts(text);
    const a0 = amounts.find(a => a.token === token0), a1 = amounts.find(a => a.token === token1);
    return { type: 'liquidity', action, token0, token1, ...(a0 ? { amount0: a0.amount } : {}), ...(a1 ? { amount1: a1.amount } : {}), ...(hook ? { hook } : {}) };
  }
  const amounts = extractAmounts(text);
  if (amounts.length >= 2)
    return { type: 'liquidity', action, token0: amounts[0].token, token1: amounts[1].token, amount0: amounts[0].amount, amount1: amounts[1].amount, ...(hook ? { hook } : {}) };
  if (amounts.length === 1) {
    const other = extractTokens(text).filter(t => t !== amounts[0].token);
    if (other.length > 0) return { type: 'liquidity', action, token0: amounts[0].token, token1: other[0], amount0: amounts[0].amount, ...(hook ? { hook } : {}) };
  }
  return null;
}

// ── Vault parsing ─────────────────────────────────────────────────────────
const VAULT_VERBS     = /\bvault[s]?\b/i;
const SHOW_VAULTS     = /\b(show|open|view|display)\b.*\bvaults?\b|\bvaults?\b.*\b(tab|page|view)\b/i;
const DEPOSIT_VAULT   = /\bdeposit\b.*\bvault[s]?\b|\bvault[s]?\b.*\bdeposit\b/i;
const WITHDRAW_VAULT  = /\b(withdraw|redeem)\b.*\bvault[s]?\b|\bvault[s]?\b.*\b(withdraw|redeem)\b/i;
const PERF_VAULT      = /\bperformance\b.*\bvault[s]?\b|\bvault[s]?\b.*\bperformance\b/i;
const MY_DEPOSITS     = /\bmy\s+(vault\s+)?deposits?\b/i;
const VAULT_AMOUNT    = /\b(\d+(?:\.\d+)?)\b/;

export function parseVaultCommand(text: string): VaultCommand | null {
  if (!VAULT_VERBS.test(text) && !MY_DEPOSITS.test(text)) return null;
  if (PERF_VAULT.test(text))  return { type: 'vault', action: 'performance' };
  if (MY_DEPOSITS.test(text)) return { type: 'vault', action: 'deposits' };
  if (SHOW_VAULTS.test(text)) return { type: 'vault', action: 'show' };

  if (DEPOSIT_VAULT.test(text)) {
    const amt = VAULT_AMOUNT.exec(text);
    return { type: 'vault', action: 'deposit', amount: amt?.[1] };
  }
  if (WITHDRAW_VAULT.test(text)) {
    const amt = VAULT_AMOUNT.exec(text);
    return { type: 'vault', action: 'withdraw', amount: amt?.[1] };
  }
  if (VAULT_VERBS.test(text)) return { type: 'vault', action: 'show' };
  return null;
}

// ── Unified entry point ───────────────────────────────────────────────────
export function parseVoiceCommand(
  transcript: string,
): SwapCommand | LiquidityCommand | VaultCommand | null {
  const text = transcript.trim();
  if (!text) return null;
  return parseVaultCommand(text) ?? parseLiquidityCommand(text) ?? parseSwapCommand(text);
}
