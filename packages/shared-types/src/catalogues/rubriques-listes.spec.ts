import { describe, expect, it } from 'vitest';
import { MOTS_VIDES_RUBRIQUE, RUBRIQUES_RESERVEES, libelleMention } from './rubriques-listes';

describe('catalogue des rubriques des listes', () => {
  it('garde les cinq familles du cadrage sous surveillance', () => {
    const mots = RUBRIQUES_RESERVEES.map((r) => r.mot);
    for (const attendu of ['viande', 'charcuterie', 'vin', 'jus de raisin', 'fromage']) expect(mots).toContain(attendu);
  });
  it('les mots réservés sont en minuscules, sans accent, uniques', () => {
    const mots = RUBRIQUES_RESERVEES.map((r) => r.mot);
    expect(new Set(mots).size).toBe(mots.length);
    for (const m of mots) expect(m).toBe(m.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));
  });
  it('les mots vides ne contiennent aucun nom de famille', () => {
    for (const r of RUBRIQUES_RESERVEES) expect(MOTS_VIDES_RUBRIQUE.has(r.mot)).toBe(false);
  });
  it('libelleMention : code connu, texte libre, rien', () => {
    expect(libelleMention('lait_non_surveille')).toBe('lait non surveillé');
    expect(libelleMention('sauf la gamme bio')).toBe('sauf la gamme bio');
    expect(libelleMention(null)).toBeNull();
  });
});
