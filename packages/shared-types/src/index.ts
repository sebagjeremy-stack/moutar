/**
 * Contrat des types partagés entre l'API et l'écran (Moutar). Aucune logique ici : les règles vivent dans `regles/`,
 * les catalogues dans `catalogues/`.
 */

/** Le rite : `casher` seul en v1 ; le champ existe pour ne rien fermer (cadrage, note du 20/10/2026). */
export type Rite = 'casher';

/** Les quatre niveaux de confiance, du plus haut (1) au plus bas (4). */
export type Niveau = 1 | 2 | 3 | 4;

/** Ce qu'une source dit d'un produit. `perime` : cité par une source dont la validité est passée. */
export type StatutVerdict = 'cite' | 'non_cite' | 'permis' | 'non_casher' | 'non_verifie' | 'perime';

/** Statut d'un additif dans la table de Moutar ; `inconnu` : code jamais examiné. */
export type StatutAdditif = 'casher' | 'douteux' | 'non_casher' | 'inconnu';

/** Résultat de l'analyse d'une composition (niveau 4). */
export type StatutComposition = 'aucun_additif_problematique' | 'douteux' | 'non_casher';

/** Le ton d'une pastille : le mot s'écrit TOUJOURS à côté ; le rouge est réservé à « non cacher ». */
export type Ton = 'ok' | 'warn' | 'danger' | 'neutre';

/** Origine d'une fiche produit ; `ocr` : des ingrédients lus sur une photo, relus et validés par l'utilisateur (lot 3). */
export type SourceProduit = 'off' | 'manuel' | 'ocr';

/** Origine d'une saisie d'ingrédients (`PUT /produits/:ean/ingredients`) : collés à la main, ou lus par OCR puis relus. */
export type SourceIngredients = 'manuel' | 'ocr';

export interface Additif {
  code: string;
  nom: string;
  famille: string;
  statut: StatutAdditif;
  origineAnimalePossible: boolean;
  note: string;
  source: string;
}

/**
 * Les mentions qu'un logo de certification peut porter (lot 3) : elles qualifient la certification, elles ne la remplacent
 * pas. Codes stables ; libellés humains dans `catalogues/certificateurs.ts` (`libelleMentionCertification`).
 */
export type MentionCertification = 'parve' | 'halavi' | 'lait_non_surveille' | 'pessah' | 'mehadrin';

/** Un certificateur du catalogue EN CODE (dix en v1, cadrage § 8.3) ; la console peut en désactiver un (`certificateur_surcharge`). */
export interface Certificateur {
  code: string;
  nom: string;
  /** Le nom de la pastille (« Certifié · OU »). */
  nomCourt: string;
  pays: string;
  /** Les textes lisibles sur le logo, en mots entiers (« OU », « Orthodox Union », « KBDP », « Beth Din de Paris »…). */
  motsCles: string[];
  mentionsPossibles: MentionCertification[];
  /** Description courte de la forme du logo, en français (sert à la correspondance : « OU » exige le cercle). */
  formeDuLogo: string;
}

/* ---------- Lot 3 : lecture d'un logo, certification de niveau 1, OCR ---------- */

/** Ce que le modèle de vision a lu : des CANDIDATS, jamais un verdict (c'est le code qui fait la correspondance). */
export interface LectureLogo {
  candidats: Array<{ texteLu: string; forme: string; confiance: number }>;
  /** Les mentions lues près des symboles, telles quelles (« PARVE », « D », « pessah »…). */
  mentions: string[];
  autresTextes: string[];
}

/** Une PROPOSITION de certificateur, à valider d'un clic par l'utilisateur ; rien n'est écrit tant qu'il ne l'a pas fait. */
export interface PropositionCertificateur {
  code: string;
  nom: string;
  nomCourt: string;
  /** 0 à 1 : la confiance du modèle pondérée par la force du mot-clé reconnu. */
  confiance: number;
  texteLu: string;
  mentions: MentionCertification[];
}

/** La réponse de `POST /produits/:ean/logo` et `POST /logos/lire`. */
export interface ResultatLectureLogo {
  propositions: PropositionCertificateur[];
  /** Vrai quand aucun certificateur du catalogue n'a été reconnu (ce n'est PAS un « non cacher »). */
  aucun: boolean;
  /** Les symboles lus par le modèle qui ne correspondent à aucun certificateur du catalogue (l'utilisateur peut les signaler). */
  candidatsNonReconnus: string[];
  autresTextes: string[];
  /**
   * Le JETON de la proposition (16 octets aléatoires, base64url, 15 minutes, une validation) : la validation d'un clic le
   * renvoie dans le corps, jamais dans l'adresse ; null quand rien n'est proposé. Il ne vaut que pour le produit de la lecture.
   */
  jeton: string | null;
}

