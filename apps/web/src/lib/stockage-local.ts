import type { Niveau } from '@moutar/shared-types';
import { lireSeuil } from '@moutar/shared-types/regles/niveaux';

/**
 * Ce que le téléphone garde pour lui seul (CLAUDE.md : rien ne part) : le seuil, ici ; les derniers produits dans
 * `historique.ts`. Chaque lecture et écriture tolère un stockage absent (navigation privée).
 */
const CLE_SEUIL = 'moutar_seuil';

function lireBrut(cle: string): string | null {
  try {
    return localStorage.getItem(cle);
  } catch {
    return null;
  }
}

function ecrireBrut(cle: string, valeur: string): void {
  try {
    localStorage.setItem(cle, valeur);
  } catch {
    /* navigation privée : on vit sans */
  }
}

export function lireSeuilLocal(): Niveau {
  return lireSeuil(lireBrut(CLE_SEUIL));
}

export function ecrireSeuilLocal(seuil: Niveau): void {
  ecrireBrut(CLE_SEUIL, String(seuil));
}
