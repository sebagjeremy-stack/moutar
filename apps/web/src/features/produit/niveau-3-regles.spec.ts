import { describe, expect, it } from 'vitest';
import { datesContribution, nomSource, pastilleContribution, sourceTronquee } from './niveau-3-regles';

describe('pastilleContribution (statut → ton + mot, jamais rouge)', () => {
  it.each([
    ['cite', 'lbpc', 'ok', 'Cité comme permis · LBPC'],
    ['douteux', 'lbpc', 'warn', 'Signalé douteux · LBPC'],
    ['non_cite', 'lbpc', 'neutre', 'Non cité · LBPC'],
    ['cite', 'autre', 'ok', 'Cité comme permis · communauté'],
    ['douteux', 'autre', 'warn', 'Signalé douteux · communauté'],
    ['non_cite', 'autre', 'neutre', 'Non cité · communauté'],
  ] as const)('%s · %s → %s « %s »', (statut, source, ton, mot) => {
    expect(pastilleContribution(statut, source)).toEqual({ ton, mot });
  });

  it('ne rend jamais le ton « danger »', () => {
    for (const statut of ['cite', 'douteux', 'non_cite'] as const) for (const source of ['lbpc', 'autre'] as const) expect(pastilleContribution(statut, source).ton).not.toBe('danger');
  });

  it('nomme la source en entier', () => {
    expect(nomSource('lbpc')).toBe('Les Bons Plans Cachères');
    expect(nomSource('autre')).toBe('Communauté Moutar');
  });
});

describe('sourceTronquee', () => {
  it('garde un texte court tel quel, espaces repliés', () => {
    expect(sourceTronquee('  OK  selon\n le Rav ')).toBe('OK selon le Rav');
  });
  it('tronque avec une ellipse à la borne', () => {
    const long = 'a'.repeat(250);
    const t = sourceTronquee(long, 200);
    expect(t).toHaveLength(200);
    expect(t.endsWith('…')).toBe(true);
  });
});

describe('datesContribution', () => {
  it('écrit la date de la source, la validation, le pseudonyme et la preuve', () => {
    expect(datesContribution({ sourceDate: '2026-05-03', valideeLe: '2026-10-21T10:00:00.000Z', auteurNom: 'Sarah', preuveUrl: 'https://www.facebook.com/x' })).toBe('Source datée du 03/05/2026 · validée le 21/10/2026 · proposée par « Sarah » · preuve jointe');
  });
  it('dit « Source non datée » et tait ce qui manque', () => {
    expect(datesContribution({ sourceDate: null, valideeLe: '2026-10-21T10:00:00.000Z', auteurNom: null, preuveUrl: null })).toBe('Source non datée · validée le 21/10/2026');
  });
});
