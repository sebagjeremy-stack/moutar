import { deflateSync } from 'node:zlib';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { expect, type APIRequestContext } from '@playwright/test';

/** Ce que la graine écrit (`apps/api/src/scripts/seed-e2e.ts`) : les EAN fictifs, le compte de console, l'import éventuel. */
export interface GraineE2e {
  adminEmail: string;
  eans: { cite: string; nonCacher: string; sansIngredients: string; ocr: string };
  listeFictiveAImporter: boolean;
}

export const DOSSIER_E2E = '.devstack/e2e';
/** Les cookies de la console enregistrés par le projet `setup`, rejoués ensuite (ignorés par git). */
export const ETAT_ADMIN = `${DOSSIER_E2E}/admin.json`;

export function graine(): GraineE2e {
  const chemin = resolve(DOSSIER_E2E, 'graine.json');
  if (!existsSync(chemin)) throw new Error(`${chemin} absent : lancez d'abord \`pnpm --filter @moutar/api db:seed-e2e\` (la graine des tests).`);
  return JSON.parse(readFileSync(chemin, 'utf8')) as GraineE2e;
}

/** Le mot de passe du compte e2e : `E2E_ADMIN_PASSWORD`, sinon le fichier que la graine a écrit (ignoré par git). */
export function motDePasseAdmin(): string {
  const env = process.env['E2E_ADMIN_PASSWORD']?.trim();
  if (env) return env;
  const chemin = resolve(DOSSIER_E2E, 'mot-de-passe-admin');
  if (!existsSync(chemin)) throw new Error(`Ni E2E_ADMIN_PASSWORD ni ${chemin} : relancez la graine e2e.`);
  return readFileSync(chemin, 'utf8').trim();
}

/**
 * La base de développement, lue avec le pilote de l'API (`DATABASE_URL` du `.env` racine, via `apps/api/node_modules/pg`) :
 * les tests NETTOIENT ce qu'ils créent (retrait doux : `deleted_at`), et posent ce que le moteur d'IA, jamais appelé en
 * e2e, aurait fait écrire. Jamais un import du code du serveur ici.
 */