/** La certification de niveau 1 d'un produit, VALIDÉE par l'utilisateur (verdict `cite`, source = le certificateur). */
export interface CertificationProduit {
  verdictId: string;
  code: string;
  nom: string;
  nomCourt: string;
  mentions: MentionCertification[];
  /** Les libellés humains des mentions (« parvé », « halavi »), dans le même ordre. */
  mentionsLibelles: string[];
  texteLu: string | null;
  /** Instant de la validation (ISO). */
  publieLe: string;
  /** Faux quand la console a désactivé ce certificateur depuis : la carte ne dit plus « certifié ». */
  certificateurActif: boolean;
}

/** La transcription d'une liste d'ingrédients par OCR : rendue SANS être enregistrée (l'utilisateur relit, puis `PUT …/ingredients`). */
export interface TranscriptionOcr {
  /** Le texte lu, nettoyé par le code (« E 1 2 0 » → « E120 », césures, retours à la ligne). */
  texte: string;
  /** Le texte tel que le modèle l'a rendu, avant nettoyage (pour relire). */
  texteBrut: string;
  langue: string | null;
  lisible: boolean;
  confiance: number;
}

/* ---------- Lot 4 : transcription de secours (`POST /transcriptions`) ---------- */

/** La transcription d'une dictée par le moteur (Whisper, OVH) quand la Web Speech API du navigateur fait défaut : rendue, jamais conservée. */
export interface TranscriptionAudio {
  texte: string;
  /** La langue reconnue (`fr`…), ou null si le moteur ne la dit pas. */
  langue: string | null;
  /** 0 à 1 quand le moteur en donne une ; null sinon. */
  confiance: number | null;
}

export interface Produit {
  id: string;
  ean: string | null;
  nom: string;
  marque: string | null;
  imageUrl: string | null;
  ingredientsTexte: string | null;
  /**
   * Codes E lus dans la fiche source, normalisés (ex. `E322`). Un tag d'Open Food Facts que `normaliserCodeE` ne lit pas
   * (`en:e14xx`) est gardé tel quel : l'analyse le COMPTE comme non lu (`tagsIgnores`) au lieu de le taire.
   */
  additifs: string[];
  source: SourceProduit;
  /** Date de lecture de la fiche source (ISO). */
  luLe: string;
}

export interface AdditifAnalyse {
  code: string;
  nom: string;
  statut: StatutAdditif;
  origineAnimalePossible: boolean;
  source: string;
}

export interface AnalyseComposition {
  additifs: AdditifAnalyse[];
  statut: StatutComposition;
  /** Ingrédients en toutes lettres qui posent question (ex. « gélatine », « vin »). */
  ingredientsSuspects: string[];
  /** Nombre d'ingrédients comptés dans le texte (0 si le texte manque). */
  nombreIngredients: number;
  /** Tags d'additifs de la source que le code n'a pas su lire (`en:e160a-i`, `en:e14xx`) : comptés, jamais tus. */
  tagsIgnores: number;
}

export interface Verdict {
  id: string;
  produitId: string;
  niveau: Niveau;
  rite: Rite;
  statut: StatutVerdict;
  source: string;
  mention: string | null;
  publieLe: string | null;
  valableJusquAu: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
}

/** Une ligne de la carte produit : une par niveau. La pastille porte son mot ; le ton n'est qu'un renfort. */
export interface LigneCarte {
  niveau: Niveau;
  statut: StatutVerdict;
  /** Le mot de la pastille (obligatoire). */
  pastille: string;
  ton: Ton;
  /** La source qui fonde la ligne (nom), ou null si aucune. */
  source: string | null;
  /** Phrase de détail (source · date · validité). */
  detail: string;
  mention: string | null;
  publieLe: string | null;
  valableJusquAu: string | null;
  /** Niveau 4 seulement. */
  composition: StatutComposition | null;
  /** Niveau 4 seulement : l'avertissement, toujours présent quand la composition a été lue. */
  avertissement: string | null;
  /** Niveau 2 seulement (lot 2) : ce que dit CHAQUE liste active, une sous-ligne par liste ; absent aux autres niveaux. */
  sousLignes?: SousLigneListe[];
  /** Niveau 3 seulement (lot 5) : vrai quand aucune contribution validée ne fonde la ligne — l'écran propose « Proposer une contribution ». */
  proposerContribution?: boolean;
}

