import { createHash, createHmac, pbkdf2Sync, randomBytes } from 'node:crypto';
import type { Pool } from 'pg';

/**
 * Le rôle applicatif de la base (20/10/2026, préparation de la mise en ligne — reste bloquant de `console-admin.md`).
 *
 * Jusque-là l'API tournait avec le PROPRIÉTAIRE de la base (`moutar`, superutilisateur du cluster de développement) :
 * l'ajout seul des journaux ne tenait qu'aux déclencheurs, qu'un tel rôle peut retirer. Désormais :
 *
 * - le propriétaire (`moutar`) ne sert qu'aux MIGRATIONS, aux graines et à ce script (`DATABASE_URL_MIGRATIONS`) ;
 * - l'API se connecte avec `moutar_app` (`DATABASE_URL`), qui lit et écrit les tables, mais ne peut sur un JOURNAL
 *   (`journal_admin`, `journal_ia`, tout `journal_*` futur) qu'ajouter et lire — jamais modifier, effacer ni vider —,
 *   ne crée rien dans le schéma, et ne voit pas la table des migrations.
 *
 * Le rôle et ses droits se posent par `pnpm --filter @moutar/api db:droits` (`droits.ts`), après les migrations, de façon
 * idempotente et dans UNE transaction : une table nouvelle reçoit ses droits à la passe suivante (et d'office par les
 * privilèges par défaut), un journal nouveau est protégé par son seul nom. Les sauvegardes se font sans les ACL
 * (`pg_dump --no-acl`, deploy/scripts/sauvegarde.sh) : les droits se recréent par ce script, une base restaurée n'a rien
 * à porter.
 *
 * Ce fichier est PUR jusqu'à `assurerRoleApplicatif` : la construction des ordres SQL se teste sans base
 * (`droits-application.spec.ts`) ; l'épreuve réelle se fait sur la base locale (docs/deploiement.md).
 */

/** Nom du rôle applicatif, en production comme sur un poste de développement (`scripts/dev-db.sh` le crée). */
export const ROLE_APPLICATIF = 'moutar_app';

/**
 * Les journaux : SELECT et INSERT seulement. `colonnesModifiables` reste vide tant que rien dans l'application ne met un
 * journal à jour après insertion (vérifié le 20/10/2026 : `journal_admin` et `journal_ia` ne sont qu'insérés). Si un jour
 * un journal devait porter une colonne mise à jour, on la nomme ici et SEULE cette colonne s'ouvre.
 */
export interface DroitsJournal {
  table: string;
  colonnesModifiables: readonly string[];
}

export const JOURNAUX: readonly DroitsJournal[] = [
  { table: 'journal_admin', colonnesModifiables: [] },
  { table: 'journal_ia', colonnesModifiables: [] },
];

/** Un identifiant PostgreSQL sûr : le nom d'un rôle ou d'une table ne vient jamais d'un utilisateur, on le vérifie quand même. */
export function identifiantSur(nom: string): string {
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(nom)) throw new Error(`Identifiant PostgreSQL refusé : « ${nom} »`);
  return `"${nom}"`;
}

/**
 * Une table est un journal si elle est dans la liste OU si son nom commence par `journal_` : un journal ajouté par une
 * migration future est protégé avant même d'être inscrit ici.
 */
export function estJournal(table: string, journaux: readonly DroitsJournal[] = JOURNAUX): boolean {
  return table.startsWith('journal_') || journaux.some((j) => j.table === table);
}

/**
 * Les ordres SQL qui donnent au rôle applicatif exactement ce dont l'API a besoin, à rejouer à chaque passe.
 * `tables` = les tables PRÉSENTES dans le schéma public (lues en base par l'appelant) : on n'écrit un ordre que pour ce
 * qui existe, une base ancienne sans tel journal ne fait pas échouer la passe.
 */
