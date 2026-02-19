const ENDPOINTS = {
  baseSepolia: import.meta.env.VITE_SUBGRAPH_BASE_SEPOLIA ?? '',
  unichain:    import.meta.env.VITE_SUBGRAPH_UNICHAIN    ?? '',
} as const;

export type ChainTarget = 'baseSepolia' | 'unichain' | 'both';

export interface GraphQLResponse<T> {
  data:   T | null;
  errors: { message: string }[] | null;
}

export async function gqlQuery<T>(
  query:     string,
  variables: Record<string, unknown> = {},
  target:    ChainTarget = 'both'
): Promise<{ baseSepolia?: T; unichain?: T; merged?: T }> {
  const fetch1 = target !== 'unichain'
    ? queryEndpoint<T>(ENDPOINTS.baseSepolia, query, variables)
    : Promise.resolve(null);
  const fetch2 = target !== 'baseSepolia'
    ? queryEndpoint<T>(ENDPOINTS.unichain,    query, variables)
    : Promise.resolve(null);

  const [r1, r2] = await Promise.all([fetch1, fetch2]);

  return {
    baseSepolia: r1 ?? undefined,
    unichain:    r2 ?? undefined,
    merged:      mergeResults(r1, r2),
  };
}

async function queryEndpoint<T>(
  url:       string,
  query:     string,
  variables: Record<string, unknown>
): Promise<T | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ query, variables }),
    });
    const json: GraphQLResponse<T> = await res.json();
    if (json.errors?.length) {
      console.error('[Subgraph] GraphQL errors:', json.errors);
      return null;
    }
    return json.data;
  } catch (err) {
    console.error('[Subgraph] Fetch error:', err);
    return null;
  }
}

function mergeResults<T>(a: T | null, b: T | null): T | undefined {
  if (!a && !b) return undefined;
  if (!a) return b ?? undefined;
  if (!b) return a;

  const merged = { ...a } as Record<string, unknown>;
  for (const key of Object.keys(b as Record<string, unknown>)) {
    const va = (a as Record<string, unknown>)[key];
    const vb = (b as Record<string, unknown>)[key];

    if (Array.isArray(va) && Array.isArray(vb)) {
      merged[key] = [...va, ...vb];
    } else if (typeof va === 'number' && typeof vb === 'number') {
      merged[key] = va + vb;
    } else if (typeof va === 'string' && typeof vb === 'string') {
      const na = parseFloat(va);
      const nb = parseFloat(vb);
      if (!isNaN(na) && !isNaN(nb)) {
        merged[key] = String(na + nb);
      } else {
        merged[key] = va;
      }
    } else if (vb !== undefined) {
      merged[key] = vb;
    }
  }
  return merged as T;
}
