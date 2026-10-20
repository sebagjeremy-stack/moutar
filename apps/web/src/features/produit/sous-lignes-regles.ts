import type { SousLigneListe, Ton } from '@moutar/shared-types';
import { formaterJourCivil } from '../../lib/dates';

/**
 * Règle d'ÉCRAN, pure : ce qu'une sous-ligne du niveau 2 (une par liste officielle) affiche.
 * - la pastille porte TOUJOURS son mot ; le vert ne vient que d'une liste VALIDE qui cite le produit ; une liste périmée
 *   est ambre, jamais verte ; « Non cité » est neutre (ce n'est pas un « non », jamais rouge) ;
 * - une marque citée avec une confiance faible (rubrique étrangère au nom du produit) dit « à vérifier » dans sa pastille ;
 * - la ligne de dates dit la publication et la validité telles que la liste les annonce (ou leur absence).
 */
export interface PastilleSousLigne {
  ton: Ton;
  mot: string;
}

type Entree = Pick<SousLigneListe, 'statut' | 'confiance' | 'mention'> & Partial<SousLigneListe>;

export function pastilleSousLigne(s: Entree): PastilleSousLigne {
  switch (s.statut) {
    case 'cite':
      return { ton: 'ok', mot: ['Cité', s.mention, s.confiance === 'faible' ? 'à vérifier' : null].filter(Boolean).join(' · ') };
    case 'cite_par_rubrique':
      // « Par rubrique » est toujours de confiance faible côté serveur : la précision le dit (toute marque autorisée), la pastille ne le répète pas.
      return { ton: 'ok', mot: ['Cité par rubrique', s.mention].filter(Boolean).join(' · ') };
    case 'perime':
      return { ton: 'warn', mot: 'Cité · liste périmée' };
    case 'non_cite':
      return { ton: 'neutre', mot: 'Non cité' };
  }
}

/** Aucune liste active : une seule ligne, ambre — jamais « aucun » muet, jamais vert. */
export const SANS_LISTE: PastilleSousLigne = { ton: 'warn', mot: 'Non vérifié · aucune liste importée' };

/** « publiée le 01/07/2025 · valable jusqu’au 31/07/2026 » ; périmée : « expirée le » ; sans fin : « sans date de fin annoncée ». */
export function datesSousLigne(s: Pick<SousLigneListe, 'publieLe' | 'valableJusquAu' | 'statut'>): string {
  const publication = s.publieLe ? `publiée le ${formaterJourCivil(s.publieLe)}` : 'date de publication non indiquée';
  const fin = s.valableJusquAu ? `${s.statut === 'perime' ? 'expirée le' : 'valable jusqu’au'} ${formaterJourCivil(s.valableJusquAu)}` : 'sans date de fin annoncée';
  return `${publication} · ${fin}`;
}

/** La précision sous la ligne (ce que dit la liste), ou null quand la pastille suffit (« Non cité »). */
export function precisionSousLigne(s: Pick<SousLigneListe, 'statut' | 'confiance' | 'ligne'>): string | null {
  const l = s.ligne;
  if (s.statut === 'non_cite') return null;
  if (s.statut === 'cite_par_rubrique') return `Rubrique « ${l?.rubrique ?? '?'} » sans marque nommée : toute marque autorisée.`;
  if (!l) return null;
  let phrase: string;
  if (l.marque && l.produitLibelle) phrase = `« ${l.marque} — ${l.produitLibelle} » nommé sous la rubrique « ${l.rubrique} ».`;
  else if (l.marque) phrase = `La marque « ${l.marque} » est nommée sous la rubrique « ${l.rubrique} ».`;
  else if (l.produitLibelle) phrase = `« ${l.produitLibelle} » nommé sous la rubrique « ${l.rubrique} ».`;
  else phrase = `Rubrique « ${l.rubrique} ».`;
  if (s.statut === 'perime') return `${phrase} Attendre l’édition suivante.`;
  if (s.confiance === 'faible') return `${phrase} Vérifiez que ce produit en relève.`;
  return phrase;
}
