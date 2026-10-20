import { describe, expect, it } from 'vitest';
import { CERTIFICATEURS, MENTIONS_CERTIFICATION } from './certificateurs';

describe('catalogue des certificateurs', () => {
  it('compte les dix du cadrage, codes uniques', () => {
    expect(CERTIFICATEURS).toHaveLength(10);
    expect(new Set(CERTIFICATEURS.map((c) => c.code)).size).toBe(10);
    for (const c of CERTIFICATEURS) expect(c.code).toMatch(/^[a-z_]+$/);
  });
  it('ne porte que des mentions connues', () => {
    for (const c of CERTIFICATEURS) for (const m of c.mentions) expect(MENTIONS_CERTIFICATION).toContain(m);
  });
});
