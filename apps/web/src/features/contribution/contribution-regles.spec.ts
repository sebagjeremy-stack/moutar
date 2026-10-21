import { describe, expect, it } from 'vitest';
import { corpsProposition, dateAdmise, erreursProposition, jourReel, preuveAdmise, preuveGardee, pseudonymeAdmis, texteSourceAdmis } from './contribution-regles';

const AUJOURDHUI = '2026-10-20';

describe('pseudonymeAdmis (un pseudonyme, pas un e-mail)', () => {
  it('admet le vide et un pseudonyme court', () => {
    expect(pseudonymeAdmis('')).toBe(true);
    expect(pseudonymeAdmis('  Sarah ')).toBe(true);
  });
  it('refuse un « @ » et un pseudonyme trop long', () => {
    expect(pseudonymeAdmis('sarah@exemple.fr')).toBe(false);
    expect(pseudonymeAdmis('a'.repeat(41))).toBe(false);
    expect(pseudonymeAdmis('a'.repeat(40))).toBe(true);
  });
});

describe('dateAdmise (≤ aujourd’hui, un jour réel)', () => {
  it('admet le vide, aujourd’hui et un jour passé', () => {
    expect(dateAdmise('', AUJOURDHUI)).toBe(true);
    expect(dateAdmise(AUJOURDHUI, AUJOURDHUI)).toBe(true);
    expect(dateAdmise('2026-05-03', AUJOURDHUI)).toBe(true);
  });
  it('refuse demain, un jour qui n’existe pas et un autre format', () => {
    expect(dateAdmise('2026-10-21', AUJOURDHUI)).toBe(false);
    expect(dateAdmise('2026-04-31', AUJOURDHUI)).toBe(false);
    expect(dateAdmise('2026-13-01', AUJOURDHUI)).toBe(false);
    expect(dateAdmise('03/05/2026', AUJOURDHUI)).toBe(false);
  });
  it('connaît les années bissextiles', () => {
    expect(jourReel('2024-02-29')).toBe(true);
    expect(jourReel('2026-02-29')).toBe(false);
    expect(jourReel('2100-02-29')).toBe(false);
  });
});

describe('preuveAdmise (https, hôte permis ou sous-domaine)', () => {
  it('admet le vide, facebook.com, ses sous-domaines et lesbonsplanscachers.fr', () => {
    expect(preuveAdmise('')).toBe(true);
    expect(preuveAdmise('https://www.facebook.com/groups/lbpc/posts/1')).toBe(true);
    expect(preuveAdmise('https://m.facebook.com/x')).toBe(true);
    expect(preuveAdmise('https://www.lesbonsplanscachers.fr/produit')).toBe(true);
  });
  it('refuse http, un autre hôte, un hôte qui finit pareil, javascript: et un texte', () => {
    expect(preuveAdmise('http://facebook.com/x')).toBe(false);
    expect(preuveAdmise('https://example.org/facebook.com')).toBe(false);
    expect(preuveAdmise('https://notfacebook.com/x')).toBe(false);
    expect(preuveAdmise('javascript:alert(1)')).toBe(false);
    expect(preuveAdmise('pas une adresse')).toBe(false);
    expect(preuveAdmise('https://user:pass@facebook.com/x')).toBe(false);
  });
});

describe('texteSourceAdmis (≤ 1 000)', () => {
  it('refuse le vide et au-delà de 1 000, admet 1 000', () => {
    expect(texteSourceAdmis('   ')).toBe(false);
    expect(texteSourceAdmis('a'.repeat(1001))).toBe(false);
    expect(texteSourceAdmis('a'.repeat(1000))).toBe(true);
  });
});

describe('erreursProposition', () => {
  it('rend {} quand tout est admis', () => {
    expect(erreursProposition({ sourceTexte: 'OK selon le Rav', sourceDate: '', preuveUrl: '', auteurNom: '' }, AUJOURDHUI)).toEqual({});
  });
  it('nomme chaque champ fautif, en français', () => {
    const e = erreursProposition({ sourceTexte: '', sourceDate: '2027-01-01', preuveUrl: 'http://facebook.com', auteurNom: 'moi@x.fr' }, AUJOURDHUI);
    expect(Object.keys(e).sort()).toEqual(['auteurNom', 'preuveUrl', 'sourceDate', 'sourceTexte']);
    expect(e.auteurNom).toContain('@');
    expect(e.preuveUrl).toContain('https://');
  });
});

describe('corpsProposition', () => {
  it('ébarbe les textes et rend null les facultatifs vides', () => {
    expect(corpsProposition({ statutPropose: 'cite', sourceType: 'lbpc', sourceTexte: ' OK ', sourceDate: ' ', preuveUrl: '', auteurNom: ' Sarah ' })).toEqual({ statutPropose: 'cite', sourceType: 'lbpc', sourceTexte: 'OK', sourceDate: null, preuveUrl: null, auteurNom: 'Sarah' });
  });
});

describe('preuveGardee : le lien tel que le serveur le gardera (règle partagée), et s’il diffère', () => {
  it('retire fbclid et utm_*, dit que le lien a changé ; un lien propre reste tel quel ; vide → null ; refusé → tel quel', () => {
    expect(preuveGardee('https://www.facebook.com/groups/lbpc/posts/1?fbclid=IwAR0abc&utm_source=fb&comment_id=7')).toEqual({ lien: 'https://www.facebook.com/groups/lbpc/posts/1?comment_id=7', modifie: true });
    expect(preuveGardee(' https://m.facebook.com/x ')).toEqual({ lien: 'https://m.facebook.com/x', modifie: false });
    expect(preuveGardee('')).toBeNull();
    expect(preuveGardee('https://example.org/x')).toEqual({ lien: 'https://example.org/x', modifie: false });
  });
});
