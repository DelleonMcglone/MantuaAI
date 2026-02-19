/**
 * errorMessages.ts
 * Maps technical errors to user-readable messages.
 * Import and use parseError() before showing any error to the user.
 */

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

  if (msg.includes('insufficient funds') || msg.includes('exceeds balance'))
    return 'Insufficient funds for this transaction.';

  if (msg.includes('network') || msg.includes('fetch') || msg.includes('ECONNREFUSED'))
    return 'Network error. Check your connection and try again.';

  if (msg.includes('execution reverted') || msg.includes('revert'))
    return 'Transaction reverted. The contract rejected this operation.';

  if (msg.includes('gas') || msg.includes('Gas'))
    return 'Transaction failed due to gas estimation. Try again.';

  if (msg.includes('429') || msg.includes('rate limit'))
    return 'Too many requests. Please wait a moment.';

  if (msg.includes('CDP') || msg.includes('cdp'))
    return 'Agent wallet error. Check CDP configuration.';

  if (msg.includes('subgraph') || msg.includes('graphql') || msg.includes('GraphQL'))
    return 'Data fetch failed. The subgraph may be indexing.';

  // Short messages that are likely already readable
  if (msg.length < 80 && !msg.includes('0x') && !msg.includes('TypeError'))
    return msg;

  return 'Something went wrong. Please try again.';
}
