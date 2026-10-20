import { describe, expect, it } from 'vitest';
import { confianceEnMots } from './confiance-en-mots';

describe('confianceEnMots (pure)', () => {
  it('un mot-clé long sûr, ou un sigle court avec sa forme (0,9) → « très probable »', () => {
    expect(confianceEnMots(1)).toBe('très probable');
    expect(confianceEnMots(0.9)).toBe('très probable');
    expect(confianceEnMots(0.75)).toBe('très probable');
  });
  it('un nom lu hors symbole (0,6), ou un modèle hésitant → « probable »', () => {
    expect(confianceEnMots(0.6)).toBe('probable');
    expect(confianceEnMots(0.45)).toBe('probable');
    expect(confianceEnMots(0.74)).toBe('probable');
  });
  it('en dessous → « incertain » ; une valeur absurde aussi', () => {
    expect(confianceEnMots(0.44)).toBe('incertain');
    expect(confianceEnMots(0)).toBe('incertain');
    expect(confianceEnMots(Number.NaN)).toBe('incertain');
    expect(confianceEnMots(-3)).toBe('incertain');
  });
  it('au-delà de 1, borné', () => {
    expect(confianceEnMots(7)).toBe('très probable');
  });
});
