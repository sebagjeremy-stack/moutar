import { describe, expect, it } from 'vitest';
import { chaineMigrations, refusRoleProprietaire, roleDeLaChaine, validerEnv } from './env';

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
  it('en production, le fournisseur ovh exige IA_API_KEY ; en développement, non (un mandataire authentifie)', () => {
    const ovh = { ...base, IA_BASE_URL: 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1', IA_HOTES_AUTORISES: 'oai.endpoints.kepler.ai.cloud.ovh.net' };
    expect(() => validerEnv({ ...ovh, NODE_ENV: 'production' })).toThrow(/IA_API_KEY/);
    expect(() => validerEnv({ ...ovh, NODE_ENV: 'production', IA_API_KEY: '' })).toThrow(/IA_API_KEY/);
    expect(validerEnv({ ...ovh, NODE_ENV: 'production', IA_API_KEY: 'jeton' }).IA_API_KEY).toBe('jeton');
    expect(validerEnv({ ...ovh, NODE_ENV: 'development' }).IA_API_KEY).toBeUndefined();
    // Sans IA_BASE_URL, le moteur n'est pas configuré : l'API démarre (503 sur les routes IA), même en production.
    expect(validerEnv({ ...base, NODE_ENV: 'production' }).IA_BASE_URL).toBeUndefined();
  });
  it('une variable vide vaut absente', () => {
    expect(validerEnv({ ...base, IA_BASE_URL: '', ADMIN_EMAIL_INITIAL: '' }).IA_BASE_URL).toBeUndefined();
  });

  describe('deux chaînes de base (20/10/2026) : l’API en moutar_app, les migrations avec le propriétaire', () => {
    const app = 'postgres://moutar_app:secret@db:5432/moutar';
    const proprietaire = 'postgres://moutar:autre@db:5432/moutar';

    it('en production, refuse DATABASE_URL identique à DATABASE_URL_MIGRATIONS, avec un message qui dit quoi faire', () => {
      expect(() => validerEnv({ NODE_ENV: 'production', DATABASE_URL: proprietaire, DATABASE_URL_MIGRATIONS: proprietaire })).toThrow(/identique à DATABASE_URL_MIGRATIONS.*moutar_app.*db:droits/);
    });
    it('en production, refuse aussi le MÊME RÔLE sous deux chaînes différentes', () => {
      const refus = refusRoleProprietaire({ NODE_ENV: 'production', DATABASE_URL: 'postgres://moutar:x@db:5432/moutar?sslmode=disable', DATABASE_URL_MIGRATIONS: proprietaire });
      expect(refus).toMatch(/rôle propriétaire « moutar »/);
    });
    it('en production, accepte le rôle applicatif ; et sans DATABASE_URL_MIGRATIONS (conteneur de l’API), ne juge pas', () => {
      expect(validerEnv({ NODE_ENV: 'production', DATABASE_URL: app, DATABASE_URL_MIGRATIONS: proprietaire }).DATABASE_URL).toBe(app);
      expect(refusRoleProprietaire({ NODE_ENV: 'production', DATABASE_URL: proprietaire, DATABASE_URL_MIGRATIONS: undefined })).toBeNull();
      expect(validerEnv({ NODE_ENV: 'production', DATABASE_URL: proprietaire, DATABASE_URL_MIGRATIONS: '' }).DATABASE_URL_MIGRATIONS).toBeUndefined();
    });
    it('en développement, les deux chaînes peuvent être égales', () => {
      expect(validerEnv({ NODE_ENV: 'development', DATABASE_URL: proprietaire, DATABASE_URL_MIGRATIONS: proprietaire }).DATABASE_URL).toBe(proprietaire);
    });
    it('chaineMigrations : le propriétaire, sinon DATABASE_URL hors production, exigé en production', () => {
      expect(chaineMigrations({ NODE_ENV: 'development', DATABASE_URL: app, DATABASE_URL_MIGRATIONS: proprietaire })).toBe(proprietaire);
      expect(chaineMigrations({ NODE_ENV: 'development', DATABASE_URL: proprietaire, DATABASE_URL_MIGRATIONS: undefined })).toBe(proprietaire);
      expect(() => chaineMigrations({ NODE_ENV: 'production', DATABASE_URL: app, DATABASE_URL_MIGRATIONS: undefined })).toThrow(/DATABASE_URL_MIGRATIONS/);
    });
    it('roleDeLaChaine lit le rôle, décodé, et rend null sur une chaîne illisible', () => {
      expect(roleDeLaChaine('postgres://moutar%5Fapp:x@h/db')).toBe('moutar_app');
      expect(roleDeLaChaine('pas une url')).toBeNull();
      expect(roleDeLaChaine('postgres://h/db')).toBeNull();
    });
    it('MOUTAR_APP_PASSWORD vide vaut absent (jamais écrit, seulement lu par db:droits)', () => {
      expect(validerEnv({ ...base, MOUTAR_APP_PASSWORD: '' }).MOUTAR_APP_PASSWORD).toBeUndefined();
      expect(validerEnv({ ...base, MOUTAR_APP_PASSWORD: 'x' }).MOUTAR_APP_PASSWORD).toBe('x');
    });
  });
});
