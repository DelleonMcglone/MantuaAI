/**
 * db/index.ts
 * Shared Drizzle ORM instance for server-side database access.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db   = drizzle({ client: pool });