export async function sql<T = Record<string, unknown>>(texte: string, params: unknown[] = []): Promise<T[]> {
  const url = /^DATABASE_URL=(.+)$/m.exec(readFileSync('.env', 'utf8'))?.[1]?.trim().replace(/^["']|["']$/g, '');
  if (!url) throw new Error('DATABASE_URL absent du .env racine.');
  type Pg = { Client: new (o: { connectionString?: string }) => { connect(): Promise<void>; query(t: string, p?: unknown[]): Promise<{ rows: unknown[] }>; end(): Promise<void> } };
  const { Client } = createRequire(resolve(process.cwd(), 'apps/api/package.json'))('pg') as Pg;
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return (await client.query(texte, params)).rows as T[];
  } finally {
    await client.end();
  }
}

export async function produitId(ean: string): Promise<string> {
  const [l] = await sql<{ id: string }>('SELECT id FROM produit WHERE ean = $1 AND deleted_at IS NULL', [ean]);
  if (!l) throw new Error(`Produit ${ean} absent : relancez la graine e2e.`);
  return l.id;
}

/** Retire (doux) les verdicts vivants d'un niveau pour un produit de la graine. */
export async function retirerVerdicts(ean: string, niveau: number): Promise<void> {
  await sql('UPDATE verdict SET deleted_at = now() WHERE deleted_at IS NULL AND niveau = $2 AND produit_id = (SELECT id FROM produit WHERE ean = $1)', [ean, niveau]);
}

/**
 * Pose une certification de niveau 1 EN BASE, comme `CertificationService.valider` l'écrit après une lecture réelle du
 * logo : le moteur d'IA n'est jamais appelé en e2e et le jeton de proposition (haché en mémoire de l'API) ne s'obtient
 * que par lui. Le test la retire ensuite par l'écran (`DELETE` réel) et en `finally`.
 */
export async function poserCertification(ean: string, o: { code: string; nom: string; mentions: string[]; mentionsLibelles: string[]; texteLu: string }): Promise<void> {
  await retirerVerdicts(ean, 1);
  await sql(
    `INSERT INTO verdict (produit_id, niveau, rite, statut, source, mention, publie_le, valable_jusqu_au, detail)
     VALUES ((SELECT id FROM produit WHERE ean = $1), 1, 'casher', 'cite', $2, $3, now(), NULL, $4::jsonb)`,
    [ean, o.nom, o.mentionsLibelles.join(' · ') || null, JSON.stringify({ certificateur: o.code, mentions: o.mentions, texteLu: o.texteLu, validePar: 'utilisateur' })],
  );
}

/** Retire (doux) les contributions d'un produit de la graine et le verdict de niveau 3 qu'elles fondent. */
export async function nettoyerContributions(ean: string): Promise<void> {
  await sql('UPDATE contribution SET deleted_at = now(), updated_at = now() WHERE deleted_at IS NULL AND produit_id = (SELECT id FROM produit WHERE ean = $1)', [ean]);
  await retirerVerdicts(ean, 3);
}

/** Remet un produit de la graine sans ingrédients (après une saisie ou un OCR relu), et retire son verdict de niveau 4. */
export async function remettreSansIngredients(ean: string): Promise<void> {
  await sql("UPDATE produit SET ingredients_texte = NULL, additifs = '[]'::jsonb, source = 'manuel', updated_at = now() WHERE ean = $1", [ean]);
  await retirerVerdicts(ean, 4);
}

/** La carte d'un produit par l'API (le même JSON que l'écran lit). */
export async function carte(api: APIRequestContext, ean: string, seuil = 2): Promise<{ synthese: { pastille: string; ton: string }; lignes: Array<{ niveau: number; pastille: string; ton: string; source: string | null }> }> {
  const r = await api.get(`/api/v1/produits/${ean}/carte?seuil=${seuil}`);
  expect(r.status(), await r.text()).toBe(200);
  return (await r.json()) as never;
}

/**
 * Un PNG valide pour « Choisir une image de l'appareil » : une image de synthèse du lot 3 si `.devstack` en garde une,
 * sinon un PNG de 96 × 96 px généré ici (un aplat et un disque, encodés avec zlib) — jamais une photo réelle.
 */
export function imagePng(): { name: string; mimeType: string; buffer: Buffer } {
  for (const chemin of ['.devstack/images-lot3/logo-ou.png', '.devstack/images-relecture/logo-ou.png', '.devstack/captures/lot34-scan-image.png']) {
    if (existsSync(chemin)) return { name: 'etiquette.png', mimeType: 'image/png', buffer: readFileSync(chemin) };
  }
  return { name: 'etiquette.png', mimeType: 'image/png', buffer: pngGenere(96, 96) };
}

function pngGenere(largeur: number, hauteur: number): Buffer {
  const brut = Buffer.alloc((largeur * 3 + 1) * hauteur);
  for (let y = 0; y < hauteur; y++) {
    brut[y * (largeur * 3 + 1)] = 0;
    for (let x = 0; x < largeur; x++) {
      const i = y * (largeur * 3 + 1) + 1 + x * 3;
      const dansLeDisque = (x - largeur / 2) ** 2 + (y - hauteur / 2) ** 2 < (largeur / 3) ** 2;
      brut[i] = dansLeDisque ? 30 : 245;
      brut[i + 1] = dansLeDisque ? 30 : 240;
      brut[i + 2] = dansLeDisque ? 120 : 230;
    }
  }
  const morceau = (type: string, donnees: Buffer) => {
    const longueur = Buffer.alloc(4);
    longueur.writeUInt32BE(donnees.length);
    const corps = Buffer.concat([Buffer.from(type, 'ascii'), donnees]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(corps));
    return Buffer.concat([longueur, corps, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largeur, 0);
  ihdr.writeUInt32BE(hauteur, 4);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 2; // couleur RVB
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), morceau('IHDR', ihdr), morceau('IDAT', deflateSync(brut)), morceau('IEND', Buffer.alloc(0))]);
}

let tableCrc: Uint32Array | null = null;
function crc32(donnees: Buffer): number {
  if (!tableCrc) {
    tableCrc = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      tableCrc[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const octet of donnees) crc = tableCrc[(crc ^ octet) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