/* ---------- Lot 5 : contributions communautaires (niveau 3), signalements ---------- */

/** Ce qu'une contribution propose : cité (permis) par la source, non cité, douteux. Jamais « non cacher » (Moutar cite, il ne décide pas). */
export type StatutContribution = 'cite' | 'non_cite' | 'douteux';
/** La source citée : Les Bons Plans Cachères (`lbpc`), ou une autre source communautaire. */
export type SourceContribution = 'lbpc' | 'autre';
export type EtatContribution = 'proposee' | 'validee' | 'refusee';

/** Ce que le public envoie (`POST /produits/:ean/contributions`). Les textes sont gardés en texte brut (balises retirées). */
export interface PropositionContribution {
  statutPropose: StatutContribution;
  sourceType: SourceContribution;
  /** Ce que dit la source (≤ 1 000 caractères). */
  sourceTexte: string;
  /** Le jour de la publication citée (`AAAA-MM-JJ`), ou null. */
  sourceDate: string | null;
  /** Un lien https vers un hôte admis (facebook.com, lesbonsplanscachers.fr…), ou null. */
  preuveUrl: string | null;
  /** Un pseudonyme (≤ 40), ou null. */
  auteurNom: string | null;
}

export interface ContributionProposee {
  id: string;
  etat: 'proposee';
}

/** Une contribution VALIDÉE telle que le public la lit (`GET /produits/:ean/contributions`). */
export interface ContributionPublique {
  id: string;
  statutPropose: StatutContribution;
  sourceType: SourceContribution;
  sourceTexte: string;
  sourceDate: string | null;
  preuveUrl: string | null;
  auteurNom: string | null;
  /** Instant de la validation à la console (ISO). */
  valideeLe: string;
}

export interface ContributionsProduit {
  contributions: ContributionPublique[];
  /** Le nombre de contributions proposées, en attente de validation. */
  enAttente: number;
}

/** Le produit tel que la console le nomme à côté d'une contribution ou d'un signalement. */
export interface ProduitNomme {
  id: string;
  ean: string | null;
  nom: string;
  marque: string | null;
}

/** Une contribution à la console (`GET /admin/contributions?etat=`). */
export interface ContributionConsole {
  id: string;
  produit: ProduitNomme;
  niveau: Niveau;
  statutPropose: StatutContribution;
  sourceType: SourceContribution;
  sourceTexte: string;
  sourceDate: string | null;
  preuveUrl: string | null;
  auteurNom: string | null;
  etat: EtatContribution;
  valideeLe: string | null;
  motifRefus: string | null;
  createdAt: string;
  updatedAt: string;
}

export type EtatSignalement = 'ouvert' | 'traite';

/** « Signaler une erreur » sur une ligne de la carte (`POST /produits/:ean/signalements`). */
export interface Signalement {
  niveau: Niveau;
  /** ≤ 500 caractères, texte brut. */
  texte: string;
}

export interface SignalementCree {
  id: string;
  etat: 'ouvert';
}

export interface SignalementConsole {
  id: string;
  produit: ProduitNomme;
  niveau: Niveau;
  texte: string;
  etat: EtatSignalement;
  traiteLe: string | null;
  createdAt: string;
}

/** Le tableau de bord de la console (`GET /admin/tableau`) : des COMPTES, jamais une personne. */
export interface TableauConsole {
  /** Le jour du centre (`AAAA-MM-JJ`) auquel « du jour » se rapporte. */
  jour: string;
  produitsLus: number;
  contributionsEnAttente: number;
  signalementsOuverts: number;
  lecturesIaDuJour: number;
}

/** Une ligne de `journal_ia` lue à la console : des nombres et des codes, jamais un contenu (il n'y en a pas). */
export interface LigneJournalIa {
  id: string;
  fournisseur: string;
  modele: string;
  usage: 'lecture_logo' | 'ocr_ingredients' | 'transcription';
  dureeMs: number;
  jetonsEntree: number | null;
  jetonsSortie: number | null;
  ok: boolean;
  erreur: string | null;
  createdAt: string;
}

export interface PageJournalIa {
  lignes: LigneJournalIa[];
  /** À partir de 1. */
  page: number;
  parPage: number;
  total: number;
}

