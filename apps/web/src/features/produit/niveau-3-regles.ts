import type { ContributionPublique, SourceContribution, StatutContribution, Ton } from '@moutar/shared-types';
import { SOURCES_CONTRIBUTION } from '@moutar/shared-types/catalogues/contributions';
import { formaterJour, formaterJourCivil } from '../../lib/dates';

/*
 * Niveau 3 (lot 5), règles PURES de l'écran : la pastille d'UNE contribution (le mot, son ton), le texte de sa source
 * tronqué, et sa ligne de dates. La ligne de la carte elle-même (pastille, ton, détail) vient du serveur
 * (`carte-regles.ts : ligneCommunautaire`) et s'affiche telle quelle. Jamais rouge ici : une contribution ne dit jamais
 * « non cacher » (Moutar cite, il ne décide pas) ; un « douteux » est ambre, un « non cité » est neutre.
 */

/** Le mot de chaque statut, sans sa source (le mot reste à côté de la couleur). */
const MOTS: Record<StatutContribution, string> = { cite: 'Cité comme permis', douteux: 'Signalé douteux', non_cite: 'Non cité' };
const TONS: Record<StatutContribution, Ton> = { cite: 'ok', douteux: 'warn', non_cite: 'neutre' };

/** « Cité comme permis · LBPC » (ok), « Signalé douteux · communauté » (warn), « Non cité · LBPC » (neutre). */
export function pastilleContribution(statut: StatutContribution, source: SourceContribution): { ton: Ton; mot: string } {
  return { ton: TONS[statut], mot: `${MOTS[statut]} · ${SOURCES_CONTRIBUTION[source].nomCourt}` };
}

/** Le nom entier de la source (« Les Bons Plans Cachères », « Communauté Moutar »). */
export const nomSource = (source: SourceContribution): string => SOURCES_CONTRIBUTION[source].nom;

/** Le texte de la source tronqué à `max` caractères (une ellipse à la fin), les espaces repliés ; vide reste vide. */
export function sourceTronquee(texte: string, max = 200): string {
  const t = texte.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/** « Source datée du 03/05/2026 · validée le 21/10/2026 · proposée par « Sarah » · preuve jointe » — ce qui manque ne s'écrit pas. */
export function datesContribution(c: Pick<ContributionPublique, 'sourceDate' | 'valideeLe' | 'auteurNom' | 'preuveUrl'>): string {
  const parts = [c.sourceDate ? `Source datée du ${formaterJourCivil(c.sourceDate)}` : 'Source non datée', `validée le ${formaterJour(c.valideeLe)}`];
  if (c.auteurNom) parts.push(`proposée par « ${c.auteurNom} »`);
  if (c.preuveUrl) parts.push('preuve jointe');
  return parts.join(' · ');
}
