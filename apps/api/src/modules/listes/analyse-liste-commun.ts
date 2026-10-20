import type { LigneAnalysee } from '@moutar/shared-types';
import { MENTION_LAIT_NON_SURVEILLE, RUBRIQUES_RESERVEES } from '@moutar/shared-types/catalogues/rubriques-listes';
import { contientMotsEntiers, normaliser, radical } from '@moutar/shared-types/regles/normalisation';

/**
 * Socle PUR des analyseurs de listes (lot 2). Le texte d'une liste (PDF converti, ou texte collé) devient des lignes
 * `LigneAnalysee` et des avertissements (ce que l'analyseur n'a pas compris, ou a deviné). Heuristiques, à régler sur
 * les vrais fichiers (les échantillons des tests sont FICTIFS) ; la console permet de corriger chaque ligne avant l'import.
 *
 * - une ligne en MAJUSCULES (trois lettres au moins, aucune minuscule), ou qui se termine par « : » (quatre mots au
 *   plus), est une RUBRIQUE — sauf une ligne en majuscules d'un ou deux mots qui suit DIRECTEMENT (sans ligne vide) la
 *   rubrique courante ou ses marques et n'a aucune ligne sous elle : c'est une MARQUE de cette rubrique (« CANDIA » entre
 *   « YAOURTS » et « BISCUITS », « LU » entre « BISCUITS » et « CONFITURES ») — signalée, à vérifier à l'aperçu ;
 * - sous une rubrique, chaque ligne nomme une marque (« Lu »), une marque et ses produits (« Lu : Petit Beurre, Prince »),
 *   ou plusieurs marques (« Lu, Bonne Maman ») ; une marque contient au moins une lettre (un nombre nu est du bruit) ;
 * - « (L) », « (l) » ou « lait non surveillé » → mention `lait_non_surveille` ; une autre parenthèse → mention libre ;
 * - « Toutes marques » sous une rubrique → `touteMarque` ; une rubrique sans aucune ligne aussi, mais avec un AVERTISSEMENT
 *   qui la nomme (est-ce une marque ?) ; jamais sous une rubrique RÉSERVÉE (viande, charcuterie, vin, jus de raisin,
 *   fromage — un avertissement le dit) ;
 * - « sauf », « excepté », « hors », « voir », « cf. » n'importe où dans une ligne → avertissement qui cite la ligne (une
 *   restriction ou un renvoi que l'analyseur ne suit pas) ; un renvoi en tête de ligne n'est pas lu comme une marque ;
 * - une ligne finissant par « - » au milieu d'un mot se recolle à la suivante (« Bonne Ma- / man » → « Bonne Maman ») ;
 * - ce qui précède la première rubrique est la NOTE de la source (introduction, avis) — jamais perdue ;
 * - un numéro de page (« 3 », « page 3 », « - 3 - »), un filet, une ligne d'un caractère, un code-barres nu, l'intitulé de
 *   la source (« Consistoire de Paris », « Rav Wolff », « Produits 2025-2026 », le titre fourni) sont ignorés sans bruit.
 */
export interface ResultatAnalyseListe {
  lignes: LigneAnalysee[];
  avertissements: string[];
  /** Le texte qui précède la première rubrique (introduction de la source), ou null. */
  note: string | null;
}

export interface OptionsAnalyse {
  /** Une ligne courte en Capitale initiale suivie de « : » vaut rubrique (toujours) ; avec cette option, une ligne courte sans deux-points mais en « Titre » précédée d'une ligne vide aussi (jamais la première ligne du fichier). */
  rubriqueParTitre?: boolean;
  /** Longueur maximale d'une rubrique (au-delà, une ligne en majuscules est un avertissement, pas une rubrique). */
  longueurMaxRubrique?: number;
  /** Le titre de l'édition saisi à la console : une ligne qui lui est égale est du bruit (en-tête de page répété). */
  titre?: string | null;
}

// « - 4 - » arrive en « 4 - » (le tiret de tête est retiré par `nettoyer`) : les deux formes sont du bruit.
const BRUIT = [/^\d{1,4}$/, /^page\s*\d+/i, /^[-–—_.·•*=]+$/, /^.$/, /^([-–—]\s*)?\d{1,4}\s*[-–—]$/, /^produits\s+\d{4}\s*[-–—/]\s*\d{2,4}$/i, /^\d{8,14}$/];
/** Les intitulés des sources : une ligne qui n'est QUE cela est un en-tête répété, pas une rubrique ni une marque. */
const INTITULES_SOURCES = ['consistoire de paris', 'rav wolff', 'liste du rav wolff'];
const TOUTE_MARQUE = /^(toutes?\s+(les\s+)?marques?|tout\s+produit|tous\s+(les\s+)?produits)\s*\.?$/i;
const RENVOI_EN_TETE = /^(voir|cf\.?)\s/i;
const RESTRICTION = /(^|[^\p{L}])(sauf|excepté|excepte|hors|voir|cf\.?)(?=$|[^\p{L}])/iu;
const MENTION_L = /\(\s*l\s*\)/i;
const MENTION_LAIT = /\(?\s*lait\s+non\s+surveill[ée]e?\s*\)?/i;
const PARENTHESE_FINALE = /\(([^()]{1,80})\)\s*$/;
const CESURE = /\p{L}-$/u;
const MOTS_MAX_RUBRIQUE_TITRE = 4;

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

