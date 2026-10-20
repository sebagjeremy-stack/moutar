import { resolve } from 'node:path';
import dotenv from 'dotenv';

/** Environnement des tests unitaires : le .env de la racine s'il existe, puis des valeurs de test pour ce qui manque. */
dotenv.config({ path: resolve(__dirname, '../../../../.env') });
process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgres://test@127.0.0.1:5433/test_sans_base';
