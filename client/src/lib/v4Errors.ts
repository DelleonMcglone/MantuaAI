const V4_ERROR_SELECTORS: Record<string, string> = {
  '0x486aa307': 'Pool has not been initialized. It needs to be created and initialized before trading.',
  '0x3204506f': 'Currency settlement error. Token transfer to PoolManager failed.',
  '0xd13d53d4': 'Pool is already initialized with a price.',
  '0x75383601': 'Invalid caller — only authorized contracts can perform this action.',
  '0xce786962': 'Tick spacing is too large for this pool configuration.',
  '0xf3ede565': 'Tick spacing is too small for this pool configuration.',
  '0x21ccfeb7': 'Currency0 must have a lower address than currency1.',
  '0xd2c8903c': 'Price limit reached — swap cannot continue at this price.',
  '0xce985f28': 'Swap amount cannot be zero.',
  '0x4323a555': 'Invalid sqrtPrice for pool initialization.',
  '0x10b5c5e6': 'Invalid hook response — the hook contract returned unexpected data.',
  '0x01842e3a': 'Unauthorized dynamic fee — fee exceeds allowed maximum.',
  '0x37f264e7': 'Invalid hook address — must match required permission flags.',
};

export function decodeV4Error(errorMessage: string): string | null {
  for (const [selector, message] of Object.entries(V4_ERROR_SELECTORS)) {
    if (errorMessage.includes(selector)) {
      return message;
    }
  }

  if (errorMessage.includes('Unable to decode signature')) {
    const match = errorMessage.match(/0x[a-fA-F0-9]{8}/);
    if (match && V4_ERROR_SELECTORS[match[0]]) {
      return V4_ERROR_SELECTORS[match[0]];
    }
    return 'Contract returned an unknown error. The pool may not be initialized or the parameters are incorrect.';
  }

  return null;
}

export function isPoolNotInitializedError(errorMessage: string): boolean {
  return errorMessage.includes('0x486aa307') ||
    errorMessage.toLowerCase().includes('pool not initialized') ||
    errorMessage.toLowerCase().includes('poolnotinitialized');
}

export function isInvalidSqrtPriceError(errorMessage: string): boolean {
  return errorMessage.includes('0x4323a555');
}

export function isAlreadyInitializedError(errorMessage: string): boolean {
  return errorMessage.includes('0xd13d53d4');
}
