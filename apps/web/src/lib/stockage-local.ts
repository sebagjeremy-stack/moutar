import type { Niveau, Ton } from '@moutar/shared-types';
import { lireSeuil } from '@moutar/shared-types/regles/niveaux';

/**
 * Ce que le téléphone garde pour lui seul (CLAUDE.md : l'historique des scans reste sur le téléphone) : le seuil et les
 * derniers produits. Chaque lecture et écriture tolère un stockage absent (navigation privée).
 */
const CLE_SEUIL = 'moutar_seuil';
const CLE_HISTORIQUE = 'moutar_historique';
export const HISTORIQUE_MAX = 20;

export interface EntreeHistorique {
  ean: string;
  nom: string;
  marque: string | null;
  pastille: string;
  ton: Ton;
  /** ISO. */
  le: string;
}

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

export function lireHistorique(): EntreeHistorique[] {
  try {
    const v = JSON.parse(lireBrut(CLE_HISTORIQUE) ?? '[]');
    return Array.isArray(v) ? (v as EntreeHistorique[]).filter((e) => typeof e?.ean === 'string' && typeof e?.nom === 'string') : [];
  } catch {
    return [];
  }
}

/** Pure : ajoute (ou remonte) une entrée en tête, bornée à 20. */
export function ajouterAHistorique(liste: EntreeHistorique[], entree: EntreeHistorique): EntreeHistorique[] {
  return [entree, ...liste.filter((e) => e.ean !== entree.ean)].slice(0, HISTORIQUE_MAX);
}

export function noterDansHistorique(entree: EntreeHistorique): void {
  ecrireBrut(CLE_HISTORIQUE, JSON.stringify(ajouterAHistorique(lireHistorique(), entree)));
}
