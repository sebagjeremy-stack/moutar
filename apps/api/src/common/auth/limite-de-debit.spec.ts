import { describe, expect, it } from 'vitest';
import { LimiteDeDebit } from './limite-de-debit';

describe('LimiteDeDebit', () => {
  it('permet N tentatives puis refuse, par clé', () => {
    let t = 0;
    const l = new LimiteDeDebit(3, 1000, () => t);
    expect(l.tenter('a')).toBe(true);
    expect(l.tenter('a')).toBe(true);
    expect(l.tenter('a')).toBe(true);
    expect(l.tenter('a')).toBe(false);
    expect(l.tenter('b')).toBe(true);
    expect(l.restantes('a')).toBe(0);
  });
  it('libère après la fenêtre', () => {
    let t = 0;
    const l = new LimiteDeDebit(1, 1000, () => t);
    expect(l.tenter('a')).toBe(true);
    expect(l.tenter('a')).toBe(false);
    t = 1001;
    expect(l.tenter('a')).toBe(true);
  });
  it('oublier remet le compteur d’une clé à zéro', () => {
    const l = new LimiteDeDebit(1, 1000, () => 0);
    expect(l.tenter('a')).toBe(true);
    expect(l.tenter('a')).toBe(false);
    l.oublier('a');
    expect(l.tenter('a')).toBe(true);
    expect(l.restantes('b')).toBe(1);
  });
  it('un refus ne consomme pas une tentative supplémentaire', () => {
    let t = 0;
    const l = new LimiteDeDebit(1, 1000, () => t);
    l.tenter('a');
    l.tenter('a');
    l.tenter('a');
    t = 1001;
    expect(l.tenter('a')).toBe(true);
  });
});
