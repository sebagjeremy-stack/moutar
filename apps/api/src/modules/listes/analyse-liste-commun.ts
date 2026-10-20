import type { LigneAnalysee } from '@moutar/shared-types';
import { MENTION_LAIT_NON_SURVEILLE, RUBRIQUES_RESERVEES } from '@moutar/shared-types/catalogues/rubriques-listes';
import { contientMotsEntiers, normaliser, radical } from '@moutar/shared-types/regles/normalisation';

/**
 * Socle PUR des analyseurs de listes (lot 2). Le texte d'une liste (PDF converti, ou texte collé) devient des lignes
 * `LigneAnalysee` et des avertissements (ce que l'analyseur n'a pas compris). Heuristiques, à régler sur les vrais
 * fichiers (les échantillons des tests sont FICTIFS) ; la console permet de corriger chaque ligne avant l'import.
 *
 * - une ligne en MAJUSCULES (trois lettres au moins, aucune minuscule), ou qui se termine par « : », est une RUBRIQUE ;
 * - sous une rubrique, chaque ligne nomme une marque (« Lu »), une marque et ses produits (« Lu : Petit Beurre, Prince »),
 *   ou plusieurs marques (« Lu, Bonne Maman ») ;
 * - « (L) », « (l) » ou « lait non surveillé » → mention `lait_non_surveille` ; une autre parenthèse → mention libre ;
 * - une rubrique sans aucune ligne, ou la ligne « toutes marques », → `touteMarque` (sauf rubrique RÉSERVÉE : viande,
 *   charcuterie, vin, jus de raisin, fromage — jamais « toute marque », un avertissement le dit) ;
 * - ce qui précède la première rubrique est la NOTE de la source (introduction, avis) ;
 * - un numéro de page, un filet, une ligne d'un caractère sont ignorés sans bruit.
 */
export interface ResultatAnalyseListe {
  lignes: LigneAnalysee[];
  avertissements: string[];
  /** Le texte qui précède la première rubrique (introduction de la source), ou null. */
  note: string | null;
}

export interface OptionsAnalyse {
  /** Une ligne courte en Capitale initiale suivie de « : » vaut rubrique (toujours) ; avec cette option, une ligne courte sans deux-points mais en « Titre » précédée d'une ligne vide aussi. */
  rubriqueParTitre?: boolean;
  /** Longueur maximale d'une rubrique (au-delà, une ligne en majuscules est un avertissement, pas une rubrique). */
  longueurMaxRubrique?: number;
}

const BRUIT = [/^\d{1,4}$/, /^page\s*\d+/i, /^[-–—_.·•*=]+$/, /^.$/];
const TOUTE_MARQUE = /^(toutes?\s+(les\s+)?marques?|tout\s+produit|tous\s+(les\s+)?produits)\s*\.?$/i;
const MENTION_L = /\(\s*l\s*\)/i;
const MENTION_LAIT = /\(?\s*lait\s+non\s+surveill[ée]e?\s*\)?/i;
const PARENTHESE_FINALE = /\(([^()]{1,80})\)\s*$/;

/** Vrai pour une famille toujours sous surveillance (viande, charcuterie, vin, jus de raisin, fromage…). */
export function rubriqueReservee(rubrique: string): boolean {
  const n = normaliser(rubrique);
  if (!n) return false;
  const radicaux = n.split(' ').map(radical);
  for (const r of RUBRIQUES_RESERVEES) {
    if (r.mot.includes(' ')) {
      if (contientMotsEntiers(n, r.mot)) return true;
      continue;
    }
    if (radicaux.includes(radical(r.mot))) return true;
  }
  return false;
}

function estBruit(ligne: string): boolean {
  return BRUIT.some((re) => re.test(ligne));
}

function nettoyer(brut: string): string {
  return brut
    .replace(/\s+/g, ' ')
    .replace(/^[•*\-–—>]+\s*/, '')
    .trim();
}

/** Une ligne en majuscules : trois lettres au moins, aucune minuscule (les chiffres et la ponctuation ne comptent pas). */
export function estEnMajuscules(ligne: string): boolean {
  const lettres = ligne.replace(/[^\p{L}]/gu, '');
  return lettres.length >= 3 && lettres === lettres.toLocaleUpperCase('fr-FR');
}

function estRubrique(ligne: string, options: OptionsAnalyse, precedenteVide: boolean): string | null {
  const max = options.longueurMaxRubrique ?? 80;
  const sansDeuxPoints = ligne.replace(/\s*:\s*$/, '');
  if (sansDeuxPoints !== ligne && sansDeuxPoints.length > 0 && sansDeuxPoints.length <= max && !/[,;]/.test(sansDeuxPoints)) return sansDeuxPoints;
  if (estEnMajuscules(ligne) && ligne.length <= max) return ligne.replace(/\s*:\s*$/, '');
  if (options.rubriqueParTitre && precedenteVide && ligne.length <= 40 && !/[,;:()\d]/.test(ligne) && /^\p{Lu}/u.test(ligne) && ligne.split(' ').length <= 4) return ligne;
  return null;
}

/** Le code d'une mention saisie à la main ou lue dans un CSV : « L », « (L) », « lait non surveillé » → `lait_non_surveille` ; un autre texte reste tel quel. */
export function codeMention(m: string | null | undefined): string | null {
  if (!m || !m.trim()) return null;
  const n = normaliser(m);
  if (n === 'l' || n === 'lait non surveille' || n === 'lait_non_surveille' || MENTION_LAIT.test(m)) return MENTION_LAIT_NON_SURVEILLE;
  return m.trim();
}

