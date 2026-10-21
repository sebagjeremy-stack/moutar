import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { chaineMigrations, loadEnv } from '../config/env';
import { creerDb } from '../database/client';
import { compteAdmin, contribution, ligneListe, listeOfficielle, produit, signalement, verdict } from '../database/schema';
import { extraireCodesE } from '../modules/analyse/analyse-composition-regles';
import { hacherMotDePasse } from '../modules/admin/mot-de-passe';
import { normes } from '../modules/produits/produits.service';

/**
 * La graine des tests bout-en-bout (`pnpm --filter @moutar/api db:seed-e2e`), IDEMPOTENTE : elle crée ou REMET
 * - quatre produits fictifs à EAN fixes (un cité par les listes fictives actives, un « non cacher » sur composition,
 *   deux sans ingrédients) — leurs verdicts, contributions et signalements d'une passe précédente sont retirés ;
 * - un compte de console `e2e@exemple.fr` dont le mot de passe vient de `E2E_ADMIN_PASSWORD`, sinon du fichier
 *   `.devstack/e2e/mot-de-passe-admin` (ignoré par git), sinon d'un tirage aléatoire imprimé UNE fois et écrit là —
 *   jamais dans un fichier suivi ;
 * - `.devstack/e2e/graine.json`, lu par les specs (EAN, compte, et s'il faut importer une liste fictive au `setup`).
 * Elle refuse la production. Rien de personnel : des produits fictifs et un compte de test.
 */

export const DOSSIER_E2E = resolve(__dirname, '../../../../.devstack/e2e');
export const EMAIL_ADMIN_E2E = 'e2e@exemple.fr';

/** Les produits de la graine : la marque « Lu » et le libellé « Petit Beurre » sont ceux des listes fictives importées au lot 2. */
export const PRODUITS_E2E = {
  cite: { ean: '3000000000901', nom: 'Petit Beurre', marque: 'Lu', ingredientsTexte: 'Farine de blé 74 %, sucre, beurre, lait écrémé en poudre, émulsifiant : lécithine de soja (E322), sel, poudre à lever.' },
  nonCacher: { ean: '3000000000902', nom: 'Bonbons gélifiés', marque: 'Confiserie Fictive', ingredientsTexte: 'Sirop de glucose, sucre, gélatine, acidifiant : acide citrique, colorant : E120, arômes.' },
  sansIngredients: { ean: '3000000000903', nom: 'Biscuits apéritif', marque: 'Marque Fictive', ingredientsTexte: null },
  ocr: { ean: '3000000000904', nom: 'Pâte à tartiner fictive', marque: 'Marque Fictive', ingredientsTexte: null },
} as const;

export interface GraineE2e {
  adminEmail: string;
  eans: Record<keyof typeof PRODUITS_E2E, string>;
  /** Vrai quand aucune liste officielle active ne cite la marque « Lu » : le `setup` importe alors une liste Consistoire fictive. */
  listeFictiveAImporter: boolean;
}

function motDePasseE2e(): { motDePasse: string; origine: 'env' | 'fichier' | 'genere' } {
  const env = process.env['E2E_ADMIN_PASSWORD']?.trim();
  if (env) return { motDePasse: env, origine: 'env' };
  const fichier = resolve(DOSSIER_E2E, 'mot-de-passe-admin');
  if (existsSync(fichier)) {
    const lu = readFileSync(fichier, 'utf8').trim();
    if (lu) return { motDePasse: lu, origine: 'fichier' };
  }
  const genere = randomBytes(18).toString('base64url');
  mkdirSync(DOSSIER_E2E, { recursive: true });
  writeFileSync(fichier, `${genere}\n`, { mode: 0o600 });
  return { motDePasse: genere, origine: 'genere' };
}