export function ordresDroits(role: string, tables: readonly string[], journaux: readonly DroitsJournal[] = JOURNAUX): string[] {
  const r = identifiantSur(role);
  const ordres: string[] = [
    // Le schéma se LIT ; on n'y crée rien (une table créée par l'application échapperait aux migrations). Le CREATE sur
    // `public` n'a jamais été donné à moutar_app nommément : c'est le pseudo-rôle PUBLIC qui le détient sur un cluster
    // ≤ 14, et un REVOKE nominatif ne retire pas ce que PUBLIC détient. Sans effet sur PostgreSQL ≥ 15, protecteur ailleurs.
    `GRANT USAGE ON SCHEMA public TO ${r}`,
    `REVOKE CREATE ON SCHEMA public FROM PUBLIC`,
    // Aucun droit sur la table des migrations (schéma `drizzle`) : ce que l'application ne voit pas, elle ne peut pas le falsifier.
    `REVOKE ALL ON ALL TABLES IN SCHEMA drizzle FROM ${r}`,
    `REVOKE ALL ON SCHEMA drizzle FROM ${r}`,
    // Les séquences (aucune table n'en a aujourd'hui — les clés sont des UUID — mais un `serial` futur ne bloquera pas l'API).
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${r}`,
    // Tables et séquences FUTURES créées par le propriétaire : mêmes droits d'office, affinés (journaux) à la passe suivante.
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${r}`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${r}`,
  ];
  for (const table of [...tables].sort()) {
    const t = identifiantSur(table);
    if (!estJournal(table, journaux)) {
      ordres.push(`GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.${t} TO ${r}`);
      continue;
    }
    // Un journal : on retire TOUT (y compris ce que les privilèges par défaut ont pu donner), puis on rend seulement
    // lecture et ajout — et, colonne par colonne, ce qui est nommé.
    ordres.push(`REVOKE ALL ON TABLE public.${t} FROM ${r}`);
    ordres.push(`GRANT SELECT, INSERT ON TABLE public.${t} TO ${r}`);
    const colonnes = journaux.find((j) => j.table === table)?.colonnesModifiables ?? [];
    if (colonnes.length > 0) {
      ordres.push(`GRANT UPDATE (${colonnes.map(identifiantSur).join(', ')}) ON TABLE public.${t} TO ${r}`);
    }
  }
  return ordres;
}

/** Itérations SCRAM par défaut de PostgreSQL (`scram_iterations`, 4096) : le rôle s'authentifie exactement comme avec un `PASSWORD 'clair'`. */
export const SCRAM_ITERATIONS = 4096;

/**
 * Le VÉRIFICATEUR SCRAM-SHA-256 d'un mot de passe, calculé ici, en Node, et accepté tel quel par
 * `CREATE ROLE … PASSWORD 'SCRAM-SHA-256$4096:sel$StoredKey:ServerKey'` (RFC 5802 / 7677 : ce que PostgreSQL garde dans
 * `pg_authid.rolpassword`). POURQUOI : un mot de passe en clair dans un `CREATE ROLE` est recopié dans le CONTEXT d'une
 * erreur et dans le journal du serveur (`log_statement = 'all'`) ; avec le vérificateur, le seul littéral qui atteigne
 * le serveur est un haché salé, et le mot de passe ne quitte jamais ce processus. Pris tel quel (UTF-8), sans SASLprep,
 * comme le client `pg` de l'API : les deux côtés concordent.
 */
export function verificateurScram(motDePasse: string, sel: Buffer = randomBytes(16), iterations = SCRAM_ITERATIONS): string {
  const salted = pbkdf2Sync(Buffer.from(motDePasse, 'utf8'), sel, iterations, 32, 'sha256');
  const clientKey = createHmac('sha256', salted).update('Client Key').digest();
  const storedKey = createHash('sha256').update(clientKey).digest();
  const serverKey = createHmac('sha256', salted).update('Server Key').digest();
  return `SCRAM-SHA-256$${iterations}:${sel.toString('base64')}$${storedKey.toString('base64')}:${serverKey.toString('base64')}`;
}

/** Un vérificateur ne contient que des chiffres, du base64, `$` et `:` — vérifié avant d'être écrit en littéral, comme un identifiant. */
const FORME_VERIFICATEUR = /^SCRAM-SHA-256\$\d+:[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/;

/**
 * L'ordre qui crée le rôle ou lui remet son mot de passe (idempotent côté base, par un bloc DO). Le mot de passe n'y
 * figure jamais : seul son vérificateur, qu'un journal serveur peut porter sans rien livrer.
 */
export function ordreRole(role: string, verificateur: string): string {
  const r = identifiantSur(role);
  if (!FORME_VERIFICATEUR.test(verificateur)) throw new Error('Vérificateur SCRAM mal formé : refus de construire l’ordre.');
  return `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN
      EXECUTE 'CREATE ROLE ${r} WITH LOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOSUPERUSER PASSWORD ' || quote_literal('${verificateur}');
    ELSE
      EXECUTE 'ALTER ROLE ${r} WITH LOGIN NOCREATEDB NOCREATEROLE NOSUPERUSER PASSWORD ' || quote_literal('${verificateur}');
    END IF;
  END $$`;
}

/** Un message d'erreur qui ne porte jamais le mot de passe, quoi que `pg` ait remonté. */
function sansSecret(err: unknown, secret: string | undefined): string {
  const message = err instanceof Error ? err.message : String(err);
  return secret ? message.split(secret).join('••••') : message;
}

export interface ResultatDroits {
  role: 'cree' | 'mis_a_jour' | 'inchange';
  tables: number;
  journaux: number;
}

/**
 * Crée le rôle applicatif s'il manque (ou lui remet son mot de passe quand un mot de passe est donné), puis pose ses
 * droits sur ce qui existe — le tout dans UNE transaction (jamais un instant où un journal serait ouvert en écriture,
 * jamais un rôle créé sans ses droits). Demande au propriétaire CREATEROLE (ou superutilisateur) quand le rôle manque :
 * c'est le cas de `moutar` dans l'image PostgreSQL du compose et sur un poste ; sur une base managée dont le propriétaire
 * ne l'a pas, créer `moutar_app` une fois à la main (LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE), puis relancer.
 * Sans mot de passe, un rôle existant est laissé tel quel (seuls les droits se reposent) ; un rôle absent est un refus.
 */
export async function assurerRoleApplicatif(pool: Pool, role: string, motDePasse: string | undefined): Promise<ResultatDroits> {
  identifiantSur(role);
  const client = await pool.connect();
  let enTransaction = false;
  try {
    const existe = (await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role])).rowCount === 1;
    if (!existe && !motDePasse) {
      throw new Error(`le rôle « ${role} » n'existe pas et MOUTAR_APP_PASSWORD est absent : rien n'a été fait.`);
    }
    if (motDePasse) {
      const droit = await client.query<{ peut: boolean; u: string }>('SELECT (rolcreaterole OR rolsuper) AS peut, current_user AS u FROM pg_roles WHERE rolname = current_user');
      if (!droit.rows[0]?.peut) {
        throw new Error(
          `le rôle des migrations (${droit.rows[0]?.u ?? '?'}) n'a pas CREATEROLE : lui donner ce droit, ou créer « ${role} » une fois à la main (LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE), puis relancer sans MOUTAR_APP_PASSWORD.`,
        );
      }
    }
    const { rows } = await client.query<{ tablename: string }>(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
    const tables = rows.map((x) => x.tablename);
    await client.query('BEGIN');
    enTransaction = true;
    if (motDePasse) await client.query(ordreRole(role, verificateurScram(motDePasse)));
    for (const ordre of ordresDroits(role, tables)) await client.query(ordre);
    await client.query('COMMIT');
    const journaux = tables.filter((t) => estJournal(t)).length;
    return { role: !existe ? 'cree' : motDePasse ? 'mis_a_jour' : 'inchange', tables: tables.length - journaux, journaux };
  } catch (err) {
    if (enTransaction) await client.query('ROLLBACK').catch(() => undefined);
    // Filet : le mot de passe n'a jamais été envoyé, mais on masque quand même ce que `pg` remonte.
    throw new Error(`Rôle applicatif « ${role} » : ${sansSecret(err, motDePasse)}`);
  } finally {
    client.release();
  }
}

