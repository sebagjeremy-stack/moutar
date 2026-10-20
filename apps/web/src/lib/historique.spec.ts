import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ajouterAHistorique, effacerHistorique, HISTORIQUE_MAX, lireHistorique, noterDansHistorique, retirerDeHistorique, retirerEntreeHistorique, trierRecentDAbord, type EntreeHistorique } from './historique';

const e = (ean: string, le = '2026-10-20T10:00:00Z'): EntreeHistorique => ({ ean, nom: `Produit ${ean}`, marque: null, pastille: 'Non vérifié', ton: 'warn', le });

describe('ajouterAHistorique (pure)', () => {
  it('met en tête, sans doublon d’EAN, borné à 20', () => {
    let liste: EntreeHistorique[] = [];
    for (let i = 0; i < 25; i++) liste = ajouterAHistorique(liste, e(String(i)));
    expect(liste).toHaveLength(HISTORIQUE_MAX);
    expect(liste[0].ean).toBe('24');
    liste = ajouterAHistorique(liste, e('10'));
    expect(liste[0].ean).toBe('10');
    expect(liste.filter((x) => x.ean === '10')).toHaveLength(1);
  });

  it('un même EAN revu remplace l’ancienne entrée (pastille à jour)', () => {
    const liste = ajouterAHistorique([e('1')], { ...e('1'), pastille: 'Permis · OU', ton: 'ok' });
    expect(liste).toHaveLength(1);
    expect(liste[0].pastille).toBe('Permis · OU');
  });
});

describe('retirerDeHistorique et trierRecentDAbord (pures)', () => {
  it('retire une ligne par EAN, ne touche à rien sinon', () => {
    const liste = [e('1'), e('2'), e('3')];
    expect(retirerDeHistorique(liste, '2').map((x) => x.ean)).toEqual(['1', '3']);
    expect(retirerDeHistorique(liste, '9')).toHaveLength(3);
  });

  it('trie la plus récente en tête', () => {
    const liste = [e('a', '2026-10-01T00:00:00Z'), e('b', '2026-10-20T00:00:00Z'), e('c', '2026-10-10T00:00:00Z')];
    expect(trierRecentDAbord(liste).map((x) => x.ean)).toEqual(['b', 'c', 'a']);
  });
});

describe('stockage sur le téléphone', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('note, relit, retire une ligne, efface tout', () => {
    noterDansHistorique(e('1', '2026-10-20T10:00:00Z'));
    noterDansHistorique(e('2', '2026-10-20T11:00:00Z'));
    expect(lireHistorique().map((x) => x.ean)).toEqual(['2', '1']);
    expect(retirerEntreeHistorique('2').map((x) => x.ean)).toEqual(['1']);
    expect(lireHistorique().map((x) => x.ean)).toEqual(['1']);
    effacerHistorique();
    expect(lireHistorique()).toEqual([]);
    expect(localStorage.getItem('moutar_historique')).toBeNull();
  });

  it('un stockage altéré ne casse rien : les entrées mal formées sont ignorées', () => {
    localStorage.setItem('moutar_historique', JSON.stringify([{ ean: '1' }, e('2'), 'x', { ...e('3'), ton: 'rose' }]));
    expect(lireHistorique().map((x) => x.ean)).toEqual(['2']);
    localStorage.setItem('moutar_historique', '{pas du json');
    expect(lireHistorique()).toEqual([]);
  });

  it('ne garde rien de personnel : seulement ean, nom, marque, pastille, ton, instant', () => {
    noterDansHistorique(e('1'));
    const brut = JSON.parse(localStorage.getItem('moutar_historique') ?? '[]') as Record<string, unknown>[];
    expect(Object.keys(brut[0]).sort()).toEqual(['ean', 'le', 'marque', 'nom', 'pastille', 'ton']);
  });
});
