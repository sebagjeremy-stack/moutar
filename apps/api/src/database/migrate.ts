import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { loadEnv } from '../config/env';

/** Applique les migrations SQL versionnées de `src/database/migrations`. */
async function main(): Promise<void> {
  const env = loadEnv();
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const migrationsFolder = resolve(__dirname, 'migrations');
  console.log('Application des migrations depuis', migrationsFolder);
  await migrate(drizzle(pool), { migrationsFolder });
  console.log('Migrations appliquées.');
  await pool.end();
}

main().catch((err) => {
  console.error('Échec des migrations :', err);
  process.exit(1);
});
