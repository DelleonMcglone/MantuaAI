/**
 * swapCorpus.ts
 * Training corpus of 50 natural-language strings a user might type
 * to execute a swap on Mantua.AI. Used for intent parser testing and
 * LangChain prompt engineering.
 *
 * Token universe: ETH, USDC, cbBTC, EURC (Base Sepolia)
 * Stable pairs (USDC/EURC, EURC/USDC) trigger Stable Protection Hook automatically.
 * Entries 44–50 are explicitly stable-pair or hook-flagged swap variants.
 *
 * Key rule baked into corpus:
 *   - "swap X for Y" = sell X, buy Y (tokenIn = X, tokenOut = Y)
 *   - amountSpecified is always negative in execution (exact-input)
 */

export const SWAP_INTENT_CORPUS: readonly string[] = [

  // ── GROUP 1: ETH → USDC ──────────────────────────────────────────────────
  /* 01 */ "swap 0.1 ETH for USDC",
  /* 02 */ "exchange 0.5 ETH to USDC",
  /* 03 */ "sell 0.25 ETH and buy USDC",
  /* 04 */ "convert my ETH to USDC",
  /* 05 */ "trade 1 ETH for USDC on Mantua",
  /* 06 */ "I want to swap ETH for USDC",
  /* 07 */ "turn 0.05 ETH into USDC",

  // ── GROUP 2: USDC → ETH ──────────────────────────────────────────────────
  /* 08 */ "swap 500 USDC for ETH",
  /* 09 */ "exchange 1000 USDC to ETH",
  /* 10 */ "sell USDC and get ETH",
  /* 11 */ "convert 200 USDC to ETH",
  /* 12 */ "trade my USDC for ETH",
  /* 13 */ "I want to buy ETH with 750 USDC",

  // ── GROUP 3: ETH → cbBTC ─────────────────────────────────────────────────
  /* 14 */ "swap 0.5 ETH for cbBTC",
  /* 15 */ "exchange ETH to cbBTC",
  /* 16 */ "convert 1 ETH to cbBTC",
  /* 17 */ "buy cbBTC with 0.3 ETH",
  /* 18 */ "trade ETH for some cbBTC",

  // ── GROUP 4: cbBTC → ETH ─────────────────────────────────────────────────
  /* 19 */ "swap 0.01 cbBTC for ETH",
  /* 20 */ "exchange cbBTC to ETH",
  /* 21 */ "sell 0.005 cbBTC for ETH",
  /* 22 */ "convert my cbBTC to ETH",

  // ── GROUP 5: USDC → cbBTC ────────────────────────────────────────────────
  /* 23 */ "swap 1000 USDC for cbBTC",
  /* 24 */ "buy cbBTC with USDC",
  /* 25 */ "exchange 500 USDC to cbBTC",
  /* 26 */ "convert USDC to cbBTC",

  // ── GROUP 6: cbBTC → USDC ────────────────────────────────────────────────
  /* 27 */ "swap 0.002 cbBTC for USDC",
  /* 28 */ "sell cbBTC for USDC",
  /* 29 */ "exchange 0.01 cbBTC to USDC",
  /* 30 */ "convert my cbBTC into USDC",

  // ── GROUP 7: ETH → EURC ──────────────────────────────────────────────────
  /* 31 */ "swap 0.1 ETH for EURC",
  /* 32 */ "exchange ETH to EURC",
  /* 33 */ "buy EURC with 0.2 ETH",
  /* 34 */ "convert ETH into EURC",

  // ── GROUP 8: EURC → ETH ──────────────────────────────────────────────────
  /* 35 */ "swap 400 EURC for ETH",
  /* 36 */ "exchange EURC to ETH",
  /* 37 */ "sell 600 EURC for ETH",

  // ── GROUP 9: cbBTC → EURC / EURC → cbBTC ─────────────────────────────────
  /* 38 */ "swap 0.003 cbBTC for EURC",
  /* 39 */ "exchange EURC to cbBTC",
  /* 40 */ "buy cbBTC with 300 EURC",

  // ── GROUP 10: Varied / informal phrasing ─────────────────────────────────
  /* 41 */ "can you swap 0.1 ETH to USDC for me?",
  /* 42 */ "I'd like to flip my USDC into ETH",
  /* 43 */ "dump 0.05 ETH into USDC",

  // ── GROUP 11: STABLE PAIR — USDC ↔ EURC (7 entries) ─────────────────────
  /* 44 */ "swap 100 USDC for EURC",
  /* 45 */ "exchange 200 EURC to USDC",
  /* 46 */ "swap USDC to EURC using the stable protection hook",
  /* 47 */ "convert 500 USDC into EURC with peg protection",
  /* 48 */ "swap EURC for USDC, use the stable hook",
  /* 49 */ "trade 150 USDC for EURC through the stable protection pool",
  /* 50 */ "exchange 250 EURC for USDC, activate the circuit breaker hook",

] as const;
