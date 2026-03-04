/**
 * duneService.ts
 * Handles all Dune Analytics API interactions.
 * Executes queries, polls for results, and formats output.
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

export class DuneService {
  private apiKey: string;

  constructor() {
    const key = process.env.DUNE_API_KEY || 'gKezRWgqcIZKII5VMDZ5ItBb9SoDGy1G';
    this.apiKey = key;
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

  /**
   * Get cached results for a saved query (fastest path — no re-execution).
   * Falls through to executeAndWait if results are expired.
   */
  async getLatestResults(queryId: number): Promise<DuneResult> {
    try {
      const data = await this.request<{ result?: DuneResult }>(`/query/${queryId}/results`);
      if (data.result?.rows?.length) return data.result;
      // Expired — re-execute
      return this.executeAndWait(queryId);
    } catch {
      // Any error → fall back to fresh execution
      return this.executeAndWait(queryId);
    }
  }

  /**
   * Execute a query and poll until complete (max 30s).
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

    const executionId = execution.execution_id;
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.request<DuneExecutionResponse>(`/execution/${executionId}/status`);

      if (status.state === 'QUERY_STATE_COMPLETED') {
        const res = await this.request<{ result?: DuneResult }>(`/execution/${executionId}/results`);
        return res.result ?? { rows: [], metadata: { column_names: [], column_types: [], row_count: 0 } };
      }

      if (status.state === 'QUERY_STATE_FAILED' || status.state === 'QUERY_STATE_CANCELLED') {
        throw new Error(`Query ${status.state.toLowerCase().replace('query_state_', '')}`);
      }

      await new Promise(r => setTimeout(r, 2000));
    }

    throw new Error(`Query timed out after ${timeoutMs / 1000}s`);
  }
}

export const duneService = new DuneService();
