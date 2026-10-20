import { describe, expect, it } from 'vitest';
import { motsDeRecherche } from './recherche.service';

describe('motsDeRecherche (recherche publique)', () => {
  it('normalise : accents, casse, ponctuation ; coupe en mots', () => {
    expect(motsDeRecherche('Bisc')).toEqual(['bisc']);
    expect(motsDeRecherche('  Saint-Michel ')).toEqual(['saint', 'michel']);
    expect(motsDeRecherche('PÂTES à tartiner')).toEqual(['pates', 'a', 'tartiner']);
  });
  it('moins de trois caractères utiles → 400 recherche_trop_courte', () => {
    for (const q of ['', 'lu', ' l u ', '--', 'é!']) expect(() => motsDeRecherche(q)).toThrow(expect.objectContaining({ status: 400 }));
  });
});
