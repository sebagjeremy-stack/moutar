import type { SourceContribution, StatutContribution } from '../index';

/** Les sources d'une contribution (lot 5) : le nom qui fonde une ligne de la carte, et le nom court de la pastille. */
export const SOURCES_CONTRIBUTION: Record<SourceContribution, { nom: string; nomCourt: string }> = {
  lbpc: { nom: 'Les Bons Plans Cachères', nomCourt: 'LBPC' },
  autre: { nom: 'Communauté Moutar', nomCourt: 'communauté' },
};

export const STATUTS_CONTRIBUTION: readonly StatutContribution[] = ['cite', 'non_cite', 'douteux'];

/** Les libellés humains des statuts proposés (formulaire et console). */
export const LIBELLES_STATUT_CONTRIBUTION: Record<StatutContribution, string> = {
  cite: 'Cité comme permis par la source',
  non_cite: 'Non cité par la source',
  douteux: 'Signalé douteux par la source',
};
