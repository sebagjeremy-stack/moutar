import { describe, expect, it } from 'vitest';
import { validerEnv } from './env';

const base = { DATABASE_URL: 'postgres://x' };

describe('validerEnv', () => {
  it('accepte un environnement minimal et pose les défauts', () => {
    const env = validerEnv({ ...base });
    expect(env.PORT_API).toBe(3100);
    expect(env.OFF_BASE_URL).toBe('https://world.openfoodfacts.org');
  });
  it('refuse une DATABASE_URL absente', () => {
    expect(() => validerEnv({})).toThrow(/DATABASE_URL/);
  });
  it('refuse un moteur d’IA hors des hôtes autorisés', () => {
    expect(() => validerEnv({ ...base, IA_BASE_URL: 'https://api.openai.com/v1', IA_HOTES_AUTORISES: 'oai.endpoints.kepler.ai.cloud.ovh.net' })).toThrow(/hors de IA_HOTES_AUTORISES/);
  });
  it('accepte un moteur dont l’hôte EXACT est déclaré', () => {
    const env = validerEnv({ ...base, IA_BASE_URL: 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1', IA_HOTES_AUTORISES: 'oai.endpoints.kepler.ai.cloud.ovh.net' });
    expect(env.IA_BASE_URL).toContain('ovh.net');
  });
  it('un sous-domaine n’est pas implicite', () => {
    expect(() => validerEnv({ ...base, IA_BASE_URL: 'https://autre.ovh.net/v1', IA_HOTES_AUTORISES: 'ovh.net' })).toThrow();
  });
  it('ne demande aucune clé de session (le jeton est aléatoire et haché), même en production', () => {
    expect(validerEnv({ DATABASE_URL: 'postgres://x', NODE_ENV: 'production' }).NODE_ENV).toBe('production');
  });
  it('le fournisseur anthropic exige sa clé', () => {
    expect(() => validerEnv({ ...base, IA_FOURNISSEUR: 'anthropic' })).toThrow(/ANTHROPIC_API_KEY/);
    expect(validerEnv({ ...base, IA_FOURNISSEUR: 'anthropic', ANTHROPIC_API_KEY: 'x' }).IA_FOURNISSEUR).toBe('anthropic');
  });
  it('une variable vide vaut absente', () => {
    expect(validerEnv({ ...base, IA_BASE_URL: '', ADMIN_EMAIL_INITIAL: '' }).IA_BASE_URL).toBeUndefined();
  });
});
