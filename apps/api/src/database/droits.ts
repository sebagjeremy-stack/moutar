import { Pool } from 'pg';
import { chaineMigrations, loadEnv } from '../config/env';
import { ROLE_APPLICATIF, assurerRoleApplicatif } from './droits-application';

/**
 * `pnpm --filter @moutar/api db:droits` : crée le rôle applicatif `moutar_app` s'il manque (mot de passe lu dans
 * `MOUTAR_APP_PASSWORD`, jamais écrit) et (re)pose ses droits — idempotent, une transaction. Se connecte avec le
 * PROPRIÉTAIRE (`DATABASE_URL_MIGRATIONS`), après `db:migrate`. En production, le service `migrate` du compose l'enchaîne.
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const pool = new Pool({ connectionString: chaineMigrations(env), max: 1 });
  try {
    const resultat = await assurerRoleApplicatif(pool, ROLE_APPLICATIF, env.MOUTAR_APP_PASSWORD);
    const etat = { cree: 'créé', mis_a_jour: 'mot de passe remis', inchange: 'déjà présent' }[resultat.role];
    console.log(`Rôle applicatif « ${ROLE_APPLICATIF} » : ${etat} ; droits posés sur ${resultat.tables} table(s) et ${resultat.journaux} journal(aux) en ajout seul.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Échec de db:droits :', err instanceof Error ? err.message : err);
  process.exit(1);
});
