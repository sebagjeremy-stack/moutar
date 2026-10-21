import { createHash } from 'node:crypto';
import type { Database } from '../../database/client';
import { journalProduit } from '../../database/schema';

/** Un exécuteur d'écriture : la base, ou la transaction en cours. */
export type ExecuteurProduit = Pick<Database, 'insert'>;

export type ActionJournalProduit = 'ingredients.ecriture' | 'produit.creation';

/** Pure : l'empreinte SHA-256 (hexadécimal) d'un texte — ce que le journal garde À LA PLACE du texte. */
export function empreinteTexte(texte: string): string {
  return createHash('sha256').update(texte, 'utf8').digest('hex');
}

/** Pure : la ligne du journal pour un texte écrit (longueur et empreinte ; un texte absent vaut vide). */
export function ligneJournalProduit(produitId: string, action: ActionJournalProduit, source: string, texte: string | null): { produitId: string; action: ActionJournalProduit; source: string; longueur: number; empreinte: string } {
  const t = texte ?? '';
  return { produitId, action, source, longueur: t.length, empreinte: empreinteTexte(t) };
}

/**
 * La SEULE voie d'écriture de `journal_produit` (ajout seul) : une ligne, sur la base ou DANS la transaction de l'écriture
 * qu'elle trace — la fiche et sa trace vont ensemble, ou pas du tout.
 */
export async function noterEcritureProduit(executeur: ExecuteurProduit, produitId: string, action: ActionJournalProduit, source: string, texte: string | null): Promise<void> {
  await executeur.insert(journalProduit).values(ligneJournalProduit(produitId, action, source, texte));
}
