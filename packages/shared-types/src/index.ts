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

/** Origine d'une fiche produit. */
export type SourceProduit = 'off' | 'manuel' | 'ocr';

export interface Additif {
  code: string;
  nom: string;
  famille: string;
  statut: StatutAdditif;
  origineAnimalePossible: boolean;
  note: string;
  source: string;
}

export interface Certificateur {
  code: string;
  nom: string;
  pays: string;
  mentions: string[];
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
