import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;

export interface DbBundle {
  pool: Pool;
  db: Database;
}

/** Le pool PostgreSQL et l'instance Drizzle typée. Requêtes bornées à 30 s ; une connexion coupée n'arrête pas Node. */
export function creerDb(connectionString: string): DbBundle {
  const pool = new Pool({ connectionString, max: 10, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 30_000, statement_timeout: 30_000 });
  pool.on('error', (err) => console.error('Connexion PostgreSQL perdue :', err.message));
  return { pool, db: drizzle(pool, { schema }) };
}
