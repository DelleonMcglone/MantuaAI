// Migration runner: executes SQL migration files against the connected database.
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import pkg from "pg";
const { Pool } = pkg;

const __dirname = dirname(fileURLToPath(import.meta.url));

const MIGRATIONS = ['001_chat_schema.sql', '002_analytics_events.sql', '003_pools_portfolio.sql', '004_positions_lp.sql'];

export async function runMigrations(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    for (const file of MIGRATIONS) {
      const sql = readFileSync(join(__dirname, 'migrations', file), 'utf8');
      await pool.query(sql);
      console.log(`[migrate] Applied: ${file}`);
    }
  } catch (err) {
    console.error("[migrate] Migration failed:", err);
    throw err;
  } finally {
    await pool.end();
  }
}
