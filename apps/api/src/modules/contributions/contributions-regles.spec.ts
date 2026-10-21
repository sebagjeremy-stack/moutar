import { describe, expect, it } from 'vitest';
import type { ContributionPublique } from '@moutar/shared-types';
import { ErreurMetier } from '../../common/erreurs/erreur-metier';
import { contributionFondatrice, nettoyerProposition, verdictDeContribution } from './contributions-regles';
import { schemaProposition, schemaSignalement, verifierPreuve, verifierPseudonyme, verifierSourceDate } from './contributions.controller';

const HOTES = ['facebook.com', 'lesbonsplanscachers.fr'];

// Les cas de `preuveUrlAdmise` sont dans `packages/shared-types/src/regles/preuve.spec.ts` (règle partagée, 21/10/2026).
describe('verifierPreuve (le serveur tranche sur la règle partagée)', () => {
  it('verifierPreuve : null reste null ; un lien refusé → 400 preuve_refusee qui nomme les hôtes admis', () => {
    expect(verifierPreuve(null, HOTES)).toBeNull();
    expect(verifierPreuve('https://facebook.com/x', HOTES)).toBe('https://facebook.com/x');
    try {
      verifierPreuve('https://example.org/x', HOTES);
      throw new Error('aucune erreur');
    } catch (e) {
      const err = e as ErreurMetier;
      expect(err.getStatus()).toBe(400);
      expect(err.getResponse()).toMatchObject({ code: 'preuve_refusee', hotesAdmis: HOTES });
    }
  });
});

describe('verifierSourceDate et verifierPseudonyme (400 date_invalide / pseudonyme_invalide)', () => {
  const code = (fn: () => unknown): unknown => {
    try {
      fn();
    } catch (e) {
      return (e as ErreurMetier).getResponse();
    }
    return null;
  };
  it('un jour réel et passé passe ; 2026-13-45, le 31 avril et demain → 400 date_invalide ; vide → null', () => {
    expect(verifierSourceDate('2026-05-03', '2026-10-20')).toBe('2026-05-03');
    expect(verifierSourceDate('2026-10-20', '2026-10-20')).toBe('2026-10-20');
    expect(verifierSourceDate(null)).toBeNull();
    expect(code(() => verifierSourceDate('2026-13-45', '2026-10-20'))).toMatchObject({ code: 'date_invalide' });
    expect(code(() => verifierSourceDate('2026-04-31', '2026-10-20'))).toMatchObject({ code: 'date_invalide' });
    expect(code(() => verifierSourceDate('2026-10-21', '2026-10-20'))).toMatchObject({ code: 'date_invalide', aujourdhui: '2026-10-20' });
  });
  it('un pseudonyme avec « @ » → 400 pseudonyme_invalide, le contrat dit « un pseudonyme, pas votre nom ni votre e-mail »', () => {
    expect(verifierPseudonyme('Sarah')).toBe('Sarah');
    expect(verifierPseudonyme(null)).toBeNull();
    expect(code(() => verifierPseudonyme('sarah@exemple.fr'))).toMatchObject({ code: 'pseudonyme_invalide', message: expect.stringContaining('pas votre nom ni votre e-mail') });
  });
});

describe('nettoyerProposition (texte brut, bornes)', () => {
  const base = { statutPropose: 'cite' as const, sourceType: 'lbpc' as const, sourceDate: null, preuveUrl: null };
  it('retire les balises des textes, tronque à 1 000 et 40, un pseudonyme vide devient null', () => {
    const c = nettoyerProposition({ ...base, sourceTexte: '<b>Validé</b> le 3 mai <script>x</script>', auteurNom: ' <i>Sarah</i> ' });
    expect(c.sourceTexte).toBe('Validé le 3 mai');
    expect(c.auteurNom).toBe('Sarah');
    expect(nettoyerProposition({ ...base, sourceTexte: 'a'.repeat(1200), auteurNom: 'b'.repeat(60) })).toMatchObject({ sourceTexte: 'a'.repeat(1000), auteurNom: 'b'.repeat(40) });
    expect(nettoyerProposition({ ...base, sourceTexte: 'x', auteurNom: '<b></b>' }).auteurNom).toBeNull();
  });
});

