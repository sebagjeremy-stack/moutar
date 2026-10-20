import { describe, expect, it } from 'vitest';
import { extraireCodesE } from '../analyse/analyse-composition-regles';
import { nettoyerOcr, normaliserCodesE, recollerLignes } from './nettoyage-ocr';

describe('nettoyage OCR (pur)', () => {
  it('« E 1 2 0 » → E120 ; « e 3 0 6 » → E306', () => {
    expect(normaliserCodesE('colorant : E 1 2 0, antioxydant : e 3 0 6.')).toBe('colorant : E120, antioxydant : E306.');
  });
  it('« E-322 », « e471 », « E 500 » → E322, E471, E500', () => {
    expect(normaliserCodesE('émulsifiant E-322, e471, poudre à lever E 500')).toBe('émulsifiant E322, E471, poudre à lever E500');
  });
  it('« E 472 e » → E472e ; « E450i » reste lisible par l’analyse ; un code à quatre chiffres tient', () => {
    expect(normaliserCodesE('E 472 e, E450i, E 1 4 2 2')).toBe('E472e, E450i, E1422');
  });
  it('ne touche pas « de 2024 », « sucre 3 0 6 », « 250 g e », ni un code suivi d’une lettre hors suffixe', () => {
    expect(normaliserCodesE('lot de 2024, sucre 3 0 6, 250 g e')).toBe('lot de 2024, sucre 3 0 6, 250 g e');
    expect(normaliserCodesE('E100x')).toBe('E100x');
  });
  it('recolle une césure en fin de ligne et remplace les retours à la ligne par une espace', () => {
    expect(recollerLignes('émul-\nsifiant : lécithine\nde SOJA')).toBe('émulsifiant : lécithine de SOJA');
    expect(recollerLignes('Saint-\nMichel')).toBe('Saint- Michel');
  });
  it('réduit les espaces et retire l’espace avant une virgule', () => {
    expect(nettoyerOcr('farine  de blé ,  sucre ;\n\nsel .')).toBe('farine de blé, sucre; sel.');
  });
  it('le texte nettoyé est lu par l’analyse du lot 1 (codes espacés compris)', () => {
    const texte = nettoyerOcr('INGRÉDIENTS : sucre, colorant : E 1 2 0, émulsifiant E-322, gélifiant : E-441 (géla-\ntine).');
    expect(texte).toBe('INGRÉDIENTS : sucre, colorant : E120, émulsifiant E322, gélifiant : E441 (gélatine).');
    expect(extraireCodesE(texte)).toEqual(['E120', 'E322', 'E441']);
  });
  it('un texte vide ou blanc rend une chaîne vide', () => {
    expect(nettoyerOcr('  \n ')).toBe('');
  });
});
