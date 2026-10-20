import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Le .env vit à la racine du monorepo.
dotenv.config({ path: resolve(process.cwd(), '../../.env') });

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema/index.ts',
  out: './src/database/migrations',
  dbCredentials: { url: process.env.DATABASE_URL as string },
  verbose: true,
  strict: true,
});
