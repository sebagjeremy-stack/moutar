/**
 * Normalisation d'un texte pour la recherche et la correspondance des listes (lot 2) : minuscules, accents retirés
 * (décomposition NFD), tout ce qui n'est ni lettre ni chiffre devient une espace, espaces réduites. UNE règle, lue par
 * l'API (colonnes `*_norm`, correspondance des listes) et par l'écran (surlignage, filtres) : « Saint-Michel » et
 * « saint michel » se lisent pareil ; « Lu » ne se trouve jamais dans « Lutine » (mots entiers).
 */
export function normaliser(texte: string | null | undefined): string {
  if (!texte) return '';
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Les mots d'un texte normalisé (jamais vides). */
export function mots(texte: string | null | undefined): string[] {
  const n = normaliser(texte);
  return n ? n.split(' ') : [];
}

/**
 * Vrai si `motif` (un ou plusieurs mots) figure dans `texte` en MOTS ENTIERS et dans l'ordre : « lu » dans « biscuits lu »
 * mais pas dans « lutine » ; « saint michel » dans « galettes saint michel ». Un motif vide ne figure nulle part.
 */
export function contientMotsEntiers(texte: string | null | undefined, motif: string | null | undefined): boolean {
  const t = normaliser(texte);
  const m = normaliser(motif);
  if (!t || !m) return false;
  return ` ${t} `.includes(` ${m} `);
}

/**
 * Le radical d'un mot : un pluriel régulier tombe (« biscuits » → « biscuit », « gâteaux » → « gateau ») ; un mot de
 * trois lettres ou moins reste tel quel (« vin », « jus », « riz »).
 */
export function radical(mot: string): string {
  const m = normaliser(mot);
  if (m.length <= 3) return m;
  if (m.endsWith('aux')) return `${m.slice(0, -3)}au`;
  if (m.endsWith('s') || m.endsWith('x')) return m.slice(0, -1);
  return m;
}

/**
 * Le premier mot de `b` qui partage son radical avec un mot de `a` (« YAOURTS » et « Yaourt nature » → « yaourt »), ou
 * null. Les mots de `a` courts (moins de trois lettres) ou listés dans `motsIgnores` ne comptent pas.
 */
export function partagentUnMot(a: string | null | undefined, b: string | null | undefined, motsIgnores: ReadonlySet<string> = new Set()): string | null {
  const radicauxA = new Set<string>();
  for (const mot of mots(a)) {
    const r = radical(mot);
    if (r.length < 3 || motsIgnores.has(r) || motsIgnores.has(mot)) continue;
    radicauxA.add(r);
  }
  for (const mot of mots(b)) if (radicauxA.has(radical(mot))) return mot;
  return null;
}
