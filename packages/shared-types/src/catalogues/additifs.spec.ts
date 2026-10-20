import { describe, expect, it } from 'vitest';
import { ADDITIFS, ADDITIFS_PAR_CODE, SOURCE_PROVISOIRE, SYNONYMES_ADDITIFS } from './additifs';

describe('catalogue des additifs', () => {
  it('a des codes uniques et bien formés', () => {
    const codes = ADDITIFS.map((a) => a.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of codes) expect(c).toMatch(/^E\d{3,4}[a-z]?$/);
    expect(ADDITIFS.length).toBeGreaterThanOrEqual(100);
  });
  it('a des statuts valides et une source sur chaque ligne', () => {
    for (const a of ADDITIFS) {
      expect(['casher', 'douteux', 'non_casher']).toContain(a.statut);
      expect(a.source).toBe(SOURCE_PROVISOIRE);
      expect(a.nom.length).toBeGreaterThan(0);
      expect(a.note.length).toBeGreaterThan(0);
    }
  });
  it('E441, E428, E120 et E542 sont non casher, E322 casher', () => {
    expect(ADDITIFS_PAR_CODE.get('E441')?.statut).toBe('non_casher');
    expect(ADDITIFS_PAR_CODE.get('E428')?.statut).toBe('non_casher');
    expect(ADDITIFS_PAR_CODE.get('E120')?.statut).toBe('non_casher');
    expect(ADDITIFS_PAR_CODE.get('E542')?.statut).toBe('non_casher');
    expect(ADDITIFS_PAR_CODE.get('E322')?.statut).toBe('casher');
  });
  it('les lignes relues le 20/10/2026 portent leur statut et leur note', () => {
    expect(ADDITIFS_PAR_CODE.get('E1105')?.note).toContain('l’œuf est parvé');
    expect(ADDITIFS_PAR_CODE.get('E920')).toMatchObject({ statut: 'douteux' });
    expect(ADDITIFS_PAR_CODE.get('E920')?.note).toContain('plumes de canard');
    expect(ADDITIFS_PAR_CODE.get('E901')).toMatchObject({ statut: 'douteux' });
    expect(ADDITIFS_PAR_CODE.get('E160a')).toMatchObject({ statut: 'douteux' });
    expect(ADDITIFS_PAR_CODE.get('E160a')?.note).toContain('gélatine');
    expect(ADDITIFS_PAR_CODE.get('E153')).toMatchObject({ statut: 'douteux', origineAnimalePossible: true });
    expect(ADDITIFS_PAR_CODE.get('E640')).toMatchObject({ statut: 'douteux' });
    for (const code of ['E270', 'E296']) {
      expect(ADDITIFS_PAR_CODE.get(code)).toMatchObject({ statut: 'casher' });
      expect(ADDITIFS_PAR_CODE.get(code)?.note).toContain('support possible');
    }
  });
  it('les ajouts du 20/10/2026 sont tous là (sels, acides, édulcorants, amidons, colorants végétaux : casher)', () => {
    const casher = ['E260', 'E262', 'E282', 'E340', 'E341', 'E401', 'E406', 'E420', 'E421', 'E950', 'E951', 'E952', 'E954', 'E955', 'E965', 'E967', 'E1404', 'E1412', 'E1414', 'E1422', 'E150c', 'E160b', 'E163'];
    for (const code of casher) expect(ADDITIFS_PAR_CODE.get(code)?.statut, code).toBe('casher');
  });
  it('une ligne « non casher » ou « douteuse » dit pourquoi (origine animale possible, sauf exception notée)', () => {
    for (const a of ADDITIFS) if (a.statut === 'non_casher') expect(a.origineAnimalePossible).toBe(true);
  });
  it('chaque synonyme pointe un code du catalogue ; « gélatine » pointe E441, jamais E428', () => {
    for (const s of SYNONYMES_ADDITIFS) expect(ADDITIFS_PAR_CODE.has(s.code)).toBe(true);
    expect(SYNONYMES_ADDITIFS.filter((s) => s.terme.test('gélatine')).map((s) => s.code)).toEqual(['E441']);
  });
});
