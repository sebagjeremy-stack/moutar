import { describe, expect, it } from 'vitest';
import { libelleNiveau, lireSeuil, normaliserCodeE } from './niveaux';

describe('niveaux', () => {
  it('lit le seuil, défaut 2', () => {
    expect(lireSeuil('3')).toBe(3);
    expect(lireSeuil(4)).toBe(4);
    expect(lireSeuil('7')).toBe(2);
    expect(lireSeuil(undefined)).toBe(2);
    expect(lireSeuil('abc', 1)).toBe(1);
  });
  it('libelle un niveau', () => {
    expect(libelleNiveau(2)).toBe('niveau 2 · Liste officielle');
  });
  it('normalise un code E', () => {
    expect(normaliserCodeE('en:e322i')).toBe('E322');
    expect(normaliserCodeE('E 160a')).toBe('E160a');
    expect(normaliserCodeE('e-441')).toBe('E441');
    expect(normaliserCodeE('E450ii')).toBe('E450');
    expect(normaliserCodeE('E1105')).toBe('E1105');
    expect(normaliserCodeE('sucre')).toBeNull();
  });
});
