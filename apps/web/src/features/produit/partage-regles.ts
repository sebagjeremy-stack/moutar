import type { CarteProduit } from '@moutar/shared-types';
import { libelleNiveau } from '@moutar/shared-types/regles/niveaux';

/**
 * Pure : le résumé partagé d'une carte (lot 4) — la synthèse selon le seuil, puis UNE ligne par niveau avec sa source,
 * exactement ce que la carte affiche. Rien de personnel : ni seuil nommé comme « le vôtre », ni historique, ni adresse
 * de l'utilisateur ; l'adresse jointe est celle de la fiche (un identifiant seulement).
 */
export interface Partage {
  titre: string;
  texte: string;
  /** Le chemin de la fiche, à préfixer par l'origine ; l'EAN seul. */
  chemin: string | null;
}

export function resumeDePartage(carte: CarteProduit): Partage {
  const { produit: p, synthese, lignes } = carte;
  const nom = [p.nom, p.marque].filter(Boolean).join(' · ');
  const sources = lignes.map((l) => {
    const source = l.source ? ` — ${l.source}` : '';
    const mention = l.mention ? ` (${l.mention})` : '';
    return `${libelleNiveau(l.niveau)} : ${l.pastille}${source}${mention}`;
  });
  const texte = [`${nom}`, `${synthese.pastille} (seuil : ${libelleNiveau(carte.seuil)})`, synthese.phrase, '', ...sources, '', 'Moutar ne décide pas, il cite : chaque ligne porte sa source et sa date.'].join('\n');
  return { titre: `Moutar · ${p.nom}`, texte, chemin: p.ean ? `/produit/${p.ean}` : null };
}
