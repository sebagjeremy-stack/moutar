import { describe, expect, it } from 'vitest';
import { debutDuJour, jourLocal } from './jour-local';

describe('jourLocal (le jour de la pendule du centre)', () => {
  it('rend un jour ISO AAAA-MM-JJ', () => {
    expect(jourLocal(new Date('2026-10-20T10:00:00Z'))).toBe('2026-10-20');
  });
  it('entre minuit et deux heures à Paris, ce n’est plus la veille de Greenwich', () => {
    expect(jourLocal(new Date('2026-10-31T23:30:00Z'))).toBe('2026-11-01');
    expect(new Date('2026-10-31T23:30:00Z').toISOString().slice(0, 10)).toBe('2026-10-31');
  });
  it('en hiver aussi (UTC+1) ; un autre fuseau se demande explicitement', () => {
    expect(jourLocal(new Date('2026-01-31T23:30:00Z'))).toBe('2026-02-01');
    expect(jourLocal(new Date('2026-01-31T23:30:00Z'), 'UTC')).toBe('2026-01-31');
  });
});

describe('debutDuJour (minuit à la pendule du centre)', () => {
  it('en été, minuit à Paris est 22 h UTC la veille ; en hiver, 23 h', () => {
    expect(debutDuJour('2026-10-20').toISOString()).toBe('2026-10-19T22:00:00.000Z');
    expect(debutDuJour('2026-01-15').toISOString()).toBe('2026-01-14T23:00:00.000Z');
    expect(debutDuJour('2026-10-20', 'UTC').toISOString()).toBe('2026-10-20T00:00:00.000Z');
  });
  it('le jour local de cet instant est bien le jour demandé, et l’instant d’avant est la veille', () => {
    const debut = debutDuJour('2026-03-29');
    expect(jourLocal(debut)).toBe('2026-03-29');
    expect(jourLocal(new Date(debut.getTime() - 1))).toBe('2026-03-28');
  });
});
