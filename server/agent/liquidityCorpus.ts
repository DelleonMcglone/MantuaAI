/**
 * liquidityCorpus.ts
 * Training corpus of 50 natural-language strings a user might type
 * to add liquidity on Mantua.AI. Used for intent parser testing and
 * LangChain prompt engineering.
 *
 * Token universe: ETH, USDC, cbBTC, EURC (Base Sepolia)
 * Stable pairs (USDC/EURC) trigger Stable Protection Hook automatically.
 * Entries 44–50 are explicitly stable-hook-flagged variants.
 */

export const LIQUIDITY_INTENT_CORPUS: readonly string[] = [

  // ── GROUP 1: ETH / USDC (standard pair) ──────────────────────────────────
  /* 01 */ "add liquidity to ETH/USDC pool",
  /* 02 */ "I want to provide liquidity for ETH and USDC",
  /* 03 */ "deposit ETH and USDC into a pool",
  /* 04 */ "supply liquidity ETH USDC",
  /* 05 */ "put 0.5 ETH and 1000 USDC into the pool",
  /* 06 */ "create a position in the ETH-USDC liquidity pool",
  /* 07 */ "LP into ETH/USDC",
  /* 08 */ "become a liquidity provider for ETH and USDC",

  // ── GROUP 2: ETH / cbBTC (standard pair) ─────────────────────────────────
  /* 09 */ "add liquidity to the ETH cbBTC pool",
  /* 10 */ "provide ETH and cbBTC liquidity",
  /* 11 */ "deposit into ETH/cbBTC pool",
  /* 12 */ "I'd like to LP ETH and cbBTC",
  /* 13 */ "supply 0.1 ETH and 0.002 cbBTC to the pool",
  /* 14 */ "open a liquidity position in ETH cbBTC",

  // ── GROUP 3: cbBTC / USDC (standard pair) ────────────────────────────────
  /* 15 */ "add liquidity cbBTC USDC",
  /* 16 */ "provide cbBTC and USDC to a pool",
  /* 17 */ "deposit cbBTC/USDC liquidity",
  /* 18 */ "I want to LP into the cbBTC USDC pair",
  /* 19 */ "create a position with cbBTC and USDC",
  /* 20 */ "supply cbBTC and USDC liquidity on Mantua",

  // ── GROUP 4: cbBTC / EURC (standard pair) ────────────────────────────────
  /* 21 */ "add liquidity to cbBTC/EURC pool",
  /* 22 */ "provide cbBTC and EURC",
  /* 23 */ "I want to deposit into the cbBTC EURC pool",
  /* 24 */ "LP cbBTC/EURC on Mantua",
  /* 25 */ "open a position for cbBTC and EURC",

  // ── GROUP 5: ETH / EURC (standard pair) ──────────────────────────────────
  /* 26 */ "add liquidity to ETH and EURC pool",
  /* 27 */ "provide ETH/EURC liquidity",
  /* 28 */ "I want to LP into ETH EURC",
  /* 29 */ "deposit ETH and EURC into a liquidity pool",
  /* 30 */ "supply ETH EURC on Mantua AI",
  /* 31 */ "create a liquidity position for ETH and EURC",

  // ── GROUP 6: Varied phrasing / amounts / ordering ────────────────────────
  /* 32 */ "add 500 USDC and 0.2 ETH to the pool",
  /* 33 */ "I have 1000 USDC I'd like to provide with ETH",
  /* 34 */ "can you add my ETH and USDC to a Uniswap v4 pool?",
  /* 35 */ "stake ETH and cbBTC in a pool",
  /* 36 */ "put some cbBTC USDC liquidity in",
  /* 37 */ "open LP position USDC ETH",
  /* 38 */ "drop 0.01 cbBTC and 200 USDC into a pool",
  /* 39 */ "I want to earn fees on my ETH and USDC",
  /* 40 */ "provide liquidity and earn fees with cbBTC and EURC",
  /* 41 */ "add funds to a USDC/cbBTC liquidity pool on Base",
  /* 42 */ "create a new liquidity position with 0.3 ETH and 600 USDC",
  /* 43 */ "put my ETH and EURC to work in a pool",

  // ── GROUP 7: STABLE PROTECTION HOOK — explicit (7 entries) ───────────────
  /* 44 */ "add liquidity to a USDC-EURC pool with stable protection",
  /* 45 */ "add liquidity to EURC-USDC pool, use the stable protection hook",
  /* 46 */ "provide USDC and EURC liquidity with the stable hook enabled",
  /* 47 */ "I want to LP into USDC/EURC using the Stable Protection Hook",
  /* 48 */ "deposit USDC and EURC into a stable-protected pool",
  /* 49 */ "open a EURC/USDC position with peg protection",
  /* 50 */ "add USDC EURC liquidity, activate the circuit breaker hook",

] as const;
