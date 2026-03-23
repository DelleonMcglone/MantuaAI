/**
 * duneIntentDetector.ts
 * Detects whether a chat message is an analytics/research query
 * that should be routed to the Dune MCP analytics agent.
 *
 * NOTE: Dune does NOT index testnets. All queries are served from
 * mainnet (Base mainnet, Ethereum mainnet). The backend translates
 * automatically — callers need not handle this.
 */

// ── Trigger patterns ─────────────────────────────────────────────────────────
const ANALYTICS_PATTERNS: RegExp[] = [
  // Chart / visualization requests
  /show\s+(?:me\s+)?(?:a\s+)?chart/i,
  /(?:generate|create|make)\s+(?:a\s+)?(?:chart|graph|visualization|plot)/i,
  /visualize/i,

  // Price / market data
  /price\s+of\s+\w+/i,
  /\w+\s+price\s+(?:over|last|in|for)/i,
  /how\s+much\s+(?:is|was|has)\s+\w+\s+(?:worth|trading)/i,

  // Volume / activity data
  /(?:swap|trading|transaction|tx)\s+volume/i,
  /(?:daily|weekly|monthly|hourly)\s+(?:volume|transactions|swaps|activity)/i,
  /volume\s+(?:on|for|of|in)/i,

  // Pool / liquidity data research (not action)
  /(?:pool|liquidity|tvl)\s+(?:data|stats|metrics|analytics)/i,
  /(?:uniswap|dex)\s+(?:v4|v3)?\s+(?:on|for)?\s+base/i,
  /USDC.*EURC.*(?:pool|liquidity|volume|data)/i,
  /EURC.*USDC.*(?:pool|liquidity|volume|data)/i,
  /uniswap\s+v[34]\s+base/i,

  // Explicit analytics / data requests
  /(?:show|get|find|fetch|query|search)\s+(?:tables?|data|stats|analytics|metrics)/i,
  /(?:last|past)\s+\d+\s+days?/i,
  /over\s+the\s+last\s+\d+\s+days?/i,
  /(?:this|last)\s+(?:week|month|year)/i,
  /dune\s+(?:query|analytics|data)/i,
  /on.?chain\s+(?:data|analytics|stats)/i,

  // Blockchain discovery
  /what\s+(?:blockchains?|chains?)\s+(?:does\s+dune|are\s+indexed)/i,
  /list\s+(?:all\s+)?(?:blockchains?|chains?)/i,

  // Account / usage
  /(?:dune|api)\s+(?:credit|usage|billing)/i,

  // Historical data
  /(?:what\s+was|show|tell me about)\s+(?:the\s+)?(?:price|volume|activity)/i,
  /(?:historical|history)\s+(?:data|price|volume)/i,

  // Table/contract search
  /find\s+(?:decoded\s+)?(?:event\s+)?tables?\s+for/i,
  /search\s+(?:tables?|contracts?)/i,

  // Holders / wallets
  /(?:how\s+many\s+)?(?:unique\s+)?(?:wallets?|holders?|addresses?)\s+(?:have|hold|interacted)/i,

  // Top N queries
  /top\s+\d+\s+(?:tokens?|pools?|traders?|wallets?)/i,
];

// ── Exclusion patterns (action intents, not analytics) ────────────────────────
const EXCLUSION_PATTERNS: RegExp[] = [
  /^swap\s+[\d.]/i,         // "swap 0.1 ETH for USDC"
  /^exchange\s+[\d.]/i,     // "exchange 100 USDC to ETH"
  /^add\s+liquidity/i,      // "add liquidity to ETH/USDC"
  /^provide\s+liquidity/i,  // "provide ETH and USDC"
  /^remove\s+liquidity/i,   // "remove liquidity"
  /^deposit\s+[\d.]/i,      // "deposit 100 USDC"
  /^send\s+[\d.]/i,         // "send 1 ETH to 0x..."
  /^transfer\s+[\d.]/i,     // "transfer 50 USDC to..."
  /^withdraw\s+[\d.]/i,     // "withdraw 50 USDC"
];

export function isDuneAnalyticsQuery(message: string): boolean {
  const trimmed = message.trim();
  if (EXCLUSION_PATTERNS.some((p) => p.test(trimmed))) return false;
  return ANALYTICS_PATTERNS.some((p) => p.test(trimmed));
}