async function main(): Promise<void> {
  const env = loadEnv();
  if (env.NODE_ENV === 'production') throw new Error('La graine e2e refuse la production : des produits fictifs et un compte de test n’y ont pas leur place.');
  const { pool, db } = creerDb(chaineMigrations(env));
  const maintenant = new Date();

  // 1. Les produits : créés ou remis (nom, marque, ingrédients, source manuelle, vivants) ; leurs traces d'une passe d'avant retirées.
  const ids: string[] = [];
  for (const p of Object.values(PRODUITS_E2E)) {
    const additifs = p.ingredientsTexte ? extraireCodesE(p.ingredientsTexte) : [];
    const [l] = await db
      .insert(produit)
      .values({ ean: p.ean, nom: p.nom, marque: p.marque, ...normes(p.nom, p.marque), ingredientsTexte: p.ingredientsTexte, additifs, source: 'manuel', luLe: maintenant })
      .onConflictDoUpdate({
        target: produit.ean,
        set: { nom: p.nom, marque: p.marque, ...normes(p.nom, p.marque), ingredientsTexte: p.ingredientsTexte, additifs, source: 'manuel', imageUrl: null, luLe: maintenant, updatedAt: maintenant, deletedAt: null },
      })
      .returning({ id: produit.id });
    ids.push(l.id);
  }
  await db.update(verdict).set({ deletedAt: maintenant }).where(and(inArray(verdict.produitId, ids), isNull(verdict.deletedAt)));
  await db.update(contribution).set({ deletedAt: maintenant, updatedAt: maintenant }).where(and(inArray(contribution.produitId, ids), isNull(contribution.deletedAt)));
  // Un signalement n'a pas de retrait doux (il se « traite ») : ceux des produits de la graine, et d'eux seuls, sont effacés.
  await db.delete(signalement).where(inArray(signalement.produitId, ids));

  // 2. Le compte de console des tests.
  const { motDePasse, origine } = motDePasseE2e();
  const hash = await hacherMotDePasse(motDePasse);
  await db
    .insert(compteAdmin)
    .values({ email: EMAIL_ADMIN_E2E, nom: 'Compte e2e', motDePasseHash: hash, actif: true })
    .onConflictDoUpdate({ target: compteAdmin.email, set: { motDePasseHash: hash, actif: true, deletedAt: null, nom: 'Compte e2e' } });

  // 3. Les listes actives citent-elles « Lu » ? Sinon le `setup` importera une liste Consistoire fictive.
  const [citation] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(ligneListe)
    .innerJoin(listeOfficielle, eq(ligneListe.listeId, listeOfficielle.id))
    .where(and(eq(listeOfficielle.active, true), isNull(listeOfficielle.deletedAt), isNull(ligneListe.deletedAt), eq(ligneListe.marqueNorm, 'lu')));
  const listeFictiveAImporter = (citation?.n ?? 0) === 0;

  mkdirSync(DOSSIER_E2E, { recursive: true });
  const graine: GraineE2e = {
    adminEmail: EMAIL_ADMIN_E2E,
    eans: { cite: PRODUITS_E2E.cite.ean, nonCacher: PRODUITS_E2E.nonCacher.ean, sansIngredients: PRODUITS_E2E.sansIngredients.ean, ocr: PRODUITS_E2E.ocr.ean },
    listeFictiveAImporter,
  };
  writeFileSync(resolve(DOSSIER_E2E, 'graine.json'), `${JSON.stringify(graine, null, 2)}\n`);

  console.log(`Graine e2e : ${ids.length} produits fictifs remis (EAN ${Object.values(PRODUITS_E2E).map((p) => p.ean).join(', ')}).`);
  console.log(`Compte de console ${EMAIL_ADMIN_E2E} ${origine === 'env' ? '(mot de passe : E2E_ADMIN_PASSWORD)' : origine === 'fichier' ? '(mot de passe relu dans .devstack/e2e/mot-de-passe-admin)' : ''}`);
  if (origine === 'genere') {
    console.log(`Mot de passe de développement, affiché une seule fois et gardé dans .devstack/e2e/mot-de-passe-admin (ignoré par git) : ${motDePasse}`);
  }
  console.log(listeFictiveAImporter ? 'Aucune liste active ne cite « Lu » : le projet `setup` importera une liste Consistoire fictive.' : 'Les listes actives citent « Lu » : rien à importer.');
  await pool.end();
}

main().catch((err) => {
  console.error('Échec de la graine e2e :', err);
  process.exit(1);
});
