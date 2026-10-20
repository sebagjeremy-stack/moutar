/**
 * La confiance d'une proposition de certificateur (0 à 1, calculée par le serveur : confiance du modèle × force du mot-clé)
 * s'écrit en MOTS, jamais en pourcentage : « très probable », « probable », « incertain ». Les seuils suivent les forces du
 * serveur (un mot-clé long à confiance pleine vaut 1 ; un sigle court avec sa forme 0,9 ; un nom lu hors symbole 0,6).
 * Une proposition reste une proposition : c'est l'utilisateur qui valide d'un clic.
 */
export type ConfianceEnMots = 'très probable' | 'probable' | 'incertain';

export const SEUIL_TRES_PROBABLE = 0.75;
export const SEUIL_PROBABLE = 0.45;

export function confianceEnMots(confiance: number): ConfianceEnMots {
  const c = Number.isFinite(confiance) ? Math.min(1, Math.max(0, confiance)) : 0;
  if (c >= SEUIL_TRES_PROBABLE) return 'très probable';
  if (c >= SEUIL_PROBABLE) return 'probable';
  return 'incertain';
}
