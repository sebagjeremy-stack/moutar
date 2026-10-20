import { describe, expect, it } from 'vitest';
import type { SousLigneListe } from '@moutar/shared-types';
import { datesSousLigne, pastilleSousLigne, precisionSousLigne, SANS_LISTE } from './sous-lignes-regles';

const base: SousLigneListe = {
  listeId: 'l1',
  code: 'consistoire_paris',
  source: 'Consistoire de Paris — Produits 2025-2026',
  publieLe: '2025-07-01',
  valableJusquAu: '2026-07-31',
  statut: 'cite',
  confiance: 'forte',
  mention: null,
  detail: '',
  ligne: { id: 'x', rubrique: 'BISCUITS SECS', marque: 'Lu', produitLibelle: null },
};

describe('pastilleSousLigne : statut → ton + mot', () => {
  it('cité, confiance forte → vert « Cité »', () => {
    expect(pastilleSousLigne(base)).toEqual({ ton: 'ok', mot: 'Cité' });
  });
  it('cité avec mention → vert « Cité · lait non surveillé »', () => {
    expect(pastilleSousLigne({ ...base, mention: 'lait non surveillé' })).toEqual({ ton: 'ok', mot: 'Cité · lait non surveillé' });
  });
  it('cité, confiance faible → vert, « à vérifier » dans la pastille', () => {
    expect(pastilleSousLigne({ ...base, confiance: 'faible' })).toEqual({ ton: 'ok', mot: 'Cité · à vérifier' });
    expect(pastilleSousLigne({ ...base, confiance: 'faible', mention: 'lait non surveillé' }).mot).toBe('Cité · lait non surveillé · à vérifier');
  });
  it('cité par rubrique → vert « Cité par rubrique »', () => {
    expect(pastilleSousLigne({ ...base, statut: 'cite_par_rubrique', confiance: 'faible' })).toEqual({ ton: 'ok', mot: 'Cité par rubrique' });
  });
  it('périmé → ambre « Cité · liste périmée », jamais vert, même avec mention', () => {
    expect(pastilleSousLigne({ ...base, statut: 'perime', mention: 'lait non surveillé' })).toEqual({ ton: 'warn', mot: 'Cité · liste périmée' });
  });
  it('non cité → neutre « Non cité », jamais rouge', () => {
    expect(pastilleSousLigne({ ...base, statut: 'non_cite', confiance: null, ligne: null })).toEqual({ ton: 'neutre', mot: 'Non cité' });
  });
  it('aucune liste active → une ligne ambre avec son mot', () => {
    expect(SANS_LISTE).toEqual({ ton: 'warn', mot: 'Non vérifié · aucune liste importée' });
  });
  it('aucune pastille sans mot, quel que soit le statut', () => {
    for (const statut of ['cite', 'cite_par_rubrique', 'perime', 'non_cite'] as const) {
      expect(pastilleSousLigne({ ...base, statut }).mot.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('datesSousLigne', () => {
  it('publication et validité en JJ/MM/AAAA', () => {
    expect(datesSousLigne(base)).toBe('publiée le 01/07/2025 · valable jusqu’au 31/07/2026');
  });
  it('sans date de fin → « sans date de fin annoncée »', () => {
    expect(datesSousLigne({ ...base, valableJusquAu: null })).toBe('publiée le 01/07/2025 · sans date de fin annoncée');
  });
  it('périmée → « expirée le »', () => {
    expect(datesSousLigne({ ...base, statut: 'perime', valableJusquAu: '2025-11-01' })).toBe('publiée le 01/07/2025 · expirée le 01/11/2025');
  });
  it('sans date de publication → le dit', () => {
    expect(datesSousLigne({ ...base, publieLe: null })).toBe('date de publication non indiquée · valable jusqu’au 31/07/2026');
  });
});

describe('precisionSousLigne', () => {
  it('marque seule, forte', () => {
    expect(precisionSousLigne(base)).toBe('La marque « Lu » est nommée sous la rubrique « BISCUITS SECS ».');
  });
  it('marque seule, faible → invite à vérifier', () => {
    expect(precisionSousLigne({ ...base, confiance: 'faible' })).toBe('La marque « Lu » est nommée sous la rubrique « BISCUITS SECS ». Vérifiez que ce produit en relève.');
  });
  it('marque et produit', () => {
    expect(precisionSousLigne({ ...base, ligne: { id: 'y', rubrique: 'Biscuits', marque: 'Lu', produitLibelle: 'Petit Beurre' } })).toBe('« Lu — Petit Beurre » nommé sous la rubrique « Biscuits ».');
  });
  it('par rubrique → toute marque autorisée', () => {
    expect(precisionSousLigne({ ...base, statut: 'cite_par_rubrique', confiance: 'faible', ligne: { id: 'z', rubrique: 'YAOURTS', marque: null, produitLibelle: null } })).toBe('Rubrique « YAOURTS » sans marque nommée : toute marque autorisée.');
  });
  it('périmé → attendre l’édition suivante', () => {
    expect(precisionSousLigne({ ...base, statut: 'perime' })).toBe('La marque « Lu » est nommée sous la rubrique « BISCUITS SECS ». Attendre l’édition suivante.');
  });
  it('non cité → rien (la pastille suffit)', () => {
    expect(precisionSousLigne({ ...base, statut: 'non_cite', confiance: null, ligne: null })).toBeNull();
  });
});
