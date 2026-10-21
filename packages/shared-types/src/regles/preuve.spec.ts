import { describe, expect, it } from 'vitest';
import { preuveModifiee, preuveUrlAdmise } from './preuve';

const HOTES = ['facebook.com', 'lesbonsplanscachers.fr'];

describe('preuveUrlAdmise (https, hôtes admis et leurs sous-domaines) — règle partagée serveur et écran', () => {
  it('admet facebook.com, m.facebook.com, www.lesbonsplanscachers.fr ; retire le fragment', () => {
    expect(preuveUrlAdmise('https://www.facebook.com/groups/lbpc/posts/1', HOTES)).toBe('https://www.facebook.com/groups/lbpc/posts/1');
    expect(preuveUrlAdmise(' https://m.facebook.com/x#frag ', HOTES)).toBe('https://m.facebook.com/x');
    expect(preuveUrlAdmise('https://lesbonsplanscachers.fr/produit/42?x=1', HOTES)).toBe('https://lesbonsplanscachers.fr/produit/42?x=1');
  });
  it('retire fbclid et utm_* de la preuve, garde les autres paramètres', () => {
    expect(preuveUrlAdmise('https://www.facebook.com/groups/lbpc/posts/1?fbclid=IwAR0abc&utm_source=fb&utm_medium=social&comment_id=7', HOTES)).toBe('https://www.facebook.com/groups/lbpc/posts/1?comment_id=7');
    expect(preuveUrlAdmise('https://lesbonsplanscachers.fr/p?UTM_CAMPAIGN=x', HOTES)).toBe('https://lesbonsplanscachers.fr/p');
  });
  it('refuse http, un hôte hors liste, un hôte qui finit pareil sans être un sous-domaine, javascript:, des identifiants, un texte', () => {
    expect(preuveUrlAdmise('http://www.facebook.com/x', HOTES)).toBeNull();
    expect(preuveUrlAdmise('https://example.org/facebook.com', HOTES)).toBeNull();
    expect(preuveUrlAdmise('https://notfacebook.com/x', HOTES)).toBeNull();
    expect(preuveUrlAdmise('https://facebook.com.evil.net/x', HOTES)).toBeNull();
    expect(preuveUrlAdmise('javascript:alert(1)', HOTES)).toBeNull();
    expect(preuveUrlAdmise('https://user:pass@facebook.com/x', HOTES)).toBeNull();
    expect(preuveUrlAdmise('voir le groupe', HOTES)).toBeNull();
    expect(preuveUrlAdmise('https://facebook.com/x', [])).toBeNull();
  });
  it('preuveModifiee : vrai quand le lien gardé diffère du lien saisi (pistage retiré), faux sinon', () => {
    const brut = 'https://www.facebook.com/groups/lbpc/posts/1?fbclid=IwAR0abc';
    expect(preuveModifiee(brut, preuveUrlAdmise(brut, HOTES)!)).toBe(true);
    const propre = 'https://www.facebook.com/groups/lbpc/posts/1';
    expect(preuveModifiee(` ${propre} `, preuveUrlAdmise(propre, HOTES)!)).toBe(false);
  });
});
