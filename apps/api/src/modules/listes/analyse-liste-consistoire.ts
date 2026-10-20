import { analyserTexteListe, type ResultatAnalyseListe } from './analyse-liste-commun';

/**
 * Analyseur PUR de la liste du Consistoire de Paris (« Produits 2025-2026 », PDF converti en texte). Structure connue
 * (cadrage § 2) : des rubriques en MAJUSCULES (« BISCUITS SECS », « YAOURTS ») ; sous une rubrique, soit aucune marque
 * (toute marque autorisée dans la rubrique), soit des marques ou produits nommés (seuls ceux-là) ; « (L) » = lait non
 * surveillé ; viandes, charcuteries, vins, jus de raisin, fromages toujours sous Beth Din (jamais « toute marque »).
 * Écrit sur des échantillons FICTIFS : à régler sur le vrai fichier (fiche du lot 2).
 */
export function analyserTexteConsistoire(texte: string): ResultatAnalyseListe {
  return analyserTexteListe(texte, { rubriqueParTitre: false, longueurMaxRubrique: 80 });
}
