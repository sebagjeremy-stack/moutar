/*
 * Lot 5 — le lien de preuve d'une contribution : UNE règle, lue par le serveur (`contributions.controller.ts :
 * verifierPreuve`, qui tranche : 400 `preuve_refusee`) et par l'écran (`features/contribution/contribution-regles.ts`, qui
 * le dit d'abord et montre au récapitulatif le lien tel que le serveur le gardera). Les hôtes admis viennent en paramètre :
 * le serveur lit `CONTRIBUTION_HOTES_PREUVE`, l'écran sa liste par défaut. Aucune dépendance : pure.
 */

/** Les paramètres de pistage retirés d'une preuve : `fbclid` et tout `utm_*` (une preuve est un lien, pas un traceur). */
const PARAMETRE_DE_PISTAGE = /^(fbclid|utm_[a-z0-9_]*)$/i;

/**
 * Pure : un lien de preuve est admis s'il est en https et si son hôte EST un hôte admis ou un sous-domaine de l'un
 * (`m.facebook.com`, `www.lesbonsplanscachers.fr`). Un hôte hors liste, un `http:`, un `javascript:` ou un texte qui n'est
 * pas une adresse sont refusés (null). L'adresse est rendue normalisée (sans identifiants `user:pass@`, sans fragment,
 * sans les paramètres de pistage `fbclid` et `utm_*`).
 */
export function preuveUrlAdmise(brut: string, hotes: readonly string[]): string | null {
  let url: URL;
  try {
    url = new URL(brut.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  const hote = url.hostname.toLowerCase();
  if (!hotes.some((h) => hote === h || hote.endsWith(`.${h}`))) return null;
  url.hash = '';
  for (const cle of [...url.searchParams.keys()]) if (PARAMETRE_DE_PISTAGE.test(cle)) url.searchParams.delete(cle);
  return url.toString();
}

/** Pure : vrai quand la normalisation a retiré quelque chose du lien saisi (fragment, pistage) — l'écran le dit. */
export function preuveModifiee(brut: string, admise: string): boolean {
  return brut.trim() !== admise;
}