interface MentionLue {
  texte: string;
  mention: string | null;
}

/** Lit et retire la mention d'une ligne : « (L) » et « lait non surveillé » → `lait_non_surveille` ; une autre parenthèse finale → texte libre. */
export function lireMention(texte: string): MentionLue {
  let t = texte;
  let mention: string | null = null;
  if (MENTION_L.test(t)) {
    mention = MENTION_LAIT_NON_SURVEILLE;
    t = t.replace(MENTION_L, ' ');
  }
  if (MENTION_LAIT.test(t)) {
    mention = MENTION_LAIT_NON_SURVEILLE;
    t = t.replace(MENTION_LAIT, ' ');
  }
  if (!mention) {
    const m = PARENTHESE_FINALE.exec(t);
    if (m) {
      mention = m[1].trim();
      t = t.slice(0, m.index);
    }
  }
  return { texte: nettoyer(t).replace(/[,;:\s]+$/, ''), mention };
}

/** Coupe « A, B ; C » en morceaux non vides. */
function morceaux(texte: string): string[] {
  return texte
    .split(/[,;]/)
    .map((m) => nettoyer(m))
    .filter((m) => m.length > 0);
}

/**
 * Lit une ligne sous une rubrique : « Lu » (marque) ; « Lu : Petit Beurre, Prince » (une marque, ses produits) ;
 * « Lu, Bonne Maman » (plusieurs marques). La mention vaut pour chaque ligne produite.
 */
export function lireLigneProduit(brut: string, rubrique: string, reservee: boolean): Array<Omit<LigneAnalysee, 'ordre'>> {
  const { texte, mention } = lireMention(brut);
  if (!texte) return [];
  const base = { rubrique, mention, touteMarque: false, rubriqueReservee: reservee };
  const sep = /\s+[-–—]\s+|\s*:\s+/.exec(texte);
  if (sep && sep.index > 0) {
    const marque = nettoyer(texte.slice(0, sep.index));
    const produits = morceaux(texte.slice(sep.index + sep[0].length));
    if (produits.length === 0) return [{ ...base, marque, produitLibelle: null }];
    return produits.map((p) => ({ ...base, marque, produitLibelle: p }));
  }
  return morceaux(texte).map((m) => ({ ...base, marque: m, produitLibelle: null }));
}

/** L'analyse commune ; les analyseurs nommés ne diffèrent que par leurs options. */
export function analyserTexteListe(texte: string, options: OptionsAnalyse = {}): ResultatAnalyseListe {
  const lignes: LigneAnalysee[] = [];
  const avertissements: string[] = [];
  const preambule: string[] = [];
  let rubrique: string | null = null;
  let reservee = false;
  let lignesDeLaRubrique = 0;
  let touteMarqueExplicite = false;
  let precedenteVide = true;
  let ordre = 0;

  let mentionRubrique: string | null = null;

  const fermerRubrique = (): void => {
    if (rubrique === null) return;
    const sansLigne = lignesDeLaRubrique === 0;
    if (reservee) {
      if (sansLigne) avertissements.push(`Rubrique réservée « ${rubrique} » sans marque nommée : rien n'y est autorisé par défaut (toujours sous surveillance).`);
      return;
    }
    if (sansLigne || touteMarqueExplicite) {
      lignes.push({ rubrique, marque: null, produitLibelle: null, mention: mentionRubrique, touteMarque: true, rubriqueReservee: false, ordre: ordre++ });
    }
  };

  for (const brute of texte.split(/\r?\n/)) {
    const ligne = nettoyer(brute);
    if (!ligne) {
      precedenteVide = true;
      continue;
    }
    if (estBruit(ligne)) continue;
    const titre = estRubrique(ligne, options, precedenteVide);
    precedenteVide = false;
    if (titre !== null) {
      fermerRubrique();
      // Une mention sur la rubrique elle-même (« YAOURTS (L) ») vaut pour toutes ses lignes.
      const { texte: nom, mention } = lireMention(titre);
      rubrique = nom || titre;
      mentionRubrique = mention;
      reservee = rubriqueReservee(rubrique);
      lignesDeLaRubrique = 0;
      touteMarqueExplicite = false;
      continue;
    }
    if (rubrique === null) {
      preambule.push(ligne);
      continue;
    }
    if (TOUTE_MARQUE.test(ligne)) {
      if (reservee) avertissements.push(`« ${ligne} » sous la rubrique réservée « ${rubrique} » : ignoré (jamais « toute marque »).`);
      else touteMarqueExplicite = true;
      continue;
    }
    if (/^voir\s/i.test(ligne) || /^cf\.?\s/i.test(ligne)) {
      avertissements.push(`Renvoi non suivi sous « ${rubrique} » : « ${ligne} ».`);
      continue;
    }
    const lues = lireLigneProduit(ligne, rubrique, reservee);
    if (lues.length === 0) {
      avertissements.push(`Ligne non comprise sous « ${rubrique} » : « ${ligne} ».`);
      continue;
    }
    for (const l of lues) lignes.push({ ...l, mention: l.mention ?? mentionRubrique, ordre: ordre++ });
    lignesDeLaRubrique += lues.length;
  }
  fermerRubrique();
  if (rubrique === null) avertissements.push('Aucune rubrique reconnue : une rubrique est une ligne en MAJUSCULES ou terminée par « : ».');
  const note = preambule.join('\n').trim();
  return { lignes, avertissements, note: note ? note.slice(0, 4000) : null };
}
