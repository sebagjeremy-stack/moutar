/**
 * Un texte LIBRE reçu du public (contribution, signalement, texte lu d'un logo) se garde en texte BRUT : entités décodées
 * PUIS balises retirées, jusqu'au point fixe (« &lt;script&gt; » devient « <script> » qui tombe à son tour : rien ne se
 * réinterprète comme du HTML), caractères de contrôle et de FORMAT invisibles retirés (`\p{Cf}` : marques de direction
 * U+202E, joints sans largeur, BOM — sauf le ZWJ, qui compose les emoji), espaces repliées, retours à la ligne gardés (deux
 * au plus de suite), bords rognés. Pur. L'écran, lui, n'injecte jamais de HTML : il affiche du texte.
 */
const ENTITES: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: '’', nbsp: ' ' };

function decoderEntites(t: string): string {
  return t.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,6});/gi, (tout, corps: string) => {
    const nom = corps.toLowerCase();
    if (nom in ENTITES) return ENTITES[nom];
    if (nom.startsWith('#')) {
      const code = nom.startsWith('#x') ? Number.parseInt(nom.slice(2), 16) : Number.parseInt(nom.slice(1), 10);
      if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) {
        try {
          return String.fromCodePoint(code);
        } catch {
          return '';
        }
      }
      return '';
    }
    return tout;
  });
}

function retirerBalises(t: string): string {
  // Un bloc script ou style part ENTIER (son contenu n'est pas du texte) ; puis les balises, même mal fermées.
  return t.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '').replace(/<[^>]*>/g, '');
}

export function texteBrut(brut: string): string {
  let t = brut.replace(/\r\n?/g, '\n');
  // Décoder PUIS retirer, et recommencer tant que ça change (dix tours au plus : un collage adversaire s'arrête là).
  for (let i = 0; i < 10; i++) {
    const avant = t;
    t = retirerBalises(decoderEntites(t));
    if (t === avant) break;
  }
  // Ce qui reste de « < » après le point fixe est un chevron qui n'ouvre aucune balise ; il reste tel quel (« &lt;3 »).
  // Les caractères de contrôle (sauf le retour à la ligne), les caractères de format invisibles (sauf le ZWJ U+200D) et
  // les espaces répétées.
  t = t.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').replace(/(?!‍)\p{Cf}/gu, '');
  t = t
    .split('\n')
    .map((l) => l.replace(/[ \t  ]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
  return t.trim();
}
