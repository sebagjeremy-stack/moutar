import { describe, expect, it } from 'vitest';
import { jourLocal } from './jour-local';

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
