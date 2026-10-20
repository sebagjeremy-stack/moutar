import { describe, expect, it } from 'vitest';
import { formaterEan, formaterJour, formaterJourCivil, jourLocal, quand } from './dates';

describe('dates', () => {
  const ref = new Date(2026, 9, 20, 12);
  it('quand : aujourd’hui, hier, jour de la semaine, date', () => {
    expect(quand(new Date(2026, 9, 20, 8).toISOString(), ref)).toBe('aujourd’hui');
    expect(quand(new Date(2026, 9, 19, 23).toISOString(), ref)).toBe('hier');
    expect(quand(new Date(2026, 9, 17, 9).toISOString(), ref)).toBe('samedi');
    expect(quand(new Date(2026, 9, 1).toISOString(), ref)).toBe('01/10/2026');
  });
  it('formate un jour et un EAN', () => {
    expect(formaterJour('2026-10-20T10:00:00Z')).toBe('20/10/2026');
    expect(formaterEan('3000000000000')).toBe('3 000 000 000 000');
    expect(formaterEan(null)).toBe('');
  });
  it('formate un jour civil sans fuseau, et le jour local', () => {
    expect(formaterJourCivil('2026-07-01')).toBe('01/07/2026');
    expect(formaterJourCivil(null)).toBe('');
    expect(formaterJourCivil('2026-10-20T10:00:00Z')).toBe('20/10/2026');
    expect(jourLocal(new Date(2026, 0, 3, 0, 30))).toBe('2026-01-03');
  });
});
