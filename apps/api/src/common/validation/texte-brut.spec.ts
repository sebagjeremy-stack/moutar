import { describe, expect, it } from 'vitest';
import { texteBrut } from './texte-brut';

describe('texteBrut (texte libre du public, sans balise)', () => {
  it('retire les balises et garde le texte, sans échapper', () => {
    expect(texteBrut('<b>Validé</b> par le groupe <a href="https://x">ici</a>')).toBe('Validé par le groupe ici');
    expect(texteBrut('<script>alert(1)</script>Biscuits<style>.x{}</style>')).toBe('Biscuits');
    expect(texteBrut('a <img src=x onerror=alert(1)> b')).toBe('a b');
  });
  it('replie les espaces, garde les retours à la ligne (deux au plus), rogne les bords, retire les contrôles', () => {
    expect(texteBrut('  Publié le 3   mai\r\n\r\n\r\n\r\nsur LBPC\t!\u0000 ')).toBe('Publié le 3 mai\n\nsur LBPC !');
  });
  it('décode les entités courantes d’un collage ; un texte sans balise reste tel quel', () => {
    expect(texteBrut('Lait &amp; miel &lt;3')).toBe('Lait & miel <3');
    expect(texteBrut('Saint-Michel, galettes')).toBe('Saint-Michel, galettes');
  });
});
