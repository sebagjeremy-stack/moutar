import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

/**
 * Variables d'environnement, validées au démarrage : une variable obligatoire absente ou un moteur d'IA hors du périmètre
 * autorisé, et l'API refuse de démarrer (CLAUDE.md : « hôte hors liste = l'API ne démarre pas »).
 * Une variable VIDE vaut absente (dans un .env on vide une ligne, on ne l'efface pas).
 */
function videVautAbsente<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), schema);
}

const schemaEnv = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT_API: z.coerce.number().int().positive().default(3100),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL est requis'),
  // Pas de SESSION_SECRET : le jeton de session de la console est ALÉATOIRE (32 octets) et gardé HACHÉ en base ; le cookie
  // ne porte que ce jeton, rien n'est signé (`modules/admin/session-admin.ts`). Retiré le 20/10/2026.
  /** Lot 3 : deux fournisseurs derrière un seul module `ia` (CLAUDE.md, 20/10/2026) ; OVH par défaut. */
  IA_FOURNISSEUR: z.enum(['ovh', 'anthropic']).default('ovh'),
  ANTHROPIC_API_KEY: videVautAbsente(z.string().min(1).optional()),
  /** Le modèle Claude (SDK officiel) ; `claude-opus-5-5` par défaut (CLAUDE.md, 20/10/2026). */
  IA_MODELE_ANTHROPIC: videVautAbsente(z.string().optional()).default('claude-opus-5-5'),
  /** OVHcloud AI Endpoints (compatible OpenAI) : adresse `/v1`, jeton (absent quand un mandataire authentifie), modèles. */
  IA_BASE_URL: videVautAbsente(z.string().url().optional()),
  IA_API_KEY: videVautAbsente(z.string().min(1).optional()),
  IA_MODELE_VISION: videVautAbsente(z.string().optional()).default('Qwen2.5-VL-72B-Instruct'),
  IA_MODELE_TEXTE: videVautAbsente(z.string().optional()).default('gpt-oss-120b'),
  IA_MODELE_AUDIO: videVautAbsente(z.string().optional()).default('whisper-large-v3-turbo'),
  /** Hôtes EXACTS autorisés pour IA_BASE_URL, séparés par des virgules ; aucun sous-domaine implicite. */
  IA_HOTES_AUTORISES: videVautAbsente(z.string().optional()),
  OFF_BASE_URL: videVautAbsente(z.string().url().optional()).default('https://world.openfoodfacts.org'),
  /** Lot 5 : les hôtes admis pour le lien de preuve d'une contribution (https seulement ; un sous-domaine de l'hôte compte). */
  CONTRIBUTION_HOTES_PREUVE: videVautAbsente(z.string().optional()).default('facebook.com,lesbonsplanscachers.fr'),
  ADMIN_EMAIL_INITIAL: videVautAbsente(z.string().email().optional()),
});

export type Env = z.infer<typeof schemaEnv>;

/** Les hôtes autorisés pour le moteur d'IA : la liste déclarée, exacte. */
export function hotesAutorises(env: Pick<Env, 'IA_HOTES_AUTORISES'>): string[] {
  return (env.IA_HOTES_AUTORISES ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter((h) => h.length > 0);
}

/** Les hôtes admis pour une preuve de contribution (lot 5), en minuscules, sans vide. */
export function hotesPreuve(env: Pick<Env, 'CONTRIBUTION_HOTES_PREUVE'>): string[] {
  return env.CONTRIBUTION_HOTES_PREUVE.split(',')
    .map((h) => h.trim().toLowerCase())
    .filter((h) => h.length > 0);
}

/** Pure : le refus qui empêche le démarrage, ou null. */
export function refusDemarrage(env: Env): string | null {
  if (env.IA_BASE_URL) {
    const hote = new URL(env.IA_BASE_URL).hostname.toLowerCase();
    if (!hotesAutorises(env).includes(hote)) {
      return `IA_BASE_URL pointe vers « ${hote} », hors de IA_HOTES_AUTORISES : l'API refuse de démarrer.`;
    }
  }
  if (env.IA_FOURNISSEUR === 'anthropic' && !env.ANTHROPIC_API_KEY) return 'IA_FOURNISSEUR=anthropic exige ANTHROPIC_API_KEY (le nom de la variable seulement, jamais la clé dans le code).';
  // En production, l'hôte d'OVH n'est jamais appelé sans jeton : sans mandataire, un appel sans clé est refusé (401) ou
  // tombe sur la limite serrée de l'endpoint anonyme ; on refuse de démarrer plutôt que de servir un moteur boiteux.
  if (env.NODE_ENV === 'production' && env.IA_FOURNISSEUR === 'ovh' && env.IA_BASE_URL && !env.IA_API_KEY) {
    return 'En production, IA_FOURNISSEUR=ovh exige IA_API_KEY (le jeton OVHcloud AI Endpoints, posé dans l’environnement — jamais dans le code) : l’API refuse de démarrer.';
  }
  return null;
}

/** Valide un objet d'environnement (pur, testable). Lance si une variable manque ou si le périmètre d'IA est violé. */
export function validerEnv(brut: NodeJS.ProcessEnv): Env {
  const parsed = schemaEnv.safeParse(brut);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' ; ');
    throw new Error(`Environnement invalide — ${details}`);
  }
  const refus = refusDemarrage(parsed.data);
  if (refus) throw new Error(refus);
  return parsed.data;
}

let cache: Env | null = null;

/** Charge le .env de la racine du monorepo (une fois), puis valide. */
export function loadEnv(): Env {
  if (cache) return cache;
  dotenv.config({ path: resolve(__dirname, '../../../../.env') });
  cache = validerEnv(process.env);
  return cache;
}
