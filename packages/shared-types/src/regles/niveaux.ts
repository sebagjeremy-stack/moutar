import type { Niveau } from '../index';

/** Libellés des quatre niveaux, une seule fois pour l'API et l'écran. */
export const LIBELLES_NIVEAUX: Record<Niveau, string> = {
  1: 'Certifié',
  2: 'Liste officielle',
  3: 'Communautaire',
  4: 'Sur composition',
};

export const NIVEAUX: readonly Niveau[] = [1, 2, 3, 4];

/** « niveau 2 · Liste officielle ». */
export function libelleNiveau(niveau: Niveau): string {
  return `niveau ${niveau} · ${LIBELLES_NIVEAUX[niveau]}`;
}

/** Lit un seuil depuis une chaîne (query, localStorage) ; hors 1-4 : le défaut (2, cadrage § 8.4). */
export function lireSeuil(valeur: unknown, defaut: Niveau = 2): Niveau {
  const n = typeof valeur === 'string' ? Number(valeur) : typeof valeur === 'number' ? valeur : NaN;
  return n === 1 || n === 2 || n === 3 || n === 4 ? n : defaut;
}

/**
 * Un code E normalisé : « e322i » → « E322 », « E-160a » → « E160a », « E 472 e » → « E472e » (un espace avant la
 * lettre est toléré ; des chiffres espacés, « E 1 2 0 », ne se lisent pas). Null si ce n'est pas un code E : un tag
 * d'Open Food Facts non reconnu (`en:e160a-i`, `en:e14xx`) rend null et l'analyse le COMPTE comme non lu.
 */
export function normaliserCodeE(brut: string): string | null {
  const m = /^(?:en:)?\s*e[\s-]?(\d{3,4})\s?([a-hj-uw-z])?(?:[ivx]{1,4})?$/i.exec(brut.trim());
  if (!m) return null;
  return `E${m[1]}${m[2] ? m[2].toLowerCase() : ''}`;
}