describe('verdictDeContribution (la trace écrite à la validation)', () => {
  const c = { id: 'c1', sourceType: 'lbpc' as const, sourceTexte: 'Validé par le groupe', sourceDate: '2026-05-03', auteurNom: 'Sarah' };
  const valideeLe = new Date('2026-10-20T10:00:00Z');
  it('cite → cite, source LBPC, mention « communauté · LBPC », publié le jour de la source', () => {
    const v = verdictDeContribution({ ...c, statutPropose: 'cite' }, valideeLe);
    expect(v).toMatchObject({ niveau: 3, statut: 'cite', source: 'Les Bons Plans Cachères', mention: 'communauté · LBPC', valableJusquAu: null });
    expect(v.publieLe.toISOString()).toBe('2026-05-03T12:00:00.000Z');
    expect(v.detail).toMatchObject({ contributionId: 'c1', statutPropose: 'cite', validePar: 'console' });
  });
  it('non_cite → non_cite ; douteux → non_verifie — JAMAIS non_casher ; sans date de source, publié à la validation', () => {
    expect(verdictDeContribution({ ...c, statutPropose: 'non_cite' }, valideeLe).statut).toBe('non_cite');
    const d = verdictDeContribution({ ...c, statutPropose: 'douteux', sourceDate: null, sourceType: 'autre' }, valideeLe);
    expect(d).toMatchObject({ statut: 'non_verifie', source: 'Communauté Moutar', mention: 'signalé douteux' });
    expect(d.publieLe).toBe(valideeLe);
    expect(['cite', 'non_cite', 'non_verifie']).toContain(d.statut);
  });
});

const pub = (extra: Partial<ContributionPublique>): ContributionPublique => ({ id: 'x', statutPropose: 'cite', sourceType: 'lbpc', sourceTexte: 't', sourceDate: null, preuveUrl: null, auteurNom: null, valideeLe: '2026-10-20T10:00:00.000Z', ...extra });

describe('contributionFondatrice (la plus récente par le jour de sa source)', () => {
  it('le jour de la source d’abord, à défaut le jour de validation ; à jour égal, la validée en dernier ; null sans validée', () => {
    const a = pub({ id: 'a', sourceDate: '2026-05-03' });
    const b = pub({ id: 'b', sourceDate: '2026-09-01' });
    const c = pub({ id: 'c', sourceDate: null, valideeLe: '2026-10-20T10:00:00.000Z' });
    const d = pub({ id: 'd', sourceDate: '2026-09-01', valideeLe: '2026-10-21T10:00:00.000Z' });
    expect(contributionFondatrice([a, b])?.id).toBe('b');
    expect(contributionFondatrice([a, b, c])?.id).toBe('c');
    expect(contributionFondatrice([b, d])?.id).toBe('d');
    expect(contributionFondatrice([])).toBeNull();
  });
});

describe('schémas du public (zod)', () => {
  it('une proposition : statut parmi trois, source lbpc par défaut, date AAAA-MM-JJ, champs vides → null', () => {
    const c = schemaProposition.parse({ statutPropose: 'cite', sourceTexte: 'Validé', sourceDate: '', preuveUrl: '', auteurNom: '' });
    expect(c).toMatchObject({ statutPropose: 'cite', sourceType: 'lbpc', sourceDate: null, preuveUrl: null, auteurNom: null });
    expect(() => schemaProposition.parse({ statutPropose: 'non_casher', sourceTexte: 'x' })).toThrow();
    expect(() => schemaProposition.parse({ statutPropose: 'cite', sourceTexte: '' })).toThrow();
    expect(() => schemaProposition.parse({ statutPropose: 'cite', sourceTexte: 'x', sourceDate: '03/05/2026' })).toThrow();
    expect(() => schemaProposition.parse({ statutPropose: 'cite', sourceTexte: 'x'.repeat(1001) })).toThrow();
  });
  it('un signalement : niveau 1-4, texte ≤ 500', () => {
    expect(schemaSignalement.parse({ niveau: 2, texte: 'La marque n’est plus citée' })).toEqual({ niveau: 2, texte: 'La marque n’est plus citée' });
    expect(() => schemaSignalement.parse({ niveau: 5, texte: 'x' })).toThrow();
    expect(() => schemaSignalement.parse({ niveau: 1, texte: 'x'.repeat(501) })).toThrow();
  });
});
