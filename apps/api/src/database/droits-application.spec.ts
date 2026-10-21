import { describe, expect, it } from 'vitest';
import { JOURNAUX, ROLE_APPLICATIF, estJournal, identifiantSur, ordreRole, ordresDroits, verificateurScram } from './droits-application';

const TABLES = ['produit', 'verdict', 'journal_admin', 'journal_ia', 'journal_produit', 'compte_admin', 'session_admin', 'liste_officielle', 'ligne_liste'];

describe('ordresDroits (le SQL du rôle applicatif, sans base)', () => {
  const ordres = ordresDroits(ROLE_APPLICATIF, TABLES);

  it('ne donne sur un journal que SELECT et INSERT — jamais UPDATE, DELETE ni TRUNCATE', () => {
    for (const journal of ['journal_admin', 'journal_ia', 'journal_produit']) {
      const surLeJournal = ordres.filter((o) => o.includes(`public."${journal}"`));
      expect(surLeJournal).toEqual([
        `REVOKE ALL ON TABLE public."${journal}" FROM "moutar_app"`,
        `GRANT SELECT, INSERT ON TABLE public."${journal}" TO "moutar_app"`,
      ]);
      for (const o of surLeJournal.filter((x) => x.startsWith('GRANT'))) {
        expect(o).not.toMatch(/UPDATE|DELETE|TRUNCATE|ALL/);
      }
    }
  });

  it('donne lecture et écriture complètes sur les autres tables', () => {
    expect(ordres).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."produit" TO "moutar_app"');
    expect(ordres).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."session_admin" TO "moutar_app"');
  });

  it('retire le schéma des migrations, le CREATE sur public, et pose les privilèges par défaut', () => {
    expect(ordres).toContain('REVOKE ALL ON ALL TABLES IN SCHEMA drizzle FROM "moutar_app"');
    expect(ordres).toContain('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
    expect(ordres).toContain('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "moutar_app"');
    expect(ordres.some((o) => o.includes('GRANT CREATE'))).toBe(false);
  });

  it('un journal futur est protégé par son seul nom (journal_*), et la liste déclarée couvre les trois journaux du schéma', () => {
    expect(estJournal('journal_contributions')).toBe(true);
    expect(estJournal('produit')).toBe(false);
    expect(JOURNAUX.map((j) => j.table).sort()).toEqual(['journal_admin', 'journal_ia', 'journal_produit']);
    const avecNouveau = ordresDroits(ROLE_APPLICATIF, ['journal_nouveau']);
    expect(avecNouveau).toContain('GRANT SELECT, INSERT ON TABLE public."journal_nouveau" TO "moutar_app"');
    expect(avecNouveau.some((o) => o.includes('journal_nouveau') && /UPDATE|DELETE/.test(o) && o.startsWith('GRANT'))).toBe(false);
  });

  it('est idempotent : deux passes donnent les mêmes ordres, quel que soit l’ordre des tables', () => {
    expect(ordresDroits(ROLE_APPLICATIF, [...TABLES].reverse())).toEqual(ordres);
    expect(ordres.every((o) => /^(GRANT|REVOKE|ALTER DEFAULT PRIVILEGES) /.test(o))).toBe(true);
  });

  it('une colonne nommée modifiable ouvre SEULEMENT cette colonne', () => {
    const o = ordresDroits('moutar_app', ['journal_x'], [{ table: 'journal_x', colonnesModifiables: ['clos_le'] }]);
    expect(o).toContain('GRANT UPDATE ("clos_le") ON TABLE public."journal_x" TO "moutar_app"');
  });

  it('refuse un identifiant qui n’est pas un nom PostgreSQL simple', () => {
    expect(() => identifiantSur('x"; DROP TABLE produit; --')).toThrow(/refusé/);
    expect(() => ordresDroits('Moutar App', TABLES)).toThrow(/refusé/);
  });
});

describe('ordreRole (création sans mot de passe en clair)', () => {
  it('ne porte que le vérificateur SCRAM, jamais le mot de passe', () => {
    const verificateur = verificateurScram('secret-de-test', Buffer.alloc(16, 1));
    expect(verificateur).toMatch(/^SCRAM-SHA-256\$4096:/);
    const sql = ordreRole(ROLE_APPLICATIF, verificateur);
    expect(sql).not.toContain('secret-de-test');
    expect(sql).toContain('CREATE ROLE "moutar_app" WITH LOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOSUPERUSER PASSWORD');
    expect(sql).toContain('ALTER ROLE "moutar_app" WITH LOGIN NOCREATEDB NOCREATEROLE NOSUPERUSER PASSWORD');
  });
  it('le vérificateur est déterministe à sel fixé, différent à sel différent', () => {
    const sel = Buffer.alloc(16, 7);
    expect(verificateurScram('a', sel)).toBe(verificateurScram('a', sel));
    expect(verificateurScram('a', sel)).not.toBe(verificateurScram('a', Buffer.alloc(16, 8)));
  });
  it('refuse un vérificateur mal formé (rien ne se construit)', () => {
    expect(() => ordreRole(ROLE_APPLICATIF, "x' ; DROP ROLE moutar; --")).toThrow(/mal formé/);
  });
});
