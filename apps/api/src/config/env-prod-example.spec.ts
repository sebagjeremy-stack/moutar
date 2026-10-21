import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CLES_ENV, validerEnv } from './env';

/**
 * `deploy/env.prod.example` liste TOUTES les variables du schéma (`env.ts`), posée (`X=`) ou pour mémoire (`# X=`) : une
 * variable ajoutée au schéma sans sa ligne dans l'exemple fait échouer ce test — et l'exemple, complété des valeurs que
 * le compose pose, est un environnement de production que `validerEnv` accepte.
 */
const chemin = resolve(__dirname, '../../../../deploy/env.prod.example');
const texte = readFileSync(chemin, 'utf8');

/** Les lignes `CLE=valeur` posées, et les clés citées en commentaire (`# CLE=`). */
function lire(contenu: string): { posees: Record<string, string>; citees: Set<string> } {
  const posees: Record<string, string> = {};
  const citees = new Set<string>();
  for (const ligne of contenu.split('\n')) {
    const m = /^(#\s*)?([A-Z][A-Z0-9_]*)=(.*)$/.exec(ligne.trim());
    if (!m) continue;
    const [, commentaire, cle, valeur] = m;
    if (commentaire) citees.add(cle);
    else posees[cle] = valeur;
  }
  return { posees, citees };
}

/** Variables du compose, lues par deploy/docker-compose.yml et non par l'API. */
const DU_COMPOSE = ['DOMAINE', 'ACME_EMAIL', 'POSTGRES_PASSWORD'];
/** Posées par le compose (service `api`), citées en commentaire dans l'exemple. */
const POSEES_PAR_LE_COMPOSE = ['NODE_ENV', 'PORT_API', 'DATABASE_URL', 'DATABASE_URL_MIGRATIONS', 'MOUTAR_APP_PASSWORD'];

describe('deploy/env.prod.example', () => {
  const { posees, citees } = lire(texte);
  const clesSchema = [...CLES_ENV];

  it('cite chaque variable du schéma, posée ou pour mémoire', () => {
    const manquantes = clesSchema.filter((c) => !(c in posees) && !citees.has(c));
    expect(manquantes).toEqual([]);
  });

  it('ne pose aucune variable inconnue du schéma ou du compose', () => {
    const inconnues = Object.keys(posees).filter((c) => !clesSchema.includes(c) && !DU_COMPOSE.includes(c));
    expect(inconnues).toEqual([]);
  });

  it('les variables posées par le compose y sont commentées, jamais posées', () => {
    for (const c of POSEES_PAR_LE_COMPOSE) {
      expect(posees, `${c} ne doit pas être posée dans l'exemple`).not.toHaveProperty(c);
      expect(citees.has(c), `${c} doit être citée en commentaire`).toBe(true);
    }
  });

  it('ne porte aucune valeur secrète (les secrets sont « remplace-moi » ou vides)', () => {
    for (const c of ['POSTGRES_PASSWORD', 'IA_API_KEY', 'ANTHROPIC_API_KEY']) {
      expect(['remplace-moi', ''], `${c} porte une valeur`).toContain(posees[c] ?? '');
    }
  });

  it('complété de ce que le compose pose, est un environnement de production que l’API accepte', () => {
    const env = validerEnv({
      ...posees,
      NODE_ENV: 'production',
      PORT_API: '3100',
      DATABASE_URL: 'postgres://moutar_app:x@db:5432/moutar',
      DATABASE_URL_MIGRATIONS: '',
    });
    expect(env.NODE_ENV).toBe('production');
    expect(env.IA_FOURNISSEUR).toBe('ovh');
    expect(env.IA_HOTES_AUTORISES).toBe('oai.endpoints.kepler.ai.cloud.ovh.net');
  });
});
