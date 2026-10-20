import type { Additif, StatutAdditif } from '../index';

/**
 * La table d'additifs de Moutar — EN CODE, sourcée ligne par ligne (CLAUDE.md : jamais recopier un site sans licence).
 *
 * Honnêteté sur la source (20/10/2026) : chaque ligne est écrite de connaissance générale et porte la source
 * « connaissance générale — à confirmer par la liste de référence ». Le médecin-utilisateur confirme ou corrige ligne
 * par ligne depuis la console (`additif_surcharge`), qui l'emporte sur cette table. Rien ici ne cite un site non lu.
 *
 * `statut` : `casher` = d'origine minérale, végétale ou de synthèse, sans question connue ; `douteux` = une origine animale
 * est possible selon le fabricant (à vérifier, mention « origine animale possible ») ; `non_casher` = d'origine animale
 * interdite ou d'insecte, par nature.
 */
export const SOURCE_PROVISOIRE = 'connaissance générale — à confirmer par la liste de référence';

type Ligne = [code: string, nom: string, famille: string, statut: StatutAdditif, origineAnimalePossible: boolean, note: string];

const LIGNES: Ligne[] = [
  // Colorants
  ['E100', 'Curcumine', 'colorant', 'casher', false, 'Extrait de curcuma.'],
  ['E101', 'Riboflavine', 'colorant', 'casher', false, 'Vitamine B2, de synthèse ou de fermentation.'],
  ['E120', 'Cochenille, acide carminique, carmins', 'colorant', 'non_casher', true, 'Colorant tiré d’un insecte (cochenille).'],
  ['E140', 'Chlorophylles', 'colorant', 'casher', false, 'Pigment végétal.'],
  ['E150c', 'Caramel ammoniacal', 'colorant', 'casher', false, 'Sucre chauffé (procédé à l’ammoniaque).'],
  ['E153', 'Charbon végétal', 'colorant', 'douteux', true, 'Charbon : d’origine végétale le plus souvent, mais un charbon d’os (animal) existe : origine à vérifier.'],
  ['E150a', 'Caramel ordinaire', 'colorant', 'casher', false, 'Sucre chauffé.'],
  ['E150d', 'Caramel au sulfite d’ammonium', 'colorant', 'casher', false, 'Sucre chauffé.'],
  ['E160a', 'Carotènes', 'colorant', 'douteux', true, 'Végétal ou de synthèse ; support possible en gélatine (billes), fréquent dans les boissons.'],
  ['E160b', 'Rocou (annatto)', 'colorant', 'casher', false, 'Végétal (graines du rocouyer).'],
  ['E160c', 'Extrait de paprika', 'colorant', 'casher', false, 'Végétal.'],
  ['E163', 'Anthocyanes', 'colorant', 'casher', false, 'Pigments végétaux (raisin, chou rouge, baies).'],
  ['E162', 'Rouge de betterave', 'colorant', 'casher', false, 'Végétal.'],
  ['E171', 'Dioxyde de titane', 'colorant', 'casher', false, 'Minéral (interdit dans l’UE depuis 2022, encore vu sur des importations).'],
  ['E172', 'Oxydes de fer', 'colorant', 'casher', false, 'Minéral.'],
  // Conservateurs
  ['E200', 'Acide sorbique', 'conservateur', 'casher', false, 'De synthèse.'],
  ['E202', 'Sorbate de potassium', 'conservateur', 'casher', false, 'De synthèse.'],
  ['E211', 'Benzoate de sodium', 'conservateur', 'casher', false, 'De synthèse.'],
  ['E220', 'Dioxyde de soufre', 'conservateur', 'casher', false, 'Minéral (fréquent dans le vin : le vin lui-même pose question).'],
  ['E223', 'Métabisulfite de sodium', 'conservateur', 'casher', false, 'Minéral.'],
  ['E250', 'Nitrite de sodium', 'conservateur', 'casher', false, 'Minéral (charcuterie : c’est la viande qui pose question, pas l’additif).'],
  ['E252', 'Nitrate de potassium', 'conservateur', 'casher', false, 'Minéral.'],
  ['E260', 'Acide acétique', 'conservateur', 'casher', false, 'De synthèse ou de fermentation (le vinaigre de vin, lui, pose la question du vin).'],
  ['E262', 'Acétates de sodium', 'conservateur', 'casher', false, 'Sel minéral de l’acide acétique.'],
  ['E270', 'Acide lactique', 'acidifiant', 'casher', false, 'Fermentation ou synthèse ; support possible. Le nom ne dit rien du lait.'],
  ['E282', 'Propionate de calcium', 'conservateur', 'casher', false, 'Sel minéral, de synthèse (panification).'],
  ['E296', 'Acide malique', 'acidifiant', 'casher', false, 'Fermentation ou synthèse ; support possible.'],
  // Antioxydants et acidifiants
  ['E300', 'Acide ascorbique', 'antioxydant', 'casher', false, 'Vitamine C, de synthèse.'],
  ['E301', 'Ascorbate de sodium', 'antioxydant', 'casher', false, 'De synthèse.'],
  ['E306', 'Extrait riche en tocophérols', 'antioxydant', 'casher', false, 'Végétal (huiles).'],
  ['E322', 'Lécithines', 'émulsifiant', 'casher', false, 'Le plus souvent de soja ou de tournesol ; une lécithine d’œuf existe (mentionnée alors sur l’étiquette).'],
  ['E325', 'Lactate de sodium', 'acidifiant', 'casher', false, 'De fermentation ; le nom ne dit rien du lait.'],
  ['E330', 'Acide citrique', 'acidifiant', 'casher', false, 'De fermentation (mélasse).'],
  ['E331', 'Citrates de sodium', 'acidifiant', 'casher', false, 'De synthèse.'],
  ['E338', 'Acide phosphorique', 'acidifiant', 'casher', false, 'Minéral.'],
  ['E340', 'Phosphates de potassium', 'stabilisant', 'casher', false, 'Sels minéraux.'],
  ['E341', 'Phosphates de calcium', 'stabilisant', 'casher', false, 'Sels minéraux.'],
  ['E401', 'Alginate de sodium', 'gélifiant', 'casher', false, 'Algues.'],
  ['E406', 'Agar-agar', 'gélifiant', 'casher', false, 'Algues.'],
  // Épaississants, gélifiants
  ['E407', 'Carraghénanes', 'gélifiant', 'casher', false, 'Algues.'],
  ['E410', 'Farine de graines de caroube', 'épaississant', 'casher', false, 'Végétal.'],
  ['E412', 'Gomme guar', 'épaississant', 'casher', false, 'Végétal.'],
  ['E414', 'Gomme arabique', 'épaississant', 'casher', false, 'Végétal (acacia).'],
  ['E415', 'Gomme xanthane', 'épaississant', 'casher', false, 'De fermentation.'],
  ['E420', 'Sorbitol', 'édulcorant', 'casher', false, 'De synthèse (hydrogénation du glucose).'],
  ['E421', 'Mannitol', 'édulcorant', 'casher', false, 'De synthèse ou de fermentation.'],
  ['E422', 'Glycérol', 'humectant', 'douteux', true, 'De synthèse ou tiré de graisses, végétales ou animales : origine à vérifier.'],
  ['E440', 'Pectines', 'gélifiant', 'casher', false, 'Végétal (pomme, agrumes).'],
  ['E428', 'Gélatine', 'gélifiant', 'non_casher', true, 'Même produit que E441 sous son autre numéro (tags Open Food Facts) : peau et os d’animaux (porc, bœuf).'],
  ['E441', 'Gélatine', 'gélifiant', 'non_casher', true, 'Tirée de peau et d’os d’animaux (porc, bœuf) ; une gélatine de poisson cacher existe mais ne se lit pas au code.'],
  ['E450', 'Diphosphates', 'stabilisant', 'casher', false, 'Minéral.'],
  ['E451', 'Triphosphates', 'stabilisant', 'casher', false, 'Minéral.'],
  ['E452', 'Polyphosphates', 'stabilisant', 'casher', false, 'Minéral.'],
  ['E460', 'Cellulose', 'épaississant', 'casher', false, 'Végétal.'],
  ['E461', 'Méthylcellulose', 'épaississant', 'casher', false, 'Végétal modifié.'],
  ['E464', 'Hydroxypropylméthylcellulose', 'épaississant', 'casher', false, 'Végétal modifié.'],
  ['E466', 'Carboxyméthylcellulose', 'épaississant', 'casher', false, 'Végétal modifié.'],
  // Émulsifiants d’origine grasse : possible origine animale
  ['E470a', 'Sels de sodium, potassium et calcium d’acides gras', 'émulsifiant', 'douteux', true, 'Acides gras végétaux ou animaux : à vérifier.'],
  ['E470b', 'Sels de magnésium d’acides gras', 'émulsifiant', 'douteux', true, 'Acides gras végétaux ou animaux : à vérifier.'],
  ['E471', 'Mono- et diglycérides d’acides gras', 'émulsifiant', 'douteux', true, 'Très courant (pains, glaces) ; végétal ou animal selon le fabricant : à vérifier.'],
  ['E472a', 'Esters acétiques des mono- et diglycérides', 'émulsifiant', 'douteux', true, 'Dérivé de E471 : même question.'],
  ['E472b', 'Esters lactiques des mono- et diglycérides', 'émulsifiant', 'douteux', true, 'Dérivé de E471 : même question.'],
  ['E472c', 'Esters citriques des mono- et diglycérides', 'émulsifiant', 'douteux', true, 'Dérivé de E471 : même question.'],
  ['E472e', 'Esters monoacétyltartriques et diacétyltartriques', 'émulsifiant', 'douteux', true, 'Dérivé de E471 (panification) : même question.'],
  ['E473', 'Sucroesters d’acides gras', 'émulsifiant', 'douteux', true, 'Acides gras végétaux ou animaux : à vérifier.'],
  ['E475', 'Esters polyglycériques d’acides gras', 'émulsifiant', 'douteux', true, 'Acides gras végétaux ou animaux : à vérifier.'],
  ['E476', 'Polyricinoléate de polyglycérol', 'émulsifiant', 'douteux', true, 'Huile de ricin, glycérol d’origine variable.'],
  ['E481', 'Stéaroyl-2-lactylate de sodium', 'émulsifiant', 'douteux', true, 'Acide stéarique végétal ou animal : à vérifier.'],
  ['E482', 'Stéaroyl-2-lactylate de calcium', 'émulsifiant', 'douteux', true, 'Acide stéarique végétal ou animal : à vérifier.'],
  ['E491', 'Monostéarate de sorbitane', 'émulsifiant', 'douteux', true, 'Acide stéarique végétal ou animal : à vérifier.'],
  ['E492', 'Tristéarate de sorbitane', 'émulsifiant', 'douteux', true, 'Acide stéarique végétal ou animal : à vérifier.'],
  ['E495', 'Monopalmitate de sorbitane', 'émulsifiant', 'douteux', true, 'Acide palmitique végétal ou animal : à vérifier.'],
  ['E500', 'Carbonates de sodium', 'poudre à lever', 'casher', false, 'Minéral (bicarbonate).'],
  ['E503', 'Carbonates d’ammonium', 'poudre à lever', 'casher', false, 'Minéral.'],
  ['E509', 'Chlorure de calcium', 'affermissant', 'casher', false, 'Minéral.'],
  ['E542', 'Phosphate d’os', 'antiagglomérant', 'non_casher', true, 'Tiré d’os d’animaux, par nature.'],
  ['E551', 'Dioxyde de silicium', 'antiagglomérant', 'casher', false, 'Minéral.'],
  ['E570', 'Acides gras', 'antiagglomérant', 'douteux', true, 'Acide stéarique végétal ou animal : à vérifier.'],
  // Exhausteurs de goût
  ['E620', 'Acide glutamique', 'exhausteur de goût', 'casher', false, 'De fermentation.'],
  ['E621', 'Glutamate monosodique', 'exhausteur de goût', 'casher', false, 'De fermentation.'],
  ['E627', 'Guanylate disodique', 'exhausteur de goût', 'douteux', true, 'De fermentation le plus souvent ; une origine animale (poisson, viande) existe.'],
  ['E631', 'Inosinate disodique', 'exhausteur de goût', 'douteux', true, 'Souvent tiré de viande ou de poisson ; parfois de fermentation : à vérifier.'],
  ['E635', 'Ribonucléotides disodiques', 'exhausteur de goût', 'douteux', true, 'Mélange de E627 et E631 : même question.'],
  ['E640', 'Glycine', 'exhausteur de goût', 'douteux', true, 'Acide aminé de synthèse le plus souvent ; une origine animale (hydrolyse de gélatine) existe : à vérifier.'],
  // Agents d’enrobage
  ['E901', 'Cire d’abeille', 'agent d’enrobage', 'douteux', true, 'Produit par l’abeille (comme le miel) ; admise par la plupart des autorités, pas par toutes : à vérifier par le certificateur.'],
  ['E903', 'Cire de carnauba', 'agent d’enrobage', 'casher', false, 'Végétal (palmier).'],
  ['E904', 'Shellac (gomme-laque)', 'agent d’enrobage', 'douteux', true, 'Sécrétion d’un insecte ; admis par certaines autorités, pas par toutes : à vérifier.'],
  ['E913', 'Lanoline', 'agent d’enrobage', 'douteux', true, 'Graisse de laine de mouton.'],
  ['E920', 'L-cystéine', 'agent de traitement de la farine', 'douteux', true, 'Origine fréquente : plumes de canard ou cheveux humains ; fermentation possible, à vérifier par le certificateur.'],
  ['E950', 'Acésulfame K', 'édulcorant', 'casher', false, 'De synthèse.'],
  ['E951', 'Aspartame', 'édulcorant', 'casher', false, 'De synthèse.'],
  ['E952', 'Cyclamates', 'édulcorant', 'casher', false, 'De synthèse.'],
  ['E954', 'Saccharine', 'édulcorant', 'casher', false, 'De synthèse.'],
  ['E955', 'Sucralose', 'édulcorant', 'casher', false, 'De synthèse (sucre chloré).'],
  ['E965', 'Maltitol', 'édulcorant', 'casher', false, 'De synthèse (hydrogénation du maltose).'],
  ['E967', 'Xylitol', 'édulcorant', 'casher', false, 'De synthèse (bois, maïs).'],
  ['E1105', 'Lysozyme', 'conservateur', 'douteux', true, 'Protéine du blanc d’œuf : l’œuf est parvé ; la question est celle du fromage qui le contient.'],
  ['E1400', 'Dextrines', 'épaississant', 'casher', false, 'Amidon chauffé.'],
  ['E1404', 'Amidon oxydé', 'épaississant', 'casher', false, 'Amidon modifié.'],
  ['E1412', 'Phosphate de diamidon', 'épaississant', 'casher', false, 'Amidon modifié.'],
  ['E1414', 'Phosphate de diamidon acétylé', 'épaississant', 'casher', false, 'Amidon modifié.'],
  ['E1420', 'Amidon acétylé', 'épaississant', 'casher', false, 'Amidon modifié.'],
  ['E1422', 'Adipate de diamidon acétylé', 'épaississant', 'casher', false, 'Amidon modifié.'],
  ['E1442', 'Phosphate de diamidon hydroxypropylé', 'épaississant', 'casher', false, 'Amidon modifié.'],
  ['E1520', 'Propylène glycol', 'humectant', 'casher', false, 'De synthèse.'],
];

