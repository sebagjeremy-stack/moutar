import type { Ton } from '@moutar/shared-types';

/**
 * L'historique des produits vérifiés : gardé sur CE téléphone seulement (`localStorage`), jamais envoyé (CLAUDE.md).
 * Rien de personnel : l'EAN, le nom, la marque, la pastille de synthèse (avec son ton) et l'instant. Vingt entrées au
 * plus, la plus récente en tête, une seule par EAN. Chaque lecture et écriture tolère un stockage absent (navigation
 * privée) : on vit sans.
 */
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

function lireBrut(): string | null {
  try {
    return localStorage.getItem(CLE_HISTORIQUE);
  } catch {
    return null;
  }
}

function ecrire(liste: EntreeHistorique[]): void {
  try {
    if (liste.length === 0) localStorage.removeItem(CLE_HISTORIQUE);
    else localStorage.setItem(CLE_HISTORIQUE, JSON.stringify(liste));
  } catch {
    /* navigation privée : on vit sans */
  }
}

const TONS: readonly Ton[] = ['ok', 'warn', 'danger', 'neutre'];

/** Une entrée relue du stockage est-elle bien formée ? (un stockage altéré ne casse pas l'écran) */
function entreeValide(e: unknown): e is EntreeHistorique {
  if (typeof e !== 'object' || e === null) return false;
  const o = e as Record<string, unknown>;
  return typeof o['ean'] === 'string' && typeof o['nom'] === 'string' && typeof o['pastille'] === 'string' && TONS.includes(o['ton'] as Ton) && typeof o['le'] === 'string';
}

export function lireHistorique(): EntreeHistorique[] {
  try {
    const v: unknown = JSON.parse(lireBrut() ?? '[]');
    return Array.isArray(v) ? trierRecentDAbord(v.filter(entreeValide)).slice(0, HISTORIQUE_MAX) : [];
  } catch {
    return [];
  }
}

/** Pure : la plus récente en tête (une écriture d'avant le lot 4 peut être dans un autre ordre). */
export function trierRecentDAbord(liste: EntreeHistorique[]): EntreeHistorique[] {
  return [...liste].sort((a, b) => (a.le < b.le ? 1 : a.le > b.le ? -1 : 0));
}

/** Pure : ajoute (ou remonte) une entrée en tête, sans doublon d'EAN, bornée à 20. */
export function ajouterAHistorique(liste: EntreeHistorique[], entree: EntreeHistorique): EntreeHistorique[] {
  return [entree, ...liste.filter((e) => e.ean !== entree.ean)].slice(0, HISTORIQUE_MAX);
}

/** Pure : retire l'entrée d'un EAN (rien ne change si elle n'y est pas). */
export function retirerDeHistorique(liste: EntreeHistorique[], ean: string): EntreeHistorique[] {
  return liste.filter((e) => e.ean !== ean);
}

export function noterDansHistorique(entree: EntreeHistorique): void {
  ecrire(ajouterAHistorique(lireHistorique(), entree));
}

/** Retire une ligne et rend la liste qui reste. */
export function retirerEntreeHistorique(ean: string): EntreeHistorique[] {
  const liste = retirerDeHistorique(lireHistorique(), ean);
  ecrire(liste);
  return liste;
}

/** « Tout effacer » : la clé disparaît du téléphone. */
export function effacerHistorique(): void {
  ecrire([]);
}
