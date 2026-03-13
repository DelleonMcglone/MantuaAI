/**
 * duneService.ts
 * Full Dune Analytics integration — mirrors the Dune CLI capabilities.
 *
 * Capabilities (matching Dune CLI & MCP tools):
 *   - executeAndWait()     — run saved queries by ID
 *   - runSQL()             — execute arbitrary DuneSQL (like `dune query run-sql`)
 *   - searchTables()       — discover tables by keyword/chain/protocol
 *   - listBlockchains()    — list all indexed blockchains
 *   - createQuery()        — save a new Dune query
 *   - getQuery()           — fetch query SQL + metadata
 *   - updateQuery()        — modify existing query
 *   - getUsage()           — check API credit usage
 *
 * Authentication:
 *   Uses DUNE_API_KEY env var (header: x-dune-api-key).
 *   Get a key at https://dune.com/settings/api
 */

const DUNE_API_BASE = 'https://api.dune.com/api/v1';

export interface DuneRow extends Record<string, unknown> {}

export interface DuneResult {
  rows: DuneRow[];
  metadata: {
    column_names: string[];
    column_types: string[];
    row_count: number;
  };
}

interface DuneExecutionResponse {
  execution_id: string;
  state: string;
  result?: DuneResult;
}

export interface DuneTableResult {
  full_name: string;
  schema: string;
  name: string;
  description?: string;
  column_count?: number;
}

export interface DuneBlockchain {
  chain_name: string;
  table_count: number;
}

export interface DuneQueryInfo {
  query_id: number;
  name: string;
  description?: string;
  query_sql: string;
  parameters?: Array<{ key: string; type: string; value: string }>;
  tags?: string[];
  is_private: boolean;
  created_at: string;
  updated_at: string;
}

export interface DuneUsage {
  credits_used: number;
  credits_remaining: number;
  billing_period_start: string;
  billing_period_end: string;
}

const EMPTY_RESULT: DuneResult = {
  rows: [],
  metadata: { column_names: [], column_types: [], row_count: 0 },
};

