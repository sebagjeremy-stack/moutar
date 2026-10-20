import { Fragment } from 'react';

/** Pure : découpe un texte d'ingrédients en segments, les codes E repérés en gras. */
export function decouperIngredients(texte: string, codes: string[]): Array<{ texte: string; gras: boolean }> {
  if (codes.length === 0) return [{ texte, gras: false }];
  const motif = new RegExp(`(?<![\\p{L}\\p{N}])(?:${codes.map((c) => `e[\\s-]?${c.slice(1)}(?:[ivx]{1,4})?`).join('|')})(?![\\p{L}\\p{N}])`, 'giu');
  const segments: Array<{ texte: string; gras: boolean }> = [];
  let position = 0;
  for (const m of texte.matchAll(motif)) {
    const debut = m.index ?? 0;
    if (debut > position) segments.push({ texte: texte.slice(position, debut), gras: false });
    segments.push({ texte: m[0], gras: true });
    position = debut + m[0].length;
  }
  if (position < texte.length) segments.push({ texte: texte.slice(position), gras: false });
  return segments;
}

export function IngredientsEnGras({ texte, codes }: { texte: string; codes: string[] }) {
  return (
    <>
      {decouperIngredients(texte, codes).map((s, i) => (
        <Fragment key={i}>{s.gras ? <strong>{s.texte}</strong> : s.texte}</Fragment>
      ))}
    </>
  );
}