/**
 * Ce que l'API vérifie À SON DÉMARRAGE en production (`DatabaseModule`), par la connexion qu'elle a : le rôle qui sert
 * n'est pas superutilisateur et ne peut rien créer dans le schéma. Le conteneur de l'API ne connaît pas
 * `DATABASE_URL_MIGRATIONS` (deploy/docker-compose.yml) : l'heuristique de `refusRoleProprietaire` n'y voit rien, celle-ci
 * relit la vérité en base. Rend le refus, ou null.
 */
export async function verifierRoleApplicatif(pool: Pool): Promise<string | null> {
  const { rows } = await pool.query<{ u: string; rolsuper: boolean; cree: boolean }>(
    `SELECT current_user AS u, rolsuper, has_schema_privilege(current_user, 'public', 'CREATE') AS cree FROM pg_roles WHERE rolname = current_user`,
  );
  const ligne = rows[0];
  if (!ligne) return 'le rôle courant de la base est introuvable dans pg_roles.';
  if (ligne.rolsuper) return `l'API est connectée en superutilisateur (« ${ligne.u} ») : elle doit tourner avec le rôle applicatif « ${ROLE_APPLICATIF} » (db:droits).`;
  if (ligne.cree) return `le rôle « ${ligne.u} » peut créer dans le schéma public : ce n'est pas le rôle applicatif attendu (db:droits).`;
  return null;
}
