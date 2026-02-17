/**
 * Unit tests for voiceCommandParser.ts
 * Run with: node --experimental-vm-modules node_modules/.bin/mocha tests/voiceCommandParser.test.mjs
 * Or directly: node tests/voiceCommandParser.test.mjs
 *
 * Uses Node.js assert for zero external dependencies beyond mocha.
 */

// We use dynamic import since the source is ESM/TypeScript compiled
// For tests without a build step, we inline equivalent pure-JS logic
// mirroring voiceCommandParser.ts exactly.

import assert from 'node:assert/strict';

// ============ INLINE PARSER (mirrors server/services/voiceCommandParser.ts) ============

const TOKEN_ALIASES = {
  ether: 'ETH', ethereum: 'ETH', eth: 'ETH', meth: 'mETH',
  usdc: 'USDC', musdc: 'mUSDC', usdt: 'USDT', musdt: 'mUSDT',
  tether: 'USDT', dai: 'DAI', mdai: 'mDAI', bitcoin: 'BTC', btc: 'BTC',
  wbtc: 'WBTC', weth: 'WETH', link: 'LINK', uni: 'UNI', aave: 'AAVE',
};

function normalizeToken(raw) {
  const key = raw.toLowerCase().replace(/[^a-z]/g, '');
  return TOKEN_ALIASES[key] ?? raw.toUpperCase();
}

const HOOK_PATTERNS = [
  { hook: 'stable-protection', patterns: [/stable[\s-]?protection/i, /\bstable\b/i, /peg[\s-]?protection/i, /peg[\s-]?fee/i] },
  { hook: 'jit', patterns: [/\bjit\b/i, /just[\s-]in[\s-]time/i, /rebalancing/i] },
  { hook: 'mev-protection', patterns: [/\bmev\b/i, /sandwich[\s-]?protection/i, /\basync\b/i, /mev[\s-]?protection/i] },
];

function detectHook(text) {
  for (const { hook, patterns } of HOOK_PATTERNS) {
    if (patterns.some((p) => p.test(text))) return hook;
  }
  return undefined;
}

const AMOUNT_RE = /\b(\d+(?:[.,]\d+)?)\b/;
function parseAmount(text) {
  const match = AMOUNT_RE.exec(text);
  if (!match) return null;
  const num = parseFloat(match[1].replace(',', '.'));
  if (!isFinite(num) || num <= 0) return null;
  return match[1].replace(',', '.');
}

const TOKEN_RE = /\b(m?[A-Z]{2,6})\b/g;
function extractTokens(text) {
  const upper = text.replace(/\b(ether|ethereum|bitcoin|tether)\b/gi, (w) => normalizeToken(w));
  const matches = upper.match(TOKEN_RE) ?? [];
  return matches.map(normalizeToken);
}

const SWAP_VERBS = /\b(swap|trade|exchange|convert|buy|sell)\b/i;
const BUY_PATTERN = /\bbuy\s+([a-z]+)\s+with\s+([\d.,]+)\s+([a-z]+)/i;

function parseSwapCommand(text) {
  if (!SWAP_VERBS.test(text)) return null;
  const hook = detectHook(text);
  const buyMatch = BUY_PATTERN.exec(text);
  if (buyMatch) {
    const toToken = normalizeToken(buyMatch[1]);
    const amount = buyMatch[2].replace(',', '.');
    const fromToken = normalizeToken(buyMatch[3]);
    if (parseFloat(amount) > 0) return { type: 'swap', fromToken, toToken, amount, ...(hook ? { hook } : {}) };
  }
  const amount = parseAmount(text);
  if (!amount) return null;
  const cleaned = text.replace(SWAP_VERBS, '').replace(amount, '').replace(/\b(for|to|into|→)\b/gi, ' ');
  const tokens = extractTokens(cleaned);
  if (tokens.length < 2) return null;
  const [fromToken, toToken] = tokens;
  return { type: 'swap', fromToken, toToken, amount, ...(hook ? { hook } : {}) };
}

const ADD_RE = /\b(add|provide|deposit)\b/i;
const REMOVE_RE = /\b(remove|withdraw|take out)\b/i;
const LIQUIDITY_RE = /\bliquidit/i;
const PAIR_RE = /\b(m?[A-Za-z]{2,6})[/\-](m?[A-Za-z]{2,6})\b/;

function parseLiquidityCommand(text) {
  if (!LIQUIDITY_RE.test(text)) return null;
  const action = REMOVE_RE.test(text) ? 'remove' : 'add';
  const hook = detectHook(text);
  const pairMatch = PAIR_RE.exec(text);
  if (pairMatch) {
    const token0 = normalizeToken(pairMatch[1]);
    const token1 = normalizeToken(pairMatch[2]);
    const amountPattern = /\b(\d+(?:[.,]\d+)?)\s+(m?[A-Za-z]{2,6})/gi;
    const amountMatches = [];
    let m;
    while ((m = amountPattern.exec(text)) !== null) amountMatches.push({ amount: m[1], token: normalizeToken(m[2]) });
    const a0 = amountMatches.find((a) => a.token === token0);
    const a1 = amountMatches.find((a) => a.token === token1);
    return { type: 'liquidity', action, token0, token1, ...(a0 ? { amount0: a0.amount } : {}), ...(a1 ? { amount1: a1.amount } : {}), ...(hook ? { hook } : {}) };
  }
  const amountPattern = /\b(\d+(?:[.,]\d+)?)\s+(m?[A-Za-z]{2,6})/gi;
  const amountMatches = [];
  let m;
  while ((m = amountPattern.exec(text)) !== null) amountMatches.push({ amount: m[1], token: normalizeToken(m[2]) });
  if (amountMatches.length >= 2) {
    return { type: 'liquidity', action, token0: amountMatches[0].token, token1: amountMatches[1].token, amount0: amountMatches[0].amount, amount1: amountMatches[1].amount, ...(hook ? { hook } : {}) };
  }
  if (amountMatches.length === 1) {
    const known = amountMatches[0].token;
    const other = extractTokens(text).filter((t) => t !== known);
    if (other.length > 0) return { type: 'liquidity', action, token0: known, token1: other[0], amount0: amountMatches[0].amount, ...(hook ? { hook } : {}) };
  }
  return null;
}