export const ADDITIFS: readonly Additif[] = LIGNES.map(([code, nom, famille, statut, origineAnimalePossible, note]) => ({
  code,
  nom,
  famille,
  statut,
  origineAnimalePossible,
  note,
  source: SOURCE_PROVISOIRE,
}));

export const ADDITIFS_PAR_CODE: ReadonlyMap<string, Additif> = new Map(ADDITIFS.map((a) => [a.code, a]));

/**
 * Synonymes courants lus dans une liste d'ingrédients en toutes lettres, vers un code E (mots entiers, sans accent
 * obligatoire). Un synonyme ne joue que si le libellé EST ce terme, jamais par inclusion dans un mot plus long ; et si un
 * code E est écrit entre parenthèses après le libellé, c'est LUI qui compte (règle d'analyse, `extraireSynonymes`).
 * Libellés composés exclus ici (20/10/2026) : « rouge cochenille A » (E124, un azoïque de synthèse) et « carmin d'indigo »
 * (E132) ne sont pas la cochenille ; « gélatine de poisson » et « gélatine végétale » ne sont pas E441 (elles valent un
 * ingrédient suspect « gélatine : origine à examiner », dans la règle d'analyse). Le synonyme « gélatine » pointe E441 ;
 * E428 (le même produit sous son autre numéro) ne se lit que par un code ou un tag.
 */
