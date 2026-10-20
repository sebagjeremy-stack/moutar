import { describe, expect, it } from 'vitest';
import type { LigneAnalysee } from '@moutar/shared-types';
import { incoherenceLigne, numerosIncoherents, rubriqueReservee } from './lignes-regles';

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

/* Même table de cas que `apps/api/src/modules/listes/analyse-liste.spec.ts` (miroir de la règle du serveur). */
describe('rubriqueReservee (miroir de la règle du serveur)', () => {
  it('viande, charcuterie, vin, jus de raisin, fromage (et pluriels) : réservées', () => {
    for (const r of ['VIANDES', 'Charcuterie fine', 'VINS ET SPIRITUEUX', 'Jus de raisin', 'FROMAGES', 'VINS', 'Vins fins']) expect(rubriqueReservee(r)).toBe(true);
  });
  it('les autres ne le sont pas, un mot contenu ne compte pas', () => {
    for (const r of ['BISCUITS SECS', 'Jus de fruits', 'VINAIGRES', 'Fromentine', '']) expect(rubriqueReservee(r)).toBe(false);
  });
});
