/**
 * Nettoyage PUR d'une liste d'ingrédients lue par OCR (lot 3) : ce que le modèle rend se relit mieux et se parse mieux
 * (`extraireCodesE` du lot 1 ne lit pas les chiffres espacés).
 * - « E 1 2 0 » → « E120 », « E-322 » → « E322 », « e471 » → « E471 », « E 472 e » → « E472e », « e 3 0 6 » → « E306 » —
 * jamais un « E » précédé de « vitamine » / « vit. » ni suivi d'une unité (« vitamine E 100 mg », « ÉNERGIE 250 kcal »,
 * « DE 120 g » restent intacts) ; les bords se lisent en lettres et chiffres UNICODE (« ÉNERGIE » n'y laisse pas un « E ») ;
 * - une césure en fin de ligne (« émul-\nsifiant ») se recolle ; les autres retours à la ligne deviennent une espace ;
 * - les espaces se réduisent, les espaces avant une virgule ou un point-virgule tombent.
 * Le texte BRUT reste rendu à côté : l'utilisateur relit avant de valider (`PUT /produits/:ean/ingredients`).
 */
import { vitamineOuQuantite } from '../analyse/analyse-composition-regles';

/** Le code E lui-même : une lettre E, un séparateur facultatif, trois ou quatre chiffres (espacés ou non), un suffixe facultatif. */
const CODE_E = /(?<![\p{L}\p{N}])([eE][\s-]?(\d)\s?(\d)\s?(\d)(?:\s?(\d))?(?:\s?([a-hj-uw-z]))?)(?![\p{L}\p{N}])/gu;

export function normaliserCodesE(texte: string): string {
  return texte.replace(CODE_E, (tout: string, _code: string, d1: string, d2: string, d3: string, d4: string | undefined, lettre: string | undefined, position: number, source: string) => {
    if (vitamineOuQuantite(source, position, position + tout.length)) return tout;
    return `E${d1}${d2}${d3}${d4 ?? ''}${lettre ? lettre.toLowerCase() : ''}`;
  });
}

export function recollerLignes(texte: string): string {
  return texte
    .replace(/\r\n?/g, '\n')
    // Césure : un tiret en fin de ligne suivi d'une minuscule.
    .replace(/(\p{L})-\n\s*(\p{Ll})/gu, '$1$2')
    .replace(/\s*\n+\s*/g, ' ');
}

export function nettoyerOcr(texte: string): string {
  return normaliserCodesE(recollerLignes(texte))
    .replace(/[ \t ]+/g, ' ')
    .replace(/ +([,;.])/g, '$1')
    .trim();
}
