import { describe, expect, it } from 'vitest';
import { DUREE_PROPOSITION_MS, hacherJeton, PropositionsEnAttente } from './propositions-en-attente';

function memoire(t0 = 1_000_000) {
  let t = t0;
  let n = 0;
  const p = new PropositionsEnAttente(() => t, () => `jeton-de-test-${++n}`);
  return { p, avancer: (ms: number) => (t += ms) };
}

describe('PropositionsEnAttente (jeton de proposition, haché, 15 min, consommé)', () => {
  it('émet un jeton en clair et ne le garde que haché ; il se consomme pour le même EAN et un code proposé, UNE fois', () => {
    const { p } = memoire();
    const jeton = p.emettre({ ean: '3017620422003', codes: ['ou', 'ok'] });
    expect(jeton).toBe('jeton-de-test-1');
    expect(p.taille).toBe(1);
    expect(p.consommer(jeton, '3017620422003', 'ok')).toBe(true);
    expect(p.consommer(jeton, '3017620422003', 'ok')).toBe(false);
    expect(p.taille).toBe(0);
  });
  it('refuse un jeton inconnu, un EAN différent, un code non proposé, un jeton sans produit (ean null)', () => {
    const { p } = memoire();
    const jeton = p.emettre({ ean: '3017620422003', codes: ['ou'] });
    expect(p.consommer('inconnu-xxxxx', '3017620422003', 'ou')).toBe(false);
    expect(p.consommer(jeton, '3017620422004', 'ou')).toBe(false);
    expect(p.consommer(jeton, '3017620422003', 'klbd')).toBe(false);
    // Les refus ne consomment pas : la bonne validation passe ensuite.
    expect(p.consommer(jeton, '3017620422003', 'ou')).toBe(true);
    const sansProduit = p.emettre({ ean: null, codes: ['ou'] });
    expect(p.consommer(sansProduit, '3017620422003', 'ou')).toBe(false);
  });
  it('expire après 15 minutes, et les expirés se purgent', () => {
    const { p, avancer } = memoire();
    const jeton = p.emettre({ ean: '1', codes: ['ou'] });
    avancer(DUREE_PROPOSITION_MS - 1);
    expect(p.taille).toBe(1);
    avancer(1);
    expect(p.taille).toBe(0);
    expect(p.consommer(jeton, '1', 'ou')).toBe(false);
  });
  it('le vrai aléa fait 16 octets en base64url (22 caractères), et l’empreinte est SHA-256 base64url', () => {
    const p = new PropositionsEnAttente();
    const jeton = p.emettre({ ean: '1', codes: ['ou'] });
    expect(jeton).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(hacherJeton(jeton)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(p.consommer(jeton, '1', 'ou')).toBe(true);
  });
});
