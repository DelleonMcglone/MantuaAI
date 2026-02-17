// Migration runner: executes SQL migration files against the connected database.
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import pkg from "pg";
const { Pool } = pkg;

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function runMigrations(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const sql = readFileSync(
      join(__dirname, "migrations", "001_chat_schema.sql"),
      "utf8"
    );
    await pool.query(sql);
    console.log("[migrate] Chat schema migration applied successfully");
  } catch (err) {
    console.error("[migrate] Migration failed:", err);
    throw err;
  } finally {
    await pool.end();
  }
}
