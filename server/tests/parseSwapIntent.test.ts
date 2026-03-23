/**
 * parseSwapIntent.test.ts
 * Validates all 50 corpus entries parse correctly, verifies direction
 * detection, amount extraction, and stable hook auto-selection.
 */

import { describe, expect, it } from "vitest";
import { parseSwapIntent } from "../agent/parseSwapIntent";
import { SWAP_INTENT_CORPUS } from "../agent/swapCorpus";

const VALID_TOKENS = ["ETH", "USDC", "cbBTC", "EURC"];

describe("parseSwapIntent — full corpus (50 entries)", () => {
  SWAP_INTENT_CORPUS.forEach((input, i) => {
    it(`entry ${String(i + 1).padStart(2, "0")}: "${input}"`, () => {
      const result = parseSwapIntent(input);
      expect(result).not.toBeNull();
      expect(VALID_TOKENS).toContain(result!.tokenIn);
      expect(VALID_TOKENS).toContain(result!.tokenOut);
      expect(result!.tokenIn).not.toEqual(result!.tokenOut);
    });
  });
});

describe("parseSwapIntent — stable hook entries (44–50)", () => {
  const stableEntries = SWAP_INTENT_CORPUS.slice(43);

  stableEntries.forEach((input) => {
    it(`stable hook: "${input}"`, () => {
      const result = parseSwapIntent(input);
      expect(result).not.toBeNull();
      expect(result!.useStableHook).toBe(true);
      const tokens = new Set([result!.tokenIn, result!.tokenOut]);
      expect(tokens.has("USDC")).toBe(true);
      expect(tokens.has("EURC")).toBe(true);
    });
  });
});

describe("parseSwapIntent — direction detection", () => {
  it("'swap 0.1 ETH for USDC' → tokenIn=ETH, tokenOut=USDC", () => {
    const r = parseSwapIntent("swap 0.1 ETH for USDC");
    expect(r!.tokenIn).toBe("ETH");
    expect(r!.tokenOut).toBe("USDC");
    expect(r!.amountIn).toBe("0.1");
  });

  it("'swap 500 USDC for ETH' → tokenIn=USDC, tokenOut=ETH", () => {
    const r = parseSwapIntent("swap 500 USDC for ETH");
    expect(r!.tokenIn).toBe("USDC");
    expect(r!.tokenOut).toBe("ETH");
    expect(r!.amountIn).toBe("500");
  });

  it("'buy cbBTC with 0.3 ETH' → tokenIn=ETH, tokenOut=cbBTC", () => {
    const r = parseSwapIntent("buy cbBTC with 0.3 ETH");
    expect(r!.tokenIn).toBe("ETH");
    expect(r!.tokenOut).toBe("cbBTC");
    expect(r!.amountIn).toBe("0.3");
  });

  it("'sell 0.005 cbBTC for ETH' → tokenIn=cbBTC, tokenOut=ETH", () => {
    const r = parseSwapIntent("sell 0.005 cbBTC for ETH");
    expect(r!.tokenIn).toBe("cbBTC");
    expect(r!.tokenOut).toBe("ETH");
    expect(r!.amountIn).toBe("0.005");
  });

  it("'exchange EURC to ETH' → tokenIn=EURC, tokenOut=ETH", () => {
    const r = parseSwapIntent("exchange EURC to ETH");
    expect(r!.tokenIn).toBe("EURC");
    expect(r!.tokenOut).toBe("ETH");
  });
});

describe("parseSwapIntent — stable pair implicit detection", () => {
  it("'swap 100 USDC for EURC' auto-detects stable hook", () => {
    const r = parseSwapIntent("swap 100 USDC for EURC");
    expect(r!.useStableHook).toBe(true);
    expect(r!.hookExplicitlyRequested).toBe(false);
  });

  it("'exchange 200 EURC to USDC' auto-detects stable hook", () => {
    const r = parseSwapIntent("exchange 200 EURC to USDC");
    expect(r!.useStableHook).toBe(true);
  });
});

describe("parseSwapIntent — standard pairs do NOT trigger stable hook", () => {
  it("ETH/USDC is NOT a stable pair", () => {
    const r = parseSwapIntent("swap 0.1 ETH for USDC");
    expect(r!.useStableHook).toBe(false);
  });

  it("cbBTC/USDC is NOT a stable pair", () => {
    const r = parseSwapIntent("swap 0.002 cbBTC for USDC");
    expect(r!.useStableHook).toBe(false);
  });

  it("ETH/EURC is NOT a stable pair", () => {
    const r = parseSwapIntent("swap 0.1 ETH for EURC");
    expect(r!.useStableHook).toBe(false);
  });
});

describe("parseSwapIntent — amount extraction", () => {
  it("returns amountIn as positive string (caller negates for exact-input)", () => {
    const r = parseSwapIntent("swap 0.5 ETH for USDC");
    expect(r!.amountIn).toBe("0.5");
    expect(parseFloat(r!.amountIn!)).toBeGreaterThan(0);
  });

  it("returns null amountIn when no amount is specified", () => {
    const r = parseSwapIntent("swap ETH for USDC");
    expect(r!.amountIn).toBeNull();
    expect(r!.confidence).toBe("medium");
  });

  it("sets confidence=high when amount present", () => {
    const r = parseSwapIntent("swap 1 ETH for USDC");
    expect(r!.confidence).toBe("high");
  });
});

describe("parseSwapIntent — edge cases", () => {
  it("returns null for non-swap input", () => {
    expect(parseSwapIntent("what is the ETH price?")).toBeNull();
  });

  it("returns null for single token only", () => {
    expect(parseSwapIntent("I have some USDC")).toBeNull();
  });

  it("returns null for same token both sides", () => {
    expect(parseSwapIntent("swap USDC for USDC")).toBeNull();
  });

  it("handles informal language: 'flip my USDC into ETH'", () => {
    const r = parseSwapIntent("I'd like to flip my USDC into ETH");
    expect(r).not.toBeNull();
    expect(r!.tokenIn).toBe("USDC");
    expect(r!.tokenOut).toBe("ETH");
  });
});
