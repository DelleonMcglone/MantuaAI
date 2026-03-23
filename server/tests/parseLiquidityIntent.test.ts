/**
 * parseLiquidityIntent.test.ts
 * Validates all 50 corpus entries parse correctly, and verifies
 * stable hook detection on all 7 explicit stable-hook entries.
 */

import { describe, expect, it } from "vitest";
import { parseLiquidityIntent, LIQUIDITY_INTENT_CORPUS } from "../agent/index";

describe("parseLiquidityIntent — full corpus", () => {
  LIQUIDITY_INTENT_CORPUS.forEach((input, i) => {
    it(`entry ${String(i + 1).padStart(2, "0")}: "${input}"`, () => {
      const result = parseLiquidityIntent(input);
      expect(result).not.toBeNull();
      expect(["ETH", "USDC", "cbBTC", "EURC"]).toContain(result!.tokenA);
      expect(["ETH", "USDC", "cbBTC", "EURC"]).toContain(result!.tokenB);
      expect(result!.tokenA).not.toEqual(result!.tokenB);
    });
  });
});

describe("parseLiquidityIntent — stable hook entries (44–50)", () => {
  const stableEntries = LIQUIDITY_INTENT_CORPUS.slice(43); // indices 43–49

  stableEntries.forEach((input) => {
    it(`stable hook: "${input}"`, () => {
      const result = parseLiquidityIntent(input);
      expect(result).not.toBeNull();
      expect(result!.useStableHook).toBe(true);
      const tokens = new Set([result!.tokenA, result!.tokenB]);
      expect(tokens.has("USDC")).toBe(true);
      expect(tokens.has("EURC")).toBe(true);
    });
  });
});

describe("parseLiquidityIntent — implicit stable pair auto-detection", () => {
  it("USDC/EURC without explicit hook keyword still sets useStableHook", () => {
    const result = parseLiquidityIntent("provide USDC and EURC to a pool");
    expect(result!.useStableHook).toBe(true);
    expect(result!.hookExplicitlyRequested).toBe(false);
  });

  it("EURC/USDC reverse order auto-detects stable hook", () => {
    const result = parseLiquidityIntent("LP into EURC USDC");
    expect(result!.useStableHook).toBe(true);
  });
});

describe("parseLiquidityIntent — standard pairs do NOT trigger stable hook", () => {
  it("ETH/USDC is NOT a stable pair", () => {
    const result = parseLiquidityIntent("add liquidity to ETH/USDC pool");
    expect(result!.useStableHook).toBe(false);
  });

  it("cbBTC/USDC is NOT a stable pair", () => {
    const result = parseLiquidityIntent("provide cbBTC and USDC to a pool");
    expect(result!.useStableHook).toBe(false);
  });
});

describe("parseLiquidityIntent — amount extraction", () => {
  it("extracts amounts from '0.5 ETH and 1000 USDC'", () => {
    const result = parseLiquidityIntent("put 0.5 ETH and 1000 USDC into the pool");
    expect(result!.amountA).toBe("0.5");
    expect(result!.amountB).toBe("1000");
    expect(result!.confidence).toBe("high");
  });

  it("returns null amounts when not specified", () => {
    const result = parseLiquidityIntent("add liquidity to ETH cbBTC pool");
    expect(result!.amountA).toBeNull();
    expect(result!.amountB).toBeNull();
    expect(result!.confidence).toBe("medium");
  });
});

describe("parseLiquidityIntent — edge cases", () => {
  it("returns null for non-liquidity intent", () => {
    expect(parseLiquidityIntent("what is the ETH price?")).toBeNull();
  });

  it("returns null for single token only", () => {
    expect(parseLiquidityIntent("add USDC to pool")).toBeNull();
  });
});
