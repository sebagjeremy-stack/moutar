/**
 * Un texte LIBRE reçu du public (contribution, signalement) se garde en texte BRUT : balises retirées (pas échappées —
 * rien ne se réinterprète comme du HTML), caractères de contrôle retirés, espaces repliées, retours à la ligne gardés
 * (deux au plus de suite), bords rognés. Pur. L'écran, lui, n'injecte jamais de HTML : il affiche du texte.
 */
export function texteBrut(brut: string): string {
  let t = brut.replace(/\r\n?/g, '\n');
  // Un bloc script ou style part ENTIER (son contenu n'est pas du texte) ; puis les balises, même mal fermées ; puis les
  // entités les plus courantes qu'un collage apporte.
  t = t.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  for (let i = 0; i < 3 && /<[^>]*>/.test(t); i++) t = t.replace(/<[^>]*>/g, '');
  t = t.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/g, '’');
  // Les caractères de contrôle (sauf le retour à la ligne) et les espaces répétées.
  t = t.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '');
  t = t
    .split('\n')
    .map((l) => l.replace(/[ \t ]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
  return t.trim();
}
