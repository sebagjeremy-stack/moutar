import type { LigneAnalysee } from '@moutar/shared-types';

/**
 * Règle d'ÉCRAN, pure : l'incohérence d'une ligne de liste telle que le serveur la refuserait (400 `ligne_invalide`),
 * dite AVANT l'envoi, en ambre, à côté de la ligne. Le serveur reste juge (`verifierLigne`).
 */
export function incoherenceLigne(l: Pick<LigneAnalysee, 'rubrique' | 'marque' | 'produitLibelle' | 'touteMarque' | 'rubriqueReservee'>): string | null {
  if (!l.rubrique.trim()) return 'La rubrique est obligatoire.';
  const marque = (l.marque ?? '').trim();
  const produit = (l.produitLibelle ?? '').trim();
  if (l.touteMarque) {
    if (l.rubriqueReservee) return 'Une rubrique réservée n’est jamais « toute marque ».';
    if (marque || produit) return '« Toute marque » exclut une marque ou un produit nommés.';
    return null;
  }
  if (!marque && !produit) return 'Nommez une marque ou un produit, ou cochez « toute marque ».';
  return null;
}

/** Les lignes incohérentes d'un aperçu (numéros à partir de 1), pour le compte en tête. */
export function numerosIncoherents(lignes: LigneAnalysee[]): number[] {
  return lignes.flatMap((l, i) => (incoherenceLigne(l) ? [i + 1] : []));
}