export class DuneService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.DUNE_API_KEY ?? '';
  }

  get isConfigured(): boolean {
    return this.apiKey.length > 0 && this.apiKey !== 'your_dune_key_here';
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${DUNE_API_BASE}${path}`, {
      ...options,
      headers: {
        'x-dune-api-key': this.apiKey,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Dune API error (${response.status}): ${error}`);
    }
    return response.json() as Promise<T>;
  }

  // ── Query execution ──────────────────────────────────────────────────────

  /**
   * Get cached results for a saved query (fastest path — no re-execution).
   * Falls through to executeAndWait if results are expired.
   */
  async getLatestResults(queryId: number): Promise<DuneResult> {
    try {
      const data = await this.request<{ result?: DuneResult }>(`/query/${queryId}/results`);
      if (data.result?.rows?.length) return data.result;
      return this.executeAndWait(queryId);
    } catch {
      return this.executeAndWait(queryId);
    }
  }

  /**
   * Execute a saved query and poll until complete (max 30s).
   */
  async executeAndWait(
    queryId: number,
    parameters?: Record<string, string>,
    timeoutMs = 30000,
  ): Promise<DuneResult> {
    const execution = await this.request<DuneExecutionResponse>(`/query/${queryId}/execute`, {
      method: 'POST',
      body: JSON.stringify({ query_parameters: parameters ?? {} }),
    });

    return this.pollExecution(execution.execution_id, timeoutMs);
  }

  /**
   * Execute arbitrary DuneSQL — equivalent to `dune query run-sql`.
   * Creates a private query, executes it, and returns results.
   */
  async runSQL(
    sql: string,
    parameters?: Record<string, string>,
    performance: 'medium' | 'large' = 'medium',
    timeoutMs = 60000,
  ): Promise<DuneResult> {
    // The Dune API v1 "run SQL" endpoint: POST /query/execute/sql
    // This creates an ephemeral query and executes it in one step.
    // If that endpoint isn't available on the user's plan, fall back to
    // create-then-execute workflow.
    try {
      const execution = await this.request<DuneExecutionResponse>('/query/execute/sql', {
        method: 'POST',
        body: JSON.stringify({
          query_sql: sql,
          query_parameters: parameters ?? {},
          performance,
        }),
      });
      return this.pollExecution(execution.execution_id, timeoutMs);
    } catch (err: any) {
      // If the direct SQL endpoint isn't available, fall back to create → execute
      if (err.message?.includes('404') || err.message?.includes('not found')) {
        const query = await this.createQuery(
          `Mantua auto-query ${Date.now()}`,
          sql,
          { is_private: true },
        );
        return this.executeAndWait(query.query_id, parameters, timeoutMs);
      }
      throw err;
    }
  }

  // ── Polling helper ───────────────────────────────────────────────────────

  private async pollExecution(executionId: string, timeoutMs: number): Promise<DuneResult> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.request<DuneExecutionResponse>(`/execution/${executionId}/status`);

      if (status.state === 'QUERY_STATE_COMPLETED') {
        const res = await this.request<{ result?: DuneResult }>(`/execution/${executionId}/results`);
        return res.result ?? EMPTY_RESULT;
      }

      if (status.state === 'QUERY_STATE_FAILED' || status.state === 'QUERY_STATE_CANCELLED') {
        throw new Error(`Query ${status.state.toLowerCase().replace('query_state_', '')}`);
      }

      await new Promise(r => setTimeout(r, 2000));
    }

    throw new Error(`Query timed out after ${timeoutMs / 1000}s`);
  }

  // ── Table discovery ──────────────────────────────────────────────────────

  /**
   * Search for blockchain data tables by keyword, chain, or protocol.
   * Equivalent to Dune CLI `searchTables` skill.
   */
  async searchTables(
    keyword: string,
    opts?: { chain?: string; limit?: number },
  ): Promise<DuneTableResult[]> {
    const params = new URLSearchParams({ keyword });
    if (opts?.chain) params.set('chain', opts.chain);
    if (opts?.limit) params.set('limit', String(opts.limit));

    const data = await this.request<{ tables?: DuneTableResult[] }>(
      `/meta/tables?${params.toString()}`,
    );
    return data.tables ?? [];
  }

  /**
   * List all indexed blockchains with their table counts.
   * Equivalent to Dune CLI `listBlockchains` skill.
   */
  async listBlockchains(): Promise<DuneBlockchain[]> {
    const data = await this.request<{ blockchains?: DuneBlockchain[] }>('/meta/blockchains');
    return data.blockchains ?? [];
  }

  // ── Query management ─────────────────────────────────────────────────────

  /**
   * Create a new saved Dune query.
   * Equivalent to Dune CLI `createDuneQuery` skill.
   */
  async createQuery(
    name: string,
    sql: string,
    opts?: { description?: string; is_private?: boolean; tags?: string[] },
  ): Promise<DuneQueryInfo> {
    return this.request<DuneQueryInfo>('/query', {
      method: 'POST',
      body: JSON.stringify({
        name,
        query_sql: sql,
        description: opts?.description ?? '',
        is_private: opts?.is_private ?? true,
        tags: opts?.tags ?? [],
      }),
    });
  }

  /**
   * Retrieve a query's SQL and metadata.
   * Equivalent to Dune CLI `getDuneQuery` skill.
   */
  async getQuery(queryId: number): Promise<DuneQueryInfo> {
    return this.request<DuneQueryInfo>(`/query/${queryId}`);
  }

  /**
   * Update an existing query's SQL, name, description, or tags.
   * Equivalent to Dune CLI `updateDuneQuery` skill.
   */
  async updateQuery(
    queryId: number,
    updates: { name?: string; query_sql?: string; description?: string; tags?: string[] },
  ): Promise<DuneQueryInfo> {
    return this.request<DuneQueryInfo>(`/query/${queryId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  // ── Account ──────────────────────────────────────────────────────────────

  /**
   * Check API credit usage for the current billing period.
   * Equivalent to Dune CLI `getUsage` skill.
   */
  async getUsage(): Promise<DuneUsage> {
    return this.request<DuneUsage>('/billing/usage');
  }
}

export const duneService = new DuneService();
