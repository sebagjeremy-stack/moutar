import type { CodeListe, LigneListe, SousLigneListe } from '@moutar/shared-types';
import { MOTS_VIDES_RUBRIQUE, libelleMention } from '@moutar/shared-types/catalogues/rubriques-listes';
import { contientMotsEntiers, normaliser, partagentUnMot } from '@moutar/shared-types/regles/normalisation';

/**
 * Règle PURE du niveau 2 (lot 2) : ce qu'UNE liste active dit d'un produit (nom, marque).
 * - `cite` : une ligne nomme la marque (mots entiers, normalisés : « Lu » ne se lit pas dans « Lutine ») — et, si la ligne
 *   nomme aussi un produit, ce libellé figure dans le nom —, ou une ligne sans marque nomme un produit qui figure dans le
 *   nom. Confiance FORTE quand la rubrique de la ligne se retrouve aussi dans le nom du produit (« BISCUITS » / « Biscuits
 *   petit beurre »), FAIBLE sinon (la marque est citée pour une autre famille de produits, peut-être) ;
 * - `cite_par_rubrique` : aucune marque nommée ne correspond, mais une rubrique « toute marque » partage un mot avec le nom
 *   du produit (« YAOURTS » / « Yaourt nature ») : toute marque y est autorisée — confiance faible, toujours ;
 * - `non_cite` sinon ;
 * - `perime` : cité, mais la validité de la liste est passée au jour `aujourdhui` (jour du centre, `AAAA-MM-JJ`).
 * La mention de la ligne (« lait non surveillé ») est portée en libellé humain. Moutar ne décide pas : il cite.
 */
export interface ListeActive {
  id: string;
  code: CodeListe;
  titre: string;
  publieLe: string | null;
  valableJusquAu: string | null;
  lignes: ReadonlyArray<Pick<LigneListe, 'id' | 'rubrique' | 'marque' | 'produitLibelle' | 'mention' | 'touteMarque' | 'rubriqueReservee'>>;
}

export interface ProduitACiter {
  nom: string;
  marque: string | null;
}

type LigneDeListe = ListeActive['lignes'][number];

interface Candidate {
  ligne: LigneDeListe;
  statut: 'cite' | 'cite_par_rubrique';
  confiance: 'forte' | 'faible';
  /** Pour trier : plus c'est petit, mieux c'est. */
  rang: number;
  motRubrique: string | null;
}

/** Le libellé court d'une liste pour une pastille. */
export const NOM_COURT_LISTE: Record<CodeListe, string> = { consistoire_paris: 'Consistoire', rav_wolff: 'Rav Wolff' };

const JOUR_FR = (jour: string | null): string => (jour && /^\d{4}-\d{2}-\d{2}/.test(jour) ? `${jour.slice(8, 10)}/${jour.slice(5, 7)}/${jour.slice(0, 4)}` : '');

function rubriqueDansLeNom(ligne: LigneDeListe, nom: string): string | null {
  return partagentUnMot(ligne.rubrique, nom, MOTS_VIDES_RUBRIQUE);
}

export function listePerimee(liste: Pick<ListeActive, 'valableJusquAu'>, aujourdhui: string): boolean {
  return Boolean(liste.valableJusquAu) && liste.valableJusquAu!.slice(0, 10) < aujourdhui.slice(0, 10);
}

