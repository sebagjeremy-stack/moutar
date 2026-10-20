import { describe, expect, it } from 'vitest';
import { contientMotsEntiers, mots, normaliser, partagentUnMot, radical } from './normalisation';

describe('normaliser (recherche et correspondance des listes)', () => {
  it('retire accents, casse et ponctuation', () => {
    expect(normaliser('  Saint-Michel  ')).toBe('saint michel');
    expect(normaliser('Pâtes à l’œuf / Bœuf')).toBe('pates a l oeuf boeuf');
    expect(normaliser('YAOURTS :')).toBe('yaourts');
    expect(normaliser(null)).toBe('');
  });
  it('découpe en mots', () => {
    expect(mots('Biscuits, secs ; salés')).toEqual(['biscuits', 'secs', 'sales']);
    expect(mots('')).toEqual([]);
  });
});

describe('contientMotsEntiers', () => {
  it('cherche en mots entiers, insensible aux accents', () => {
    expect(contientMotsEntiers('Biscuits Lu petit beurre', 'lu')).toBe(true);
    expect(contientMotsEntiers('Biscuits Lutine', 'Lu')).toBe(false);
    expect(contientMotsEntiers('Galettes Saint-Michel', 'saint michel')).toBe(true);
    expect(contientMotsEntiers('Saint Michel', 'michel saint')).toBe(false);
    expect(contientMotsEntiers('Pâtes', 'pates')).toBe(true);
  });
  it('un motif vide ne figure nulle part', () => {
    expect(contientMotsEntiers('Biscuits', '')).toBe(false);
    expect(contientMotsEntiers('', 'lu')).toBe(false);
  });
});

describe('radical et partagentUnMot', () => {
  it('fait tomber un pluriel régulier, garde les mots courts', () => {
    expect(radical('Biscuits')).toBe('biscuit');
    expect(radical('gâteaux')).toBe('gateau');
    expect(radical('vin')).toBe('vin');
    expect(radical('jus')).toBe('jus');
  });
  it('trouve un mot commun par radical, en ignorant les mots vides', () => {
    expect(partagentUnMot('YAOURTS', 'Yaourt nature 4 × 125 g')).toBe('yaourt');
    expect(partagentUnMot('BISCUITS SECS', 'Petit beurre')).toBeNull();
    expect(partagentUnMot('Pâtes à tartiner', 'Pâte à tartiner noisettes', new Set(['a']))).toBe('pate');
    expect(partagentUnMot('Jus de fruits', 'Compote de pommes', new Set(['de']))).toBeNull();
  });
});