export const SYNONYMES_ADDITIFS: ReadonlyArray<{ terme: RegExp; code: string }> = [
  { terme: /g[ée]latine(?!\s+(?:de\s+poisson|v[ée]g[ée]tale))/iu, code: 'E441' },
  { terme: /(?<!rouge\s)cochenille(?!\s+a\b)|carmins?(?!\s+d[’']indigo)|acide carminique/iu, code: 'E120' },
  { terme: /l[ée]cithines?(?: de (?:soja|tournesol|colza))?/iu, code: 'E322' },
  { terme: /shellac|gomme[- ]laque/iu, code: 'E904' },
  { terme: /cire d[’']abeille/iu, code: 'E901' },
  { terme: /l-?cyst[ée]ine/iu, code: 'E920' },
  { terme: /lysozyme/iu, code: 'E1105' },
  { terme: /mono-? ?et diglyc[ée]rides(?: d[’']acides gras)?/iu, code: 'E471' },
  { terme: /glyc[ée]rol|glyc[ée]rine/iu, code: 'E422' },
  { terme: /carragh[ée]nanes?/iu, code: 'E407' },
  { terme: /gomme xanthane/iu, code: 'E415' },
  { terme: /pectines?/iu, code: 'E440' },
  { terme: /acide citrique/iu, code: 'E330' },
];