function estBruit(ligne: string, options: OptionsAnalyse): boolean {
  if (BRUIT.some((re) => re.test(ligne))) return true;
  const n = normaliser(ligne);
  if (INTITULES_SOURCES.includes(n)) return true;
  const titre = normaliser(options.titre);
  return Boolean(titre) && n === titre;
}

function nettoyer(brut: string): string {
  return brut
    .replace(/\s+/g, ' ')
    .replace(/^[•*\-–—>]+\s*/, '')
    .trim();
}

const nombreDeMots = (texte: string): number => texte.split(/\s+/).filter(Boolean).length;

/** Une ligne en majuscules : trois lettres au moins, aucune minuscule (les chiffres et la ponctuation ne comptent pas). */
export function estEnMajuscules(ligne: string): boolean {
  const lettres = ligne.replace(/[^\p{L}]/gu, '');
  return lettres.length >= 3 && lettres === lettres.toLocaleUpperCase('fr-FR');
}

/** Une marque ou un libellé nomme quelque chose : au moins une lettre (« 15 », « 2024 » ne sont pas des marques). */
export function contientUneLettre(texte: string | null | undefined): boolean {
  return /\p{L}/u.test(texte ?? '');
}

function estRubrique(ligne: string, options: OptionsAnalyse, precedenteVide: boolean): string | null {
  const max = options.longueurMaxRubrique ?? 80;
  const sansDeuxPoints = ligne.replace(/\s*:\s*$/, '');
  if (sansDeuxPoints !== ligne && sansDeuxPoints.length > 0 && sansDeuxPoints.length <= max && !/[,;]/.test(sansDeuxPoints) && nombreDeMots(sansDeuxPoints) <= MOTS_MAX_RUBRIQUE_TITRE) return sansDeuxPoints;
  if (estEnMajuscules(ligne) && ligne.length <= max) return ligne.replace(/\s*:\s*$/, '');
  if (options.rubriqueParTitre && precedenteVide && ligne.length <= 40 && !/[,;:()\d]/.test(ligne) && /^\p{Lu}/u.test(ligne) && nombreDeMots(ligne) <= MOTS_MAX_RUBRIQUE_TITRE) return ligne;
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
 * « Lu, Bonne Maman » (plusieurs marques). La mention vaut pour chaque ligne produite. Une marque sans lettre (« 15 »)
 * n'existe pas (avertissement) ; une marque d'un seul caractère est gardée mais signalée ; un renvoi (« voir … ») en
 * produit n'est pas lu. Les avertissements vont dans `avertissements` quand il est donné.
 */
export function lireLigneProduit(brut: string, rubrique: string, reservee: boolean, avertissements: string[] = []): Array<Omit<LigneAnalysee, 'ordre'>> {
  const { texte, mention } = lireMention(brut);
  if (!texte) return [];
  const base = { rubrique, mention, touteMarque: false, rubriqueReservee: reservee };
  const marqueValide = (m: string): boolean => {
    if (!contientUneLettre(m)) {
      avertissements.push(`Marque sans lettre « ${m} » sous « ${rubrique} » : ignorée (un nombre n'est pas une marque).`);
      return false;
    }
    if (m.length === 1) avertissements.push(`Marque d'un seul caractère « ${m} » sous « ${rubrique} » : à vérifier.`);
    return true;
  };
  const sep = /\s+[-–—]\s+|\s*:\s+/.exec(texte);
  if (sep && sep.index > 0) {
    const marque = nettoyer(texte.slice(0, sep.index));
    if (!marqueValide(marque)) return [];
    const produits = morceaux(texte.slice(sep.index + sep[0].length)).filter((p) => {
      if (RENVOI_EN_TETE.test(p)) {
        avertissements.push(`Renvoi non suivi sous « ${rubrique} » : « ${p} » (marque « ${marque} »).`);
        return false;
      }
      return true;
    });
    if (produits.length === 0) return [{ ...base, marque, produitLibelle: null }];
    return produits.map((p) => ({ ...base, marque, produitLibelle: p }));
  }
  return morceaux(texte)
    .filter(marqueValide)
    .map((m) => ({ ...base, marque: m, produitLibelle: null }));
}

/** Les lignes nettoyées du texte, les césures recollées (« Bonne Ma- » + « man » → « Bonne Maman ») ; une ligne vide reste vide. */
export function lignesDuTexte(texte: string): string[] {
  const brutes = texte.split(/\r?\n/).map(nettoyer);
  const lignes: string[] = [];
  for (let i = 0; i < brutes.length; i++) {
    let ligne = brutes[i];
    while (CESURE.test(ligne) && i + 1 < brutes.length && /^\p{Ll}/u.test(brutes[i + 1])) {
      ligne = ligne.slice(0, -1) + brutes[i + 1];
      i++;
    }
    lignes.push(ligne);
  }
  return lignes;
}

/** L'analyse commune ; les analyseurs nommés ne diffèrent que par leurs options. */
export function analyserTexteListe(texte: string, options: OptionsAnalyse = {}): ResultatAnalyseListe {
  const lignes: LigneAnalysee[] = [];
  const avertissements: string[] = [];
  const preambule: string[] = [];
  const toutes = lignesDuTexte(texte);
  let rubrique: string | null = null;
  let reservee = false;
  let lignesDeLaRubrique = 0;
  let touteMarqueExplicite = false;
  // La première ligne du fichier n'est jamais un « titre isolé » : un préambule qui commence par un mot seul reste la note.
  let precedenteVide = false;
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
      if (sansLigne && !touteMarqueExplicite) avertissements.push(`Rubrique « ${rubrique} » sans aucune marque : lue comme « toute marque autorisée » — est-ce une marque ?`);
      lignes.push({ rubrique, marque: null, produitLibelle: null, mention: mentionRubrique, touteMarque: true, rubriqueReservee: false, ordre: ordre++ });
    }
  };

  /** Vrai quand la ligne `i` n'a aucune ligne sous elle : la prochaine ligne utile est une rubrique, ou il n'y en a plus. */
  const sansLigneDessous = (i: number): boolean => {
    let vide = false;
    for (let j = i + 1; j < toutes.length; j++) {
      const suivante = toutes[j];
      if (!suivante) {
        vide = true;
        continue;
      }
      if (estBruit(suivante, options)) continue;
      return estRubrique(suivante, options, vide) !== null;
    }
    return true;
  };

  for (let i = 0; i < toutes.length; i++) {
    const ligne = toutes[i];
    if (!ligne) {
      precedenteVide = true;
      continue;
    }
    if (estBruit(ligne, options)) continue;
    const vide = precedenteVide;
    precedenteVide = false;
    if (rubrique !== null && TOUTE_MARQUE.test(ligne)) {
      // Testé AVANT la rubrique : « TOUTES MARQUES » en majuscules n'est pas une rubrique.
      if (reservee) avertissements.push(`« ${ligne} » sous la rubrique réservée « ${rubrique} » : ignoré (jamais « toute marque »).`);
      else touteMarqueExplicite = true;
      continue;
    }
    if (/:\s*$/.test(ligne) && nombreDeMots(ligne.replace(/\s*:\s*$/, '')) > MOTS_MAX_RUBRIQUE_TITRE && !estEnMajuscules(ligne)) {
      avertissements.push(`Ligne terminée par « : » mais trop longue pour une rubrique (plus de ${MOTS_MAX_RUBRIQUE_TITRE} mots) : ignorée — « ${ligne} ».`);
      continue;
    }
    let titre = estRubrique(ligne, options, vide);
    // Une ligne en MAJUSCULES d'un ou deux mots, collée (sans ligne vide) à la rubrique courante ou à ses marques, sans rien
    // dessous : une marque de cette rubrique (« LU » sous « BISCUITS », « CANDIA » sous « YAOURTS »), pas une rubrique.
    // Jamais pour une rubrique RÉSERVÉE (« VINS », « FROMAGES » : vides par nature dans la source, elles restent des rubriques).
    if (titre !== null && rubrique !== null && !vide && estEnMajuscules(ligne) && nombreDeMots(ligne) <= 2 && !/:\s*$/.test(ligne) && !rubriqueReservee(ligne) && sansLigneDessous(i)) {
      avertissements.push(`« ${ligne} » lu comme une marque de « ${rubrique} » (en majuscules, collé à la rubrique ou à ses marques, rien dessous) : à vérifier.`);
      titre = null;
    }
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
    const restriction = RESTRICTION.test(ligne);
    if (restriction) {
      avertissements.push(`Restriction ou renvoi non suivi sous « ${rubrique} » : « ${ligne} » — relisez la ligne à l'aperçu.`);
      if (RENVOI_EN_TETE.test(ligne)) continue;
    }
    const lues = lireLigneProduit(ligne, rubrique, reservee, avertissements);
    if (lues.length === 0) {
      if (!restriction && contientUneLettre(ligne)) avertissements.push(`Ligne non comprise sous « ${rubrique} » : « ${ligne} ».`);
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
