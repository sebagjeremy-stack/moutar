import { describe, expect, it } from 'vitest';
import type { LigneAnalysee } from '@moutar/shared-types';
import { incoherenceLigne, numerosIncoherents } from './lignes-regles';

const l = (x: Partial<LigneAnalysee>): LigneAnalysee => ({ rubrique: 'BISCUITS', marque: 'Lu', produitLibelle: null, mention: null, touteMarque: false, rubriqueReservee: false, ordre: 0, ...x });

describe('incoherenceLigne', () => {
  it('une marque sous une rubrique : cohérente', () => expect(incoherenceLigne(l({}))).toBeNull());
  it('toute marque sans marque ni produit : cohérente', () => expect(incoherenceLigne(l({ marque: null, touteMarque: true }))).toBeNull());
  it('toute marque AVEC une marque : incohérente', () => expect(incoherenceLigne(l({ touteMarque: true }))).toMatch(/exclut/));
  it('toute marque sous une rubrique réservée : incohérente', () => expect(incoherenceLigne(l({ marque: null, touteMarque: true, rubriqueReservee: true }))).toMatch(/réservée/));
  it('ni marque, ni produit, ni toute marque : incohérente', () => expect(incoherenceLigne(l({ marque: '  ' }))).toMatch(/Nommez/));
  it('rubrique vide : incohérente', () => expect(incoherenceLigne(l({ rubrique: '' }))).toMatch(/rubrique/));
  it('numérote les lignes incohérentes à partir de 1', () => {
    expect(numerosIncoherents([l({}), l({ marque: null }), l({ touteMarque: true })])).toEqual([2, 3]);
  });
});
