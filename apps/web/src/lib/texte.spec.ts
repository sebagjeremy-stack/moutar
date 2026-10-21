import { describe, expect, it } from 'vitest';
import { accord, pluriel } from './texte';

describe('pluriel / accord : singulier pour 0 et 1, pluriel au-delà, nombre en français', () => {
  it('pluriel écrit le nombre et le mot accordé', () => {
    expect(pluriel(0, 'ouvert', 'ouverts')).toBe('0 ouvert');
    expect(pluriel(1, 'proposée', 'proposées')).toBe('1 proposée');
    expect(pluriel(2, 'ouvert', 'ouverts')).toBe('2 ouverts');
    expect(pluriel(1, 'dernière ligne', 'dernières lignes')).toBe('1 dernière ligne');
    expect(pluriel(1234, 'ligne', 'lignes')).toBe('1 234 lignes');
  });
  it('accord rend le mot seul', () => {
    expect(accord(1, 'additif', 'additifs')).toBe('additif');
    expect(accord(3, 'additif', 'additifs')).toBe('additifs');
    expect(accord(0, 'lu', 'lus')).toBe('lu');
  });
});