/** Le meilleur candidat d'une liste pour un produit, ou null. Exporté pour les tests ; `correspondanceListe` l'habille. */
export function meilleureLigne(produit: ProduitACiter, lignes: ListeActive['lignes']): Candidate | null {
  const nom = normaliser(produit.nom);
  const texte = normaliser(`${produit.marque ?? ''} ${produit.nom}`);
  const candidats: Candidate[] = [];
  for (const ligne of lignes) {
    if (ligne.touteMarque) {
      const mot = rubriqueDansLeNom(ligne, nom);
      if (mot) candidats.push({ ligne, statut: 'cite_par_rubrique', confiance: 'faible', rang: 40, motRubrique: mot });
      continue;
    }
    const marqueOk = ligne.marque ? contientMotsEntiers(texte, ligne.marque) : false;
    const libelle = normaliser(ligne.produitLibelle);
    const libelleOk = libelle.length >= 4 && contientMotsEntiers(texte, libelle);
    const motRubrique = rubriqueDansLeNom(ligne, nom);
    if (ligne.marque && ligne.produitLibelle) {
      if (marqueOk && libelleOk) candidats.push({ ligne, statut: 'cite', confiance: 'forte', rang: 0, motRubrique });
      continue;
    }
    if (ligne.marque && marqueOk) {
      candidats.push(motRubrique ? { ligne, statut: 'cite', confiance: 'forte', rang: 10, motRubrique } : { ligne, statut: 'cite', confiance: 'faible', rang: 20, motRubrique });
      continue;
    }
    if (!ligne.marque && libelleOk) {
      candidats.push({ ligne, statut: 'cite', confiance: motRubrique ? 'forte' : 'faible', rang: motRubrique ? 11 : 30, motRubrique });
    }
  }
  candidats.sort((a, b) => a.rang - b.rang);
  return candidats[0] ?? null;
}

export function correspondanceListe(produit: ProduitACiter, liste: ListeActive, aujourdhui: string): SousLigneListe {
  const base = { listeId: liste.id, code: liste.code, source: liste.titre, publieLe: liste.publieLe, valableJusquAu: liste.valableJusquAu };
  const edition = `${liste.titre}${liste.publieLe ? ` (${JOUR_FR(liste.publieLe)})` : ''}`;
  const validite = liste.valableJusquAu ? `, valable jusqu'au ${JOUR_FR(liste.valableJusquAu)}` : '';
  const meilleur = meilleureLigne(produit, liste.lignes);
  if (!meilleur) {
    const quoi = produit.marque ? `ni la marque « ${produit.marque} » ni le produit « ${produit.nom} »` : `le produit « ${produit.nom} » (sans marque connue)`;
    return { ...base, statut: 'non_cite', confiance: null, mention: null, detail: `${edition}${validite} : ${quoi} n'y figurent.`, ligne: null };
  }
  const { ligne } = meilleur;
  const mention = libelleMention(ligne.mention);
  const suffixeMention = mention ? ` Mention : ${mention}.` : '';
  let detail: string;
  if (meilleur.statut === 'cite_par_rubrique') {
    detail = `${edition}${validite} : rubrique « ${ligne.rubrique} » sans marque nommée, toute marque autorisée (le nom du produit contient « ${meilleur.motRubrique} »).${suffixeMention}`;
  } else if (ligne.marque && ligne.produitLibelle) {
    detail = `${edition}${validite} : « ${ligne.marque} — ${ligne.produitLibelle} » nommé sous la rubrique « ${ligne.rubrique} ».${suffixeMention}`;
  } else if (ligne.marque) {
    detail =
      meilleur.confiance === 'forte'
        ? `${edition}${validite} : la marque « ${ligne.marque} » est nommée sous la rubrique « ${ligne.rubrique} ».${suffixeMention}`
        : `${edition}${validite} : la marque « ${ligne.marque} » est nommée sous la rubrique « ${ligne.rubrique} » — vérifiez que ce produit en relève.${suffixeMention}`;
  } else {
    detail = `${edition}${validite} : le produit « ${ligne.produitLibelle} » est nommé sous la rubrique « ${ligne.rubrique} ».${suffixeMention}`;
  }
  const perimee = listePerimee(liste, aujourdhui);
  return {
    ...base,
    statut: perimee ? 'perime' : meilleur.statut,
    confiance: meilleur.confiance,
    mention,
    detail: perimee ? `${detail} Liste PÉRIMÉE depuis le ${JOUR_FR(liste.valableJusquAu)} : à relire dans l'édition suivante.` : detail,
    ligne: { id: ligne.id, rubrique: ligne.rubrique, marque: ligne.marque, produitLibelle: ligne.produitLibelle },
  };
}

/** Toutes les listes actives, dans l'ordre reçu. */
export function correspondanceListes(produit: ProduitACiter, listes: ListeActive[], aujourdhui: string): SousLigneListe[] {
  return listes.map((l) => correspondanceListe(produit, l, aujourdhui));
}
