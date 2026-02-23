import { decodeV4Error } from './v4Errors';

export function parseError(err: unknown): string {
  if (!err) return 'An unknown error occurred.';

  const msg =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
      ? err
      : JSON.stringify(err);

  if (msg.includes('User rejected') || msg.includes('user rejected'))
    return 'Transaction cancelled.';

  const v4Decoded = decodeV4Error(msg);
  if (v4Decoded) return v4Decoded;

  if (msg.includes('insufficient funds') || msg.includes('exceeds balance'))
    return 'Insufficient funds for this transaction.';

  if (msg.includes('network') || msg.includes('fetch') || msg.includes('ECONNREFUSED'))
    return 'Network error. Check your connection and try again.';

  if (msg.includes('not configured') || msg.includes('not deployed'))
    return 'Contract not available on this network. Please switch to Base Sepolia.';

  if (msg.includes('ERC20InsufficientAllowance') || msg.includes('allowance'))
    return 'Token approval needed. Please approve the token first.';

  if (msg.includes('ERC20InsufficientBalance'))
    return 'Insufficient token balance for this operation.';

  if (msg.includes('execution reverted') || msg.includes('revert'))
    return 'Transaction reverted. The pool may not be initialized or parameters are invalid.';

  if (msg.includes('gas') || msg.includes('Gas'))
    return 'Transaction failed due to gas estimation. Try again.';

  if (msg.includes('429') || msg.includes('rate limit'))
    return 'Too many requests. Please wait a moment.';

  if (msg.includes('CDP') || msg.includes('cdp'))
    return 'Agent wallet error. Check CDP configuration.';

  if (msg.includes('subgraph') || msg.includes('graphql') || msg.includes('GraphQL'))
    return 'Data fetch failed. The subgraph may be indexing.';

  if (msg.length < 80 && !msg.includes('0x') && !msg.includes('TypeError'))
    return msg;

  return 'Something went wrong. Please try again.';
}
