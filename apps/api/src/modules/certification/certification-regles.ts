import type { MentionCertification } from '@moutar/shared-types';

/** Les mentions qui disent le STATUT LAITIER d'un produit : une seule à la fois (parvé OU halavi OU lait non surveillé). */
export const MENTIONS_LAITIERES: readonly MentionCertification[] = ['parve', 'halavi', 'lait_non_surveille'];

/**
 * Pure : vrai quand des mentions se contredisent — un produit n'est pas à la fois parvé et lacté, ni « lait surveillé »
 * (halavi) et « lait non surveillé ». La validation les refuse (400 `mentions_contradictoires`) : Moutar cite ce que le
 * logo dit, il n'écrit pas deux choses incompatibles.
 */
export function mentionsContradictoires(mentions: readonly MentionCertification[]): boolean {
  return new Set(mentions.filter((m) => MENTIONS_LAITIERES.includes(m))).size > 1;
}
