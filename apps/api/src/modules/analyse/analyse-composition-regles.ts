import type { Additif, AdditifAnalyse, AnalyseComposition, StatutAdditif, StatutComposition } from '@moutar/shared-types';
import { ADDITIFS_PAR_CODE, SYNONYMES_ADDITIFS } from '@moutar/shared-types/catalogues/additifs';
import { normaliserCodeE } from '@moutar/shared-types/regles/niveaux';

/**
 * Règle PURE de l'analyse d'une composition (niveau 4). Elle ne lit ni base ni réseau : le service lui passe le texte,
 * les tags d'OFF et les surcharges de console. Ce qu'elle rend est une CITATION de la table d'additifs, jamais un
 * verdict seul : le service y ajoute l'avertissement.
 */

/** L'avertissement du niveau 4, dans le code (CLAUDE.md, cadrage § 2 ; « viande et fromage non certifiés » ajouté le 20/10/2026). */
export const AVERTISSEMENT_COMPOSITION =
  'La composition seule ne garantit rien : équipement partagé, arômes, lait non surveillé, vin, bichoul, viande et fromage non certifiés ne s’y lisent pas.';

export const SOURCE_TABLE = 'la table d’additifs Moutar';

/** Le libellé d'un code E absent de la table : il reste « douteux » (on ne dit jamais « rien à signaler » sur ce qu'on n'a pas examiné). */
export const NOM_NON_REPERTORIE = 'non répertorié';

/** Une surcharge de console : le statut, sa source, sa note. */
export interface SurchargeAdditif {
  code: string;
  statut: StatutAdditif;
  source: string;
  note: string | null;
}

/**
 * Ingrédients en toutes lettres qui posent question sans être des additifs. Mots entiers (lettres Unicode) ; un terme ne
 * joue que s'il EST le mot, jamais par inclusion (« vinaigre » n'est pas « vin », « porcelaine » n'est pas « porc »,
 * « moules » à gâteaux n'est pas un fruit de mer : retiré le 20/10/2026).
 * Les « arômes » n'y sont pas : l'avertissement du niveau 4 les couvre déjà (à valider par le médecin-utilisateur).
 * « viande », « bœuf », « veau », « agneau », « poulet », « volaille », « dinde », « fromage » valent « douteux » sous le
 * libellé « viande ou fromage non certifiés » (20/10/2026, à valider) ; « gélatine de poisson » et « gélatine végétale »
 * ne sont pas E441 : elles valent « gélatine : origine à examiner ».
 */
const INGREDIENTS_SUSPECTS: ReadonlyArray<{ terme: RegExp; libelle: string; statut: Exclude<StatutComposition, 'aucun_additif_problematique'> }> = [
  { terme: /porc|saindoux|lard|lardons?/iu, libelle: 'porc', statut: 'non_casher' },
  { terme: /jambons?/iu, libelle: 'charcuterie', statut: 'non_casher' },
  { terme: /fruits? de mer|crevettes?|crabes?|calamars?|hu[iî]tres?/iu, libelle: 'fruits de mer', statut: 'non_casher' },
  { terme: /graisse animale|graisses animales/iu, libelle: 'graisse animale', statut: 'douteux' },
  { terme: /pr[ée]sure(?: animale)?/iu, libelle: 'présure', statut: 'douteux' },
  { terme: /vin(?: blanc| rouge| rosé)?|vins/iu, libelle: 'vin', statut: 'douteux' },
  { terme: /g[ée]latine\s+(?:de\s+poisson|v[ée]g[ée]tale)/iu, libelle: 'gélatine : origine à examiner', statut: 'douteux' },
  { terme: /viandes?|b(?:œ|oe)ufs?|veau|agneau|poulets?|volailles?|dindes?|fromages?/iu, libelle: 'viande ou fromage non certifiés', statut: 'douteux' },
];

