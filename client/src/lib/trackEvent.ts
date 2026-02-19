/**
 * trackEvent.ts
 * Thin client-side wrapper to POST analytics events to /api/analytics/event.
 * Never throws — analytics must not block or break the UI.
 */

export type ClientEventName =
  | 'wallet_connected'
  | 'voice_command'
  | 'text_command'
  | 'swap_executed'
  | 'swap_with_hook'
  | 'liquidity_added'
  | 'bet_placed'
  | 'page_view';

let _sessionId: string | null = null;

function getSessionId(): string {
  if (_sessionId) return _sessionId;
  try {
    const stored = sessionStorage.getItem('mantua_sid');
    if (stored) { _sessionId = stored; return stored; }
    const id = crypto.randomUUID();
    sessionStorage.setItem('mantua_sid', id);
    _sessionId = id;
    return id;
  } catch {
    return 'anon';
  }
}

export function trackEvent(
  event:       ClientEventName,
  address?:    string,
  properties?: Record<string, unknown>
): void {
  const body: Record<string, unknown> = { event, sessionId: getSessionId() };
  if (address)    body.address    = address;
  if (properties) body.properties = properties;

  fetch('/api/analytics/event', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  }).catch(() => {}); // silent — analytics never blocks UX
}
