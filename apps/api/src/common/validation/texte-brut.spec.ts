import { describe, expect, it } from 'vitest';
import { texteBrut } from './texte-brut';

describe('texteBrut (texte libre du public, sans balise)', () => {
  it('retire les balises et garde le texte, sans échapper', () => {
    expect(texteBrut('<b>Validé</b> par le groupe <a href="https://x">ici</a>')).toBe('Validé par le groupe ici');
    expect(texteBrut('<script>alert(1)</script>Biscuits<style>.x{}</style>')).toBe('Biscuits');
    expect(texteBrut('a <img src=x onerror=alert(1)> b')).toBe('a b');
  });
  it('décode les entités PUIS retire les balises, jusqu’au point fixe : « &lt;script&gt; » ne survit pas, ni « &amp;lt;b&amp;gt; »', () => {
    expect(texteBrut('&lt;script&gt;alert(1)&lt;/script&gt;Biscuits')).toBe('Biscuits');
    expect(texteBrut('&amp;lt;b&amp;gt;gras&amp;lt;/b&amp;gt;')).toBe('gras');
    expect(texteBrut('&#60;i&#x3e;x&#60;/i&#62;')).toBe('x');
    expect(texteBrut('&lt;3 et &amp; et &#233;t&#xE9;')).toBe('<3 et & et été');
  });
  it('retire les caractères de format invisibles (U+202E, BOM, ZWNJ) mais garde le ZWJ des emoji', () => {
    expect(texteBrut('Vali‮dé﻿ par‌ le groupe')).toBe('Validé par le groupe');
    expect(texteBrut('👨‍👩‍👧')).toBe('👨‍👩‍👧');
  });
  it('replie les espaces, garde les retours à la ligne (deux au plus), rogne les bords, retire les contrôles', () => {
    expect(texteBrut('  Publié le 3   mai\r\n\r\n\r\n\r\nsur LBPC\t!\u0000 ')).toBe('Publié le 3 mai\n\nsur LBPC !');
  });
  it('décode les entités courantes d’un collage ; un texte sans balise reste tel quel', () => {
    expect(texteBrut('Lait &amp; miel &lt;3')).toBe('Lait & miel <3');
    expect(texteBrut('Saint-Michel, galettes')).toBe('Saint-Michel, galettes');
    expect(texteBrut('R&D &inconnue; ok')).toBe('R&D &inconnue; ok');
  });
});
