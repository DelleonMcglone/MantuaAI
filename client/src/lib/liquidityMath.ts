function sqrtBigInt(n: bigint): bigint {
  if (n <= 0n) return 0n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) { x = y; y = (x + n / x) / 2n; }
  return x;
}

export function computeSqrtPriceX96(
  priceToken1PerToken0: number,
  decimals0: number,
  decimals1: number,
): bigint {
  const Q96   = 2n ** 96n;
  const SCALE = 10n ** 18n;
  const priceScaled =
    BigInt(Math.round(priceToken1PerToken0 * 1e9)) *
    (10n ** BigInt(decimals1)) *
    SCALE /
    (10n ** BigInt(decimals0)) /
    10n ** 9n;
  return sqrtBigInt(priceScaled * Q96 * Q96 / SCALE);
}

export function getSqrtRatioAtTick(tick: number): bigint {
  const absTick = BigInt(Math.abs(tick));
  const Q128 = 2n ** 128n;

  let ratio: bigint =
    (absTick & 1n) !== 0n ? 0xfffcb933bd6fad37aa2d162d1a594001n : Q128;

  const factors: Array<[bigint, bigint]> = [
    [2n,      0xfff97272373d413259a46990580e213an],
    [4n,      0xfff2e50f5f656932ef12357cf3c7fdccn],
    [8n,      0xffe5caca7e10e4e61c3624eaa0941cd0n],
    [16n,     0xffcb9843d60f6159c9db58835c926644n],
    [32n,     0xff973b41fa98c081472e6896dfb254c0n],
    [64n,     0xff2ea16466c96a3843ec78b326b52861n],
    [128n,    0xfe5dee046a99a2a811c461f1969c3053n],
    [256n,    0xfcbe86c7900a88aedcffc83b479aa3a4n],
    [512n,    0xf987a7253ac413176f2b074cf7815e54n],
    [1024n,   0xf3392b0822b70005940c7a398e4b70f3n],
    [2048n,   0xe7159475a2c29b7443b29c7fa6e889d9n],
    [4096n,   0xd097f3bdfd2022b8845ad8f792aa5825n],
    [8192n,   0xa9f746462d870fdf8a65dc1f90e061e5n],
    [16384n,  0x70d869a156d2a1b890bb3df62baf32f7n],
    [32768n,  0x31be135f97d08fd981231505542fcfa6n],
    [65536n,  0x9aa508b5b7a84e1c677de54f3e99bc9n],
    [131072n, 0x5d6af8dedb81196699c329225ee604n],
    [262144n, 0x2216e584f5fa1ea926041bedfe98n],
    [524288n, 0x48a170391f7dc42444e8fa2n],
  ];

  for (const [bit, magic] of factors) {
    if ((absTick & bit) !== 0n) ratio = (ratio * magic) >> 128n;
  }

  if (tick > 0) ratio = ((1n << 256n) - 1n) / ratio;

  return (ratio >> 32n) + ((ratio & ((1n << 32n) - 1n)) > 0n ? 1n : 0n);
}
