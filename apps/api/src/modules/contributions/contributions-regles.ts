import type { ContributionPublique, PropositionContribution, StatutContribution, StatutVerdict } from '@moutar/shared-types';
import { SOURCES_CONTRIBUTION } from '@moutar/shared-types/catalogues/contributions';
import { jourLocal } from '../../common/temps/jour-local';
import { texteBrut } from '../../common/validation/texte-brut';

/** Les bornes d'une contribution (zod côté contrôleur, règle ici pour les textes nettoyés). */
export const SOURCE_TEXTE_MAX = 1000;
export const AUTEUR_NOM_MAX = 40;
export const SIGNALEMENT_TEXTE_MAX = 500;

// La règle du lien de preuve (`preuveUrlAdmise`) vit UNE fois dans `@moutar/shared-types/regles/preuve` : le serveur
// (`contributions.controller.ts : verifierPreuve`) et l'écran la lisent tous deux (21/10/2026).

/** Pure : les textes d'une proposition en texte brut, tronqués à leurs bornes ; le pseudonyme vide devient null. */
export function nettoyerProposition(p: PropositionContribution): PropositionContribution {
  const auteur = p.auteurNom ? texteBrut(p.auteurNom).slice(0, AUTEUR_NOM_MAX) : '';
  return { ...p, sourceTexte: texteBrut(p.sourceTexte).slice(0, SOURCE_TEXTE_MAX), auteurNom: auteur || null };
}

/** Le statut de la table `verdict` pour un statut proposé : `douteux` vaut « non vérifié » — JAMAIS « non cacher ». */
export const STATUT_VERDICT_CONTRIBUTION: Record<StatutContribution, StatutVerdict> = { cite: 'cite', non_cite: 'non_cite', douteux: 'non_verifie' };

/** Ce qu'un verdict de niveau 3 écrit à la validation d'une contribution (source, mention, date publiée, détail). */
export function verdictDeContribution(c: { id: string; statutPropose: StatutContribution; sourceType: 'lbpc' | 'autre'; sourceTexte: string; sourceDate: string | null; auteurNom: string | null }, valideeLe: Date) {
  const source = SOURCES_CONTRIBUTION[c.sourceType];
  return {
    niveau: 3,
    statut: STATUT_VERDICT_CONTRIBUTION[c.statutPropose],
    source: source.nom,
    mention: c.statutPropose === 'cite' ? `communauté · ${source.nomCourt}` : c.statutPropose === 'douteux' ? 'signalé douteux' : null,
    publieLe: c.sourceDate ? new Date(`${c.sourceDate}T12:00:00Z`) : valideeLe,
    valableJusquAu: null,
    detail: { contributionId: c.id, statutPropose: c.statutPropose, sourceType: c.sourceType, sourceTexte: c.sourceTexte.slice(0, 200), sourceDate: c.sourceDate, auteurNom: c.auteurNom, validePar: 'console' },
  };
}

/**
 * Pure : la contribution validée qui FONDE la ligne de niveau 3 — la plus récente par le jour de sa source (`sourceDate`),
 * à défaut le jour de sa validation ; à jour égal, la validée en dernier. Null sans contribution validée.
 */
export function contributionFondatrice(validees: readonly ContributionPublique[]): ContributionPublique | null {
  // Le jour de validation est celui de la pendule du centre (jamais `toISOString().slice(0, 10)`).
  const jour = (c: ContributionPublique): string => c.sourceDate ?? jourLocal(new Date(c.valideeLe));
  return [...validees].sort((a, b) => jour(b).localeCompare(jour(a)) || b.valideeLe.localeCompare(a.valideeLe))[0] ?? null;
}
