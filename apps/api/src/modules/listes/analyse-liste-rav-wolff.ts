import { analyserTexteListe, type OptionsAnalyse, type ResultatAnalyseListe } from './analyse-liste-commun';

/**
 * Analyseur PUR de la liste du Rav Wolff (liste 2026 publiée par Chiourim, valable jusqu'au 01/11/2026). Structure connue
 * (cadrage § 2) : une note d'introduction (avis indulgents) — gardée en `note`, jamais perdue : la première ligne du
 * fichier n'est jamais prise pour un titre de rubrique —, puis par rubrique des marques et produits nommés, des mentions
 * « lait non surveillé » en toutes lettres. Les rubriques y sont en majuscules, ou en « Titre » suivi de « : », ou un
 * titre court isolé par une ligne vide (`rubriqueParTitre`). Échantillons FICTIFS : à régler sur le vrai fichier (fiche du lot 2).
 */
export function analyserTexteRavWolff(texte: string, options: Pick<OptionsAnalyse, 'titre'> = {}): ResultatAnalyseListe {
  return analyserTexteListe(texte, { rubriqueParTitre: true, longueurMaxRubrique: 80, titre: options.titre ?? null });
}
