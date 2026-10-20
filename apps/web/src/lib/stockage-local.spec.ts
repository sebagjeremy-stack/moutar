import { describe, expect, it } from 'vitest';
import { ajouterAHistorique, HISTORIQUE_MAX, type EntreeHistorique } from './stockage-local';

const e = (ean: string): EntreeHistorique => ({ ean, nom: ean, marque: null, pastille: 'Non vérifié', ton: 'warn', le: '2026-10-20T10:00:00Z' });

describe('ajouterAHistorique', () => {
  it('met en tête, sans doublon, borné à 20', () => {
    let liste: EntreeHistorique[] = [];
    for (let i = 0; i < 25; i++) liste = ajouterAHistorique(liste, e(String(i)));
    expect(liste).toHaveLength(HISTORIQUE_MAX);
    expect(liste[0].ean).toBe('24');
    liste = ajouterAHistorique(liste, e('10'));
    expect(liste[0].ean).toBe('10');
    expect(liste.filter((x) => x.ean === '10')).toHaveLength(1);
  });
});
