import { describe, expect, it } from 'vitest';
import { detectIntent } from '../services/intentRouter';

describe('intentRouter token normalization', () => {
  it('detects cbBTC aliases for add-liquidity intents', () => {
    const intent = detectIntent('add liquidity to an ETH/cb-btc pool');
    expect(intent.type).toBe('add-liquidity');
    expect(intent.fromToken).toBe('ETH');
    expect(intent.toToken).toBe('cbBTC');
  });

  it('detects cbBTC aliases for swap intents', () => {
    const intent = detectIntent('swap 0.2 ETH to CBBTC');
    expect(intent.type).toBe('swap');
    expect(intent.fromToken).toBe('ETH');
    expect(intent.toToken).toBe('cbBTC');
  });
});
