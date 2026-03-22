/**
 * dune.ts
 * Express routes for Dune Analytics — full CLI integration.
 *
 * Endpoints:
 *   POST /api/dune/query         — Run a curated query by message or queryId
 *   POST /api/dune/run-sql       — Execute arbitrary DuneSQL (like `dune query run-sql`)
 *   GET  /api/dune/tables        — Search for blockchain data tables
 *   GET  /api/dune/blockchains   — List all indexed blockchains
 *   GET  /api/dune/query/:id     — Get query SQL + metadata
 *   POST /api/dune/query/create  — Create a new saved query
 *   PATCH /api/dune/query/:id    — Update an existing query
 *   GET  /api/dune/usage         — Check API credit usage
 *   GET  /api/dune/templates     — List available SQL templates
 *   GET  /api/dune/status        — Check if Dune API is configured
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { duneService } from '../services/duneService';
import {
  matchDuneQuery,
  matchSQLTemplate,
  fillTemplateParams,
  getAllQueries,
  getAllSQLTemplates,
} from '../services/duneQueries';

const router = Router();

// ── Status check ───────────────────────────────────────────────────────────

router.get('/status', (_req: Request, res: Response) => {
  res.json({
    configured: duneService.isConfigured,
    capabilities: [
      'query',
      'run-sql',
      'search-tables',
      'list-blockchains',
      'create-query',
      'get-query',
      'update-query',
      'usage',
    ],
  });
});

// ── Run curated query (original endpoint, enhanced) ────────────────────────

const querySchema = z.object({
  message: z.string().min(1).max(500).optional(),
  queryId: z.number().optional(),
  parameters: z.record(z.string()).optional(),
});

router.post('/query', async (req: Request, res: Response) => {
  try {
    const { message, queryId, parameters } = querySchema.parse(req.body);

    let result;
    let label: string;
    let duneUrl: string;

    if (queryId) {
      label = `Dune Query #${queryId}`;
      duneUrl = `https://dune.com/queries/${queryId}`;
      result = await duneService.executeAndWait(queryId, parameters);
    } else if (message) {
      // 1) Try curated queries first (cached, fastest)
      const matched = matchDuneQuery(message);
      if (matched && matched.id !== 0) {
        label = matched.name;
        duneUrl = `https://dune.com/queries/${matched.id}`;
        result = await duneService.getLatestResults(matched.id);
      } else {
        // 2) Try SQL templates (run-sql, more flexible)
        const template = matchSQLTemplate(message);
        if (template) {
          const sql = fillTemplateParams(template.sql, message);
          label = template.name;
          duneUrl = 'https://dune.com';
          result = await duneService.runSQL(sql);
        } else {
          // 3) No match — return suggestions for both types
          return res.json({
            success: false,
            message: 'Could not match your question to a known query. Try asking about:',
            suggestions: getAllQueries().map(q => ({ id: q.id, name: q.name, description: q.description })),
            sqlTemplates: getAllSQLTemplates().map(t => ({ name: t.name, description: t.description })),
          });
        }
      }
    } else {
      return res.status(400).json({ error: 'Provide message or queryId' });
    }

    const columns = result.metadata?.column_names ?? Object.keys(result.rows[0] ?? {});
    const rowCount = result.metadata?.row_count ?? result.rows.length;

    return res.json({
      success: true,
      data: { rows: result.rows, columns, rowCount, label, duneUrl },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0]?.message ?? 'Invalid request' });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[dune/query]', message);

    if (message.includes('timed out')) {
      return res.status(200).json({
        success: false,
        message: 'Query still running — please try again in a moment (Dune queries can take up to 60s).',
      });
    }

    return res.status(500).json({ error: `Dune query failed: ${message}` });
  }
});

// ── Run arbitrary SQL ──────────────────────────────────────────────────────

const runSQLSchema = z.object({
  sql: z.string().min(1).max(10000),
  parameters: z.record(z.string()).optional(),
  performance: z.enum(['medium', 'large']).optional(),
});

router.post('/run-sql', async (req: Request, res: Response) => {
  try {
    const { sql, parameters, performance } = runSQLSchema.parse(req.body);

    const result = await duneService.runSQL(sql, parameters, performance ?? 'medium');
    const columns = result.metadata?.column_names ?? Object.keys(result.rows[0] ?? {});
    const rowCount = result.metadata?.row_count ?? result.rows.length;

    return res.json({
      success: true,
      data: { rows: result.rows, columns, rowCount, label: 'SQL Query', duneUrl: 'https://dune.com' },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0]?.message ?? 'Invalid request' });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[dune/run-sql]', message);
    return res.status(500).json({ error: `SQL execution failed: ${message}` });
  }
});

// ── Table discovery ────────────────────────────────────────────────────────

router.get('/tables', async (req: Request, res: Response) => {
  try {
    const keyword = (req.query.keyword as string) ?? '';
    const chain = req.query.chain as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

    if (!keyword) {
      return res.status(400).json({ error: 'keyword query parameter is required' });
    }

    const tables = await duneService.searchTables(keyword, { chain, limit });
    return res.json({ success: true, tables });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[dune/tables]', message);
    return res.status(500).json({ error: `Table search failed: ${message}` });
  }
});

// ── Blockchain listing ─────────────────────────────────────────────────────

router.get('/blockchains', async (_req: Request, res: Response) => {
  try {
    const blockchains = await duneService.listBlockchains();
    return res.json({ success: true, blockchains });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[dune/blockchains]', message);
    return res.status(500).json({ error: `Failed to list blockchains: ${message}` });
  }
});

// ── Query management ───────────────────────────────────────────────────────

router.get('/query/:id', async (req: Request, res: Response) => {
  try {
    const queryId = parseInt(req.params.id);
    if (isNaN(queryId)) return res.status(400).json({ error: 'Invalid query ID' });

    const query = await duneService.getQuery(queryId);
    return res.json({ success: true, query });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: `Failed to get query: ${message}` });
  }
});

const createQuerySchema = z.object({
  name: z.string().min(1).max(200),
  sql: z.string().min(1).max(50000),
  description: z.string().max(1000).optional(),
  is_private: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

router.post('/query/create', async (req: Request, res: Response) => {
  try {
    const { name, sql, description, is_private, tags } = createQuerySchema.parse(req.body);
    const query = await duneService.createQuery(name, sql, { description, is_private, tags });
    return res.json({
      success: true,
      query,
      duneUrl: `https://dune.com/queries/${query.query_id}`,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0]?.message ?? 'Invalid request' });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: `Failed to create query: ${message}` });
  }
});

const updateQuerySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  query_sql: z.string().min(1).max(50000).optional(),
  description: z.string().max(1000).optional(),
  tags: z.array(z.string()).optional(),
});

router.patch('/query/:id', async (req: Request, res: Response) => {
  try {
    const queryId = parseInt(req.params.id);
    if (isNaN(queryId)) return res.status(400).json({ error: 'Invalid query ID' });

    const updates = updateQuerySchema.parse(req.body);
    const query = await duneService.updateQuery(queryId, updates);
    return res.json({ success: true, query });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0]?.message ?? 'Invalid request' });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: `Failed to update query: ${message}` });
  }
});

// ── Account usage ──────────────────────────────────────────────────────────

router.get('/usage', async (_req: Request, res: Response) => {
  try {
    const usage = await duneService.getUsage();
    return res.json({ success: true, usage });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: `Failed to get usage: ${message}` });
  }
});

// ── SQL templates listing ──────────────────────────────────────────────────

router.get('/templates', (_req: Request, res: Response) => {
  const templates = getAllSQLTemplates().map(t => ({
    name: t.name,
    description: t.description,
    keywords: t.keywords,
    params: t.params ?? [],
  }));
  const queries = getAllQueries().map(q => ({
    id: q.id,
    name: q.name,
    description: q.description,
  }));
  res.json({ success: true, templates, queries });
});

export default router;