/* ---------- Lot 2 : listes officielles ---------- */

/** Les listes importées : Consistoire de Paris (« Produits 2025-2026 »), Rav Wolff (liste 2026, Chiourim). */
export type CodeListe = 'consistoire_paris' | 'rav_wolff';

/** Une édition importée d'une liste. Les dates `publieLe` et `valableJusquAu` sont des JOURS (`AAAA-MM-JJ`) ou null. */
export interface ListeOfficielle {
  id: string;
  code: CodeListe;
  titre: string;
  publieLe: string | null;
  valableJusquAu: string | null;
  /** Instant de l'import (ISO). */
  importeLe: string;
  fichierNom: string | null;
  /** La note d'introduction de la source (avis, réserves), telle que lue ou corrigée. */
  noteSource: string | null;
  /** Une seule liste active par code : l'import d'une édition neuve désactive l'ancienne. */
  active: boolean;
  nombreLignes: number;
}

/**
 * Une ligne d'une liste : une rubrique ; une marque et/ou un produit nommés, ou aucun (`touteMarque` : toute marque
 * autorisée dans la rubrique). `mention` : `lait_non_surveille` (« (L) ») ou un texte libre. `rubriqueReservee` : famille
 * toujours sous surveillance (viande, charcuterie, vin, jus de raisin, fromage) — jamais « toute marque ».
 */
export interface LigneListe {
  id: string;
  listeId: string;
  rubrique: string;
  marque: string | null;
  produitLibelle: string | null;
  mention: string | null;
  touteMarque: boolean;
  rubriqueReservee: boolean;
  ordre: number;
}

/** Une ligne telle que l'analyseur la lit (aperçu), avant qu'elle ait un identifiant. */
export type LigneAnalysee = Omit<LigneListe, 'id' | 'listeId'>;

/**
 * Ce qu'une liste dit d'un produit : `cite` (marque ou produit nommé), `cite_par_rubrique` (rubrique sans marque nommée :
 * toute marque autorisée — confiance plus faible), `non_cite`, `perime` (cité, mais la validité de la liste est passée).
 */
export type StatutSousLigne = 'cite' | 'cite_par_rubrique' | 'non_cite' | 'perime';

export interface SousLigneListe {
  listeId: string;
  code: CodeListe;
  /** Le titre de la liste (la source). */
  source: string;
  publieLe: string | null;
  valableJusquAu: string | null;
  statut: StatutSousLigne;
  /** `forte` : la rubrique de la ligne correspond aussi au produit ; `faible` : la marque seule, ou la rubrique seule. */
  confiance: 'forte' | 'faible' | null;
  /** Libellé humain de la mention (« lait non surveillé »), ou null. */
  mention: string | null;
  detail: string;
  /** La ligne de la liste qui fonde la sous-ligne, ou null. */
  ligne: { id: string; rubrique: string; marque: string | null; produitLibelle: string | null } | null;
}

/** La recherche publique par nom ou marque (`GET /recherche?q=`) : des produits connus ET des lignes de listes. */
export interface ProduitTrouve {
  id: string;
  ean: string | null;
  nom: string;
  marque: string | null;
  imageUrl: string | null;
}

export interface LigneTrouvee {
  id: string;
  listeId: string;
  code: CodeListe;
  source: string;
  publieLe: string | null;
  valableJusquAu: string | null;
  /** Vrai quand la validité de la liste est passée au jour du centre. */
  perimee: boolean;
  rubrique: string;
  marque: string | null;
  produitLibelle: string | null;
  mention: string | null;
  touteMarque: boolean;
}

export interface ResultatRecherche {
  q: string;
  produits: ProduitTrouve[];
  lignes: LigneTrouvee[];
}

export interface CarteProduit {
  produit: Produit;
  seuil: Niveau;
  lignes: LigneCarte[];
  synthese: Synthese;
  analyse: AnalyseComposition | null;
}

/** La synthèse selon le seuil : ce que l'écran met en tête, avec la source qui la fonde. */
export interface Synthese {
  verdict: 'permis' | 'non_verifie' | 'non_casher';
  ton: Ton;
  pastille: string;
  /** La source qui fonde la synthèse, ou null. */
  source: string | null;
  niveauFondateur: Niveau | null;
  /** Phrase sous la pastille. */
  phrase: string;
  /** Vrai quand il reste à scanner les ingrédients (niveaux 1-3 non vérifiés, composition non lue). */
  proposerScanIngredients: boolean;
}