/** Entoure un motif de frontières de MOT Unicode (JS : `\b` ignore les lettres accentuées). */
function motEntier(motif: RegExp, drapeaux = 'iu'): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${motif.source})(?![\\p{L}\\p{N}])`, drapeaux);
}

/** Un code E écrit entre parenthèses juste après le libellé courant (avant la virgule suivante) : « rouge cochenille A (E124) ». */
const CODE_ENTRE_PARENTHESES_APRES = /^[^,;()]*\(\s*e[\s-]?\d{3,4}/iu;

/** Un « E » précédé de « vitamine » ou « vit. » est une vitamine, pas un additif (« vitamine E 100 mg »). */
const PRECEDE_PAR_VITAMINE = /(?:vitamines?|vit\.?)\s*$/iu;
/** Un code suivi d'une unité est une quantité (« ÉNERGIE 250 kcal », « DE 120 g », « CONTENANCE 500 ml »), pas un additif. */
const SUIVI_PAR_UNITE = /^\s?(?:mg|µg|μg|g|kg|%|kcal|kj|ml|cl|l)(?![\p{L}\p{N}])/iu;

/**
 * Pure : vrai quand ce qui ressemble à un code E, entre `debut` et `fin` dans `source`, est en fait une vitamine E
 * (« vitamine E 100 mg », « vit. E ») ou une quantité (suivie d'une unité : mg, µg, g, %, kcal, kJ, ml…). Partagée par
 * l'analyse (lot 1) et le nettoyage de l'OCR (lot 3), qui ne recolle jamais un tel « E ».
 */
export function vitamineOuQuantite(source: string, debut: number, fin: number): boolean {
  return PRECEDE_PAR_VITAMINE.test(source.slice(Math.max(0, debut - 12), debut)) || SUIVI_PAR_UNITE.test(source.slice(fin, fin + 6));
}

/**
 * Pure : les codes E écrits dans un texte (E 322, e322, E-322, E472e, E 472 e, E450i → E450), sans doublon, dans l'ordre.
 * Un espace avant la lettre est toléré ; des chiffres espacés (« E 1 2 0 », OCR) ne se lisent pas (lot 3) ; une vitamine E
 * suivie d'un nombre ou un nombre suivi d'une unité ne se lisent pas non plus (« vitamine E 100 mg », `vitamineOuQuantite`).
 */
export function extraireCodesE(texte: string): string[] {
  const vus = new Set<string>();
  for (const m of texte.matchAll(/(?<![\p{L}\p{N}])e[\s-]?(\d{3,4})(?:\s?([a-hj-uw-z]))?(?:[ivx]{1,4})?(?![\p{L}\p{N}])/giu)) {
    const debut = m.index ?? 0;
    if (vitamineOuQuantite(texte, debut, debut + m[0].length)) continue;
    const code = normaliserCodeE(m[0].replace(/\s|-/g, ''));
    if (code) vus.add(code);
  }
  return [...vus];
}

/**
 * Pure : les codes E désignés par un synonyme en toutes lettres (gélatine → E441…). Si un code E est écrit entre
 * parenthèses après le libellé (« rouge cochenille A (E124) »), c'est lui qui compte : le synonyme ne joue pas.
 */
export function extraireSynonymes(texte: string): string[] {
  const vus = new Set<string>();
  for (const s of SYNONYMES_ADDITIFS) {
    for (const m of texte.matchAll(motEntier(s.terme, 'giu'))) {
      const suite = texte.slice((m.index ?? 0) + m[0].length);
      if (CODE_ENTRE_PARENTHESES_APRES.test(suite)) continue;
      vus.add(s.code);
      break;
    }
  }
  return [...vus];
}

/** Pure : les ingrédients suspects en toutes lettres. */
export function extraireIngredientsSuspects(texte: string): Array<{ libelle: string; statut: 'douteux' | 'non_casher' }> {
  const vus: Array<{ libelle: string; statut: 'douteux' | 'non_casher' }> = [];
  for (const s of INGREDIENTS_SUSPECTS) if (motEntier(s.terme).test(texte) && !vus.some((v) => v.libelle === s.libelle)) vus.push({ libelle: s.libelle, statut: s.statut });
  return vus;
}

/** Compte les ingrédients d'un texte (séparés par des virgules ou des points-virgules hors parenthèses). */
export function compterIngredients(texte: string): number {
  let profondeur = 0;
  let n = texte.trim() ? 1 : 0;
  for (const c of texte) {
    if (c === '(' || c === '[') profondeur++;
    else if (c === ')' || c === ']') profondeur = Math.max(0, profondeur - 1);
    else if ((c === ',' || c === ';') && profondeur === 0) n++;
  }
  return n;
}

const POIDS: Record<StatutAdditif, number> = { casher: 0, inconnu: 1, douteux: 1, non_casher: 2 };

/** La ligne effective d'un code : la surcharge de console l'emporte sur le catalogue ; un code absent de la table reste « inconnu » (douteux), libellé « non répertorié ». */
export function ligneEffective(code: string, catalogue: ReadonlyMap<string, Additif>, surcharges: ReadonlyMap<string, SurchargeAdditif>): AdditifAnalyse {
  const base = catalogue.get(code);
  const sur = surcharges.get(code);
  if (sur) {
    return { code, nom: base?.nom ?? NOM_NON_REPERTORIE, statut: sur.statut, origineAnimalePossible: base?.origineAnimalePossible ?? false, source: sur.source };
  }
  if (base) return { code, nom: base.nom, statut: base.statut, origineAnimalePossible: base.origineAnimalePossible, source: base.source };
  return { code, nom: NOM_NON_REPERTORIE, statut: 'inconnu', origineAnimalePossible: false, source: 'code absent de la table : à examiner' };
}

export interface EntreeAnalyse {
  ingredientsTexte: string | null;
  /** Tags d'additifs de la source (OFF `additives_tags`, normalisés ou non : un tag illisible est compté). */
  additifsTags: string[];
}

/**
 * L'analyse : codes E du texte + tags de la source + synonymes, croisés avec la table (et ses surcharges) ; puis les
 * ingrédients suspects. Le statut global est le pire rencontré ; un code inconnu vaut « douteux » (on ne dit jamais
 * « rien à signaler » sur ce qu'on n'a pas examiné) ; un tag que le code ne sait pas lire est compté (`tagsIgnores`).
 */
export function analyserComposition(
  entree: EntreeAnalyse,
  surcharges: ReadonlyMap<string, SurchargeAdditif> = new Map(),
  catalogue: ReadonlyMap<string, Additif> = ADDITIFS_PAR_CODE,
): AnalyseComposition {
  const texte = entree.ingredientsTexte ?? '';
  const codes = new Set<string>();
  let tagsIgnores = 0;
  for (const t of entree.additifsTags) {
    const c = normaliserCodeE(t);
    if (c) codes.add(c);
    else tagsIgnores++;
  }
  for (const c of extraireCodesE(texte)) codes.add(c);
  for (const c of extraireSynonymes(texte)) codes.add(c);

  const additifs = [...codes].sort(comparerCodes).map((c) => ligneEffective(c, catalogue, surcharges));
  const suspects = extraireIngredientsSuspects(texte);

  let pire = 0;
  for (const a of additifs) pire = Math.max(pire, POIDS[a.statut]);
  for (const s of suspects) pire = Math.max(pire, s.statut === 'non_casher' ? 2 : 1);
  const statut: StatutComposition = pire === 2 ? 'non_casher' : pire === 1 ? 'douteux' : 'aucun_additif_problematique';

  return { additifs, statut, ingredientsSuspects: suspects.map((s) => s.libelle), nombreIngredients: compterIngredients(texte), tagsIgnores };
}

function comparerCodes(a: string, b: string): number {
  const na = Number(/\d+/.exec(a)?.[0] ?? 0);
  const nb = Number(/\d+/.exec(b)?.[0] ?? 0);
  return na - nb || a.localeCompare(b);
}
