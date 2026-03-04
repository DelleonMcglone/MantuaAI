/**
 * dune.ts
 * Express route for Dune Analytics queries.
 *
 * POST /api/dune/query
 *   body: { message?, queryId?, parameters? }
 *   - message: natural language query (matched to curated queries)
 *   - queryId: direct Dune query ID execution
 *   - parameters: optional query parameters
 *
 * Returns:
 *   { success: true, data: { rows, columns, rowCount, label, duneUrl } }
 *   { success: false, message, suggestions? }
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { duneService } from '../services/duneService';
import { matchDuneQuery, getAllQueries } from '../services/duneQueries';

const router = Router();

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
      // Direct query ID — execute fresh
      label = `Dune Query #${queryId}`;
      duneUrl = `https://dune.com/queries/${queryId}`;
      result = await duneService.executeAndWait(queryId, parameters);
    } else if (message) {
      // Natural language — try to match a curated query
      const matched = matchDuneQuery(message);

      if (!matched || matched.id === 0) {
        // No match — return suggestions
        return res.json({
          success: false,
          message: 'Could not match your question to a known query. Try asking about:',
          suggestions: getAllQueries().map(q => ({ id: q.id, name: q.name, description: q.description })),
        });
      }

      label = matched.name;
      duneUrl = `https://dune.com/queries/${matched.id}`;
      // Use cached results for speed; falls back to fresh execution if expired
      result = await duneService.getLatestResults(matched.id);
    } else {
      return res.status(400).json({ error: 'Provide message or queryId' });
    }

    const columns = result.metadata?.column_names ?? Object.keys(result.rows[0] ?? {});
    const rowCount = result.metadata?.row_count ?? result.rows.length;

    return res.json({
      success: true,
      data: {
        rows: result.rows,
        columns,
        rowCount,
        label,
        duneUrl,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0]?.message ?? 'Invalid request' });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[dune/query]', message);

    // User-friendly timeout message
    if (message.includes('timed out')) {
      return res.status(200).json({
        success: false,
        message: 'Query still running — please try again in a moment (Dune queries can take up to 30s).',
      });
    }

    return res.status(500).json({ error: `Dune query failed: ${message}` });
  }
});

export default router;