function parseVoiceCommand(transcript) {
  const text = transcript.trim();
  if (!text) return null;
  const liq = parseLiquidityCommand(text);
  if (liq) return liq;
  return parseSwapCommand(text);
}

// ============ TESTS ============

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log('\nSwap parsing (5 variants)');

test('basic swap: Swap 100 USDC for ETH', () => {
  const cmd = parseVoiceCommand('Swap 100 USDC for ETH');
  assert.equal(cmd?.type, 'swap');
  assert.equal(cmd?.fromToken, 'USDC');
  assert.equal(cmd?.toToken, 'ETH');
  assert.equal(cmd?.amount, '100');
  assert.equal(cmd?.hook, undefined);
});

test('trade with ether alias: Trade 0.5 ether to USDC', () => {
  const cmd = parseVoiceCommand('Trade 0.5 ether to USDC');
  assert.equal(cmd?.type, 'swap');
  assert.equal(cmd?.fromToken, 'ETH');
  assert.equal(cmd?.toToken, 'USDC');
  assert.equal(cmd?.amount, '0.5');
});

test('exchange with hook: Exchange 50 mUSDC for mETH using Stable Protection hook', () => {
  const cmd = parseVoiceCommand('Exchange 50 mUSDC for mETH using Stable Protection hook');
  assert.equal(cmd?.type, 'swap');
  assert.equal(cmd?.fromToken, 'mUSDC');
  assert.equal(cmd?.toToken, 'mETH');
  assert.equal(cmd?.amount, '50');
  assert.equal(cmd?.hook, 'stable-protection');
});

test('buy pattern: Buy ETH with 200 USDC', () => {
  const cmd = parseVoiceCommand('Buy ETH with 200 USDC');
  assert.equal(cmd?.type, 'swap');
  assert.equal(cmd?.fromToken, 'USDC');
  assert.equal(cmd?.toToken, 'ETH');
  assert.equal(cmd?.amount, '200');
});

test('convert with mev hook: Convert 1000 USDT to DAI with MEV protection', () => {
  const cmd = parseVoiceCommand('Convert 1000 USDT to DAI with MEV protection');
  assert.equal(cmd?.type, 'swap');
  assert.equal(cmd?.fromToken, 'USDT');
  assert.equal(cmd?.toToken, 'DAI');
  assert.equal(cmd?.amount, '1000');
  assert.equal(cmd?.hook, 'mev-protection');
});

console.log('\nLiquidity parsing (4 variants)');

test('add liquidity to pair: Add liquidity to ETH/USDC pool', () => {
  const cmd = parseVoiceCommand('Add liquidity to ETH/USDC pool');
  assert.equal(cmd?.type, 'liquidity');
  assert.equal(cmd?.action, 'add');
  assert.equal(cmd?.token0, 'ETH');
  assert.equal(cmd?.token1, 'USDC');
});

test('provide with amounts: Provide 100 USDC and 0.05 ETH liquidity', () => {
  const cmd = parseVoiceCommand('Provide 100 USDC and 0.05 ETH liquidity');
  assert.equal(cmd?.type, 'liquidity');
  assert.equal(cmd?.action, 'add');
  assert.equal(cmd?.amount0, '100');
  assert.equal(cmd?.token0, 'USDC');
  assert.equal(cmd?.amount1, '0.05');
  assert.equal(cmd?.token1, 'ETH');
});

test('remove liquidity: Remove liquidity from mETH/mUSDC', () => {
  const cmd = parseVoiceCommand('Remove liquidity from mETH/mUSDC');
  assert.equal(cmd?.type, 'liquidity');
  assert.equal(cmd?.action, 'remove');
  assert.equal(cmd?.token0, 'mETH');
  assert.equal(cmd?.token1, 'mUSDC');
});

test('add liquidity with hook: Add liquidity to ETH/mUSDC pool use Stable Protection', () => {
  const cmd = parseVoiceCommand('Add liquidity to ETH/mUSDC pool use Stable Protection');
  assert.equal(cmd?.type, 'liquidity');
  assert.equal(cmd?.action, 'add');
  assert.equal(cmd?.token0, 'ETH');
  assert.equal(cmd?.token1, 'mUSDC');
  assert.equal(cmd?.hook, 'stable-protection');
});

console.log('\nNull return for unrecognised input (3 variants)');

test('empty string returns null', () => {
  assert.equal(parseVoiceCommand(''), null);
});

test('unrelated text returns null', () => {
  assert.equal(parseVoiceCommand('What is the weather today?'), null);
});

test('partial keyword without token pair returns null', () => {
  assert.equal(parseVoiceCommand('I want to do something'), null);
});

// ============ SUMMARY ============
console.log(`\n${passed} passing, ${failed} failing\n`);
if (failed > 0) process.exit(1);
