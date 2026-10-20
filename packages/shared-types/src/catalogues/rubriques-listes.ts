/**
 * Catalogue EN CODE des rubriques des listes officielles (lot 2).
 * - RUBRIQUES_RESERVEES : les familles que le Consistoire garde TOUJOURS sous surveillance du Beth Din (cadrage § 2 :
 *   viandes, charcuteries, vins, jus de raisin, fromages). Une rubrique qui porte un de ces mots n'est JAMAIS « toute
 *   marque », même sans marque nommée ; seules les marques nommées y comptent. « volaille » et « boucherie » y sont
 *   ajoutées par prudence (à valider).
 * - MOTS_VIDES_RUBRIQUE : les mots d'une rubrique qui ne désignent rien (« et », « de », « sans »…) et ne servent jamais à
 *   rapprocher une rubrique d'un nom de produit.
 */
export const RUBRIQUES_RESERVEES: ReadonlyArray<{ mot: string; motif: string }> = [
  { mot: 'viande', motif: 'viandes' },
  { mot: 'charcuterie', motif: 'charcuteries' },
  { mot: 'vin', motif: 'vins' },
  { mot: 'jus de raisin', motif: 'jus de raisin' },
  { mot: 'fromage', motif: 'fromages' },
  { mot: 'volaille', motif: 'volailles (à valider)' },
  { mot: 'boucherie', motif: 'boucherie (à valider)' },
];

export const MOTS_VIDES_RUBRIQUE: ReadonlySet<string> = new Set([
  'a', 'au', 'aux', 'de', 'des', 'du', 'd', 'l', 'la', 'le', 'les', 'et', 'ou', 'en', 'sans', 'avec', 'pour', 'sur', 'sous', 'par', 'un', 'une',
  'autres', 'autre', 'divers', 'diverses', 'produits', 'produit', 'base', 'type', 'toutes', 'tous', 'toute', 'tout', 'marques', 'marque',
]);

/** Les mentions connues d'une ligne de liste ; tout autre texte est une mention libre, gardée telle quelle. */
export const MENTION_LAIT_NON_SURVEILLE = 'lait_non_surveille';

export const LIBELLES_MENTIONS: Readonly<Record<string, string>> = {
  [MENTION_LAIT_NON_SURVEILLE]: 'lait non surveillé',
};

/** Le libellé humain d'une mention (code connu → libellé ; texte libre → lui-même). */
export function libelleMention(mention: string | null | undefined): string | null {
  if (!mention) return null;
  return LIBELLES_MENTIONS[mention] ?? mention;
}
