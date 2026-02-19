/**
 * usePositionValue.ts
 * React hook wrapping calculatePositionValue.
 * Returns USD value with loading and error state.
 */
import { useState, useEffect } from 'react';
import {
  calculatePositionValue,
  type PositionValueInput,
  type PositionValue,
} from '@/lib/positionValue';

export function usePositionValue(input: PositionValueInput | null) {
  const [value, setValue]   = useState<PositionValue | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!input) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    calculatePositionValue(input)
      .then(v  => { if (!cancelled) setValue(v); })
      .catch(() => { if (!cancelled) setError('Price unavailable'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [input?.amount0, input?.amount1, input?.token0Symbol, input?.token1Symbol]);

  return { value, loading, error };
}
