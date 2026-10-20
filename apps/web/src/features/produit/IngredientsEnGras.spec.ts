import { describe, expect, it } from 'vitest';
import { decouperIngredients } from './IngredientsEnGras';

describe('decouperIngredients', () => {
  it('met les codes E en gras, mots entiers', () => {
    const s = decouperIngredients('sucre, E322 (lécithines), E 500, vitamine E', ['E322', 'E500']);
    expect(s.filter((x) => x.gras).map((x) => x.texte)).toEqual(['E322', 'E 500']);
    expect(s.map((x) => x.texte).join('')).toBe('sucre, E322 (lécithines), E 500, vitamine E');
  });
  it('sans code : un seul segment', () => {
    expect(decouperIngredients('sel', [])).toEqual([{ texte: 'sel', gras: false }]);
  });
});
