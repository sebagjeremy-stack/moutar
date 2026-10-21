import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { chaineMigrations, loadEnv } from '../config/env';

/** Applique les migrations SQL versionnées de `src/database/migrations`, avec le rôle PROPRIÉTAIRE (`DATABASE_URL_MIGRATIONS`, docs/deploiement.md). */
async function main(): Promise<void> {
  const env = loadEnv();
  const pool = new Pool({ connectionString: chaineMigrations(env), max: 1 });
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
