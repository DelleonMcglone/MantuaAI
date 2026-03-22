import { describe, expect, it } from 'vitest';
import { classifyQuery } from '../utils/queryClassifier';

describe('queryClassifier token normalization', () => {
  it('normalizes cbBTC aliases for add-liquidity prefills', () => {
    const result = classifyQuery('add liquidity to a USDC/cb-btc pool');
    expect(result.type).toBe('addLiquidity');
    expect(result.params?.tokenA).toBe('USDC');
    expect(result.params?.tokenB).toBe('cbBTC');
  });

  it('normalizes cbBTC aliases for swap parsing', () => {
    const result = classifyQuery('swap 0.1 eth to cbbtc');
    expect(result.type).toBe('swap');
    expect(result.params?.fromToken).toBe('ETH');
    expect(result.params?.toToken).toBe('cbBTC');
  });
});
