import type { Reponse } from './api';

/**
 * Le `code` d'une erreur du serveur → une phrase française pour l'écran (jamais un code brut, jamais un « aucun »).
 * Un code inconnu garde le message du serveur (déjà en français), sinon une phrase selon le statut HTTP.
 */
const PHRASES: Readonly<Record<string, string>> = {
  reseau: 'Pas de réseau : la demande n’est pas partie.',
  non_connecte: 'Vous n’êtes pas connecté : reconnectez-vous.',
  session_invalide: 'Votre session n’est plus valable : reconnectez-vous.',
  requete_invalide: 'La demande est incomplète ou mal formée : vérifiez les champs.',
  corps_trop_grand: 'Le contenu envoyé dépasse 1 Mo : réduisez le nombre de lignes, ou importez par fichier.',
  fichier_trop_grand: 'Le fichier dépasse 10 Mo.',
  pdf_illisible: 'Ce PDF ne contient pas de texte lisible (un scan ?) : collez le texte, ou choisissez un fichier texte.',
  texte_absent: 'Choisissez un fichier ou collez le texte de la liste.',
  liste_vide: 'Aucune ligne à importer : l’analyse n’a rien lu, ou toutes les lignes ont été retirées.',
  ligne_invalide: 'Une ligne est incohérente (« toute marque » exclut marque et produit, jamais sous une rubrique réservée ; une ligne nomme une marque ou un produit).',
  liste_inconnue: 'Cette liste n’existe pas (ou plus).',
  ligne_inconnue: 'Cette ligne n’existe pas (ou plus).',
  trop_de_demandes: 'Trop de recherches, patientez une minute.',
  recherche_trop_courte: 'Tapez au moins 3 caractères.',
};

const PAR_STATUT: Readonly<Record<number, string>> = {
  400: 'La demande est incomplète ou mal formée.',
  401: 'Vous n’êtes pas connecté : reconnectez-vous.',
  403: 'Cette action n’est pas permise.',
  404: 'Introuvable.',
  409: 'Cette action entre en conflit avec l’état actuel.',
  413: 'Le contenu envoyé est trop volumineux.',
  422: 'Le contenu n’a pas pu être lu.',
  429: 'Trop de demandes, patientez une minute.',
  500: 'Le serveur a rencontré une erreur.',
};

export function phraseErreur(r: Extract<Reponse<unknown>, { ok: false }>): string {
  const phrase = PHRASES[r.code];
  if (phrase) {
    // Une ligne incohérente : le serveur dit laquelle ; on garde sa précision à la suite.
    return r.code === 'ligne_invalide' && r.message ? `${phrase} ${r.message}` : phrase;
  }
  if (r.message && !/^Erreur \d+\.$/.test(r.message)) return r.message;
  return PAR_STATUT[r.statut] ?? 'Une erreur est survenue.';
}
