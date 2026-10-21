import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { chaineMigrations, loadEnv } from '../config/env';
import { hacherMotDePasse } from '../modules/admin/mot-de-passe';
import { creerDb } from './client';
import { compteAdmin } from './schema';

/**
 * Crée le compte d'administration depuis `ADMIN_EMAIL_INITIAL` avec un mot de passe ALÉATOIRE, affiché UNE fois en
 * console et jamais écrit dans un fichier (CLAUDE.md : aucun mot de passe de développement documenté).
 * Relancé sur un compte existant : ne change rien (le mot de passe se change par la console, à venir).
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const email = env.ADMIN_EMAIL_INITIAL?.trim().toLowerCase();
  if (!email) throw new Error('ADMIN_EMAIL_INITIAL est absent du .env.');
  // Une graine se connecte avec le propriétaire (`DATABASE_URL_MIGRATIONS`), jamais avec le rôle applicatif.
  const { pool, db } = creerDb(chaineMigrations(env));
  const [existant] = await db.select({ id: compteAdmin.id }).from(compteAdmin).where(eq(compteAdmin.email, email));
  if (existant) {
    console.log(`Le compte ${email} existe déjà : rien à faire.`);
  } else {
    // 18 octets en base64url : 24 caractères, 144 bits d'entropie.
    const motDePasse = randomBytes(18).toString('base64url');
    await db.insert(compteAdmin).values({ email, nom: 'Administrateur', motDePasseHash: await hacherMotDePasse(motDePasse) });
    console.log(`Compte d'administration créé : ${email}`);
    console.log(`Mot de passe (affiché une seule fois, à conserver dans un gestionnaire de mots de passe) : ${motDePasse}`);
  }
  await pool.end();
}

main().catch((err) => {
  console.error('Échec du seed admin :', err);
  process.exit(1);
});
