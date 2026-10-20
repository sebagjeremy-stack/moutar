import { describe, expect, it } from 'vitest';
import { CERTIFICATEURS, CERTIFICATEURS_PAR_CODE, LIBELLES_MENTIONS_CERTIFICATION, MENTIONS_CERTIFICATION, libelleMentionCertification } from './certificateurs';

describe('catalogue des certificateurs', () => {
  it('compte les dix du cadrage, codes uniques', () => {
    expect(CERTIFICATEURS).toHaveLength(10);
    expect(new Set(CERTIFICATEURS.map((c) => c.code)).size).toBe(10);
    for (const c of CERTIFICATEURS) expect(c.code).toMatch(/^[a-z_]+$/);
    expect(CERTIFICATEURS_PAR_CODE.get('ou')?.nomCourt).toBe('OU');
  });
  it('ne porte que des mentions connues, chacune avec son libellé', () => {
    for (const c of CERTIFICATEURS) for (const m of c.mentionsPossibles) expect(MENTIONS_CERTIFICATION).toContain(m);
    for (const m of MENTIONS_CERTIFICATION) expect(LIBELLES_MENTIONS_CERTIFICATION[m]).toBeTruthy();
    expect(libelleMentionCertification('parve')).toBe('parvé');
    expect(libelleMentionCertification('inconnue')).toBeNull();
  });
  it('chaque ligne a des mots-clés, un nom court et une forme décrite', () => {
    for (const c of CERTIFICATEURS) {
      expect(c.motsCles.length).toBeGreaterThan(0);
      expect(c.nomCourt.trim()).not.toBe('');
      expect(c.formeDuLogo.trim()).not.toBe('');
    }
    // Un mot-clé LONG est propre à un organisme (sinon la correspondance hésiterait) ; un mot-clé court (« K ») peut être
    // partagé, la forme du logo tranche.
    const vus = new Map<string, string>();
    for (const c of CERTIFICATEURS) {
      for (const mot of c.motsCles) {
        const n = mot.toLowerCase();
        if (n.length <= 2) continue;
        expect(vus.get(n), `« ${mot} » est partagé par ${vus.get(n)} et ${c.code}`).toBeUndefined();
        vus.set(n, c.code);
      }
    }
  });
});
