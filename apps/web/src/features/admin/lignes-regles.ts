import type { LigneAnalysee } from '@moutar/shared-types';
import { RUBRIQUES_RESERVEES } from '@moutar/shared-types/catalogues/rubriques-listes';
import { contientMotsEntiers, normaliser, radical } from '@moutar/shared-types/regles/normalisation';

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

/**
 * Vrai pour une rubrique toujours sous surveillance (viande, charcuterie, vin, jus de raisin, fromage…) : la case
 * « Réservée » se recalcule quand le texte de la rubrique change (elle reste cochable en plus). MIROIR de
 * `apps/api/src/modules/listes/analyse-liste-commun.ts : rubriqueReservee` sur le catalogue partagé `RUBRIQUES_RESERVEES`,
 * testé sur la même table de cas ; le serveur recalcule de son côté (`recu || calculé`) et reste juge. À déplacer dans
 * `@moutar/shared-types/regles` au prochain lot qui touche le paquet partagé.
 */
export function rubriqueReservee(rubrique: string): boolean {
  const n = normaliser(rubrique);
  if (!n) return false;
  const radicaux = n.split(' ').map(radical);
  for (const r of RUBRIQUES_RESERVEES) {
    if (r.mot.includes(' ')) {
      if (contientMotsEntiers(n, r.mot)) return true;
      continue;
    }
    if (radicaux.includes(radical(r.mot))) return true;
  }
  return false;
}
