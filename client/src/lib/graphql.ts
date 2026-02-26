const ENDPOINTS = {
  baseSepolia: import.meta.env.VITE_SUBGRAPH_BASE_SEPOLIA ?? '',
} as const;

export type ChainTarget = 'baseSepolia';

export interface GraphQLResponse<T> {
  data:   T | null;
  errors: { message: string }[] | null;
}

export async function gqlQuery<T>(
  query:     string,
  variables: Record<string, unknown> = {},
  _target:   ChainTarget = 'baseSepolia'
): Promise<{ baseSepolia?: T; merged?: T }> {
  const r1 = await queryEndpoint<T>(ENDPOINTS.baseSepolia, query, variables);
  return {
    baseSepolia: r1 ?? undefined,
    merged:      r1 ?? undefined,
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

