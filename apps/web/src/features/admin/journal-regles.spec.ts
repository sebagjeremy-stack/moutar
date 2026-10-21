import { describe, expect, it } from 'vitest';
import { ENTREES_DETAIL_MAX, entreesDetail } from './journal-regles';

describe('entreesDetail : le détail du journal en « clé : valeur », aplati, six entrées au plus', () => {
  it('aplatit les objets imbriqués, écrit les booléens et les vides en mots, joint les listes', () => {
    const { entrees, tronque } = entreesDetail({ statut: 'douteux', source: 'liste', note: null, actif: false, produit: { nom: 'Petit Beurre', ean: null }, mentions: ['parvé', 'halavi'] });
    expect(entrees).toEqual([
      ['statut', 'douteux'],
      ['source', 'liste'],
      ['note', '—'],
      ['actif', 'non'],
      ['produit.nom', 'Petit Beurre'],
      ['produit.ean', '—'],
    ]);
    expect(tronque).toBe(true);
    expect(ENTREES_DETAIL_MAX).toBe(6);
  });
  it('un détail vide, null ou qui n’est pas un objet ne donne aucune entrée ; au plus six entrées puis « tronqué »', () => {
    expect(entreesDetail({})).toEqual({ entrees: [], tronque: false });
    expect(entreesDetail(null)).toEqual({ entrees: [], tronque: false });
    expect(entreesDetail(['a'])).toEqual({ entrees: [], tronque: false });
    const sept = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`c${i}`, i]));
    const r = entreesDetail(sept);
    expect(r.entrees).toHaveLength(6);
    expect(r.entrees[5]).toEqual(['c5', '5']);
    expect(r.tronque).toBe(true);
    expect(entreesDetail({ a: 1 }).tronque).toBe(false);
  });
});
