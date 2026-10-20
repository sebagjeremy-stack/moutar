import type { Niveau, StatutComposition, StatutVerdict, Synthese, Ton } from '../index';
import { libelleNiveau } from './niveaux';

/**
 * Ce que la synthèse lit d'une ligne de la carte (sous-ensemble de `LigneCarte`). `valableJusquAu` : un JOUR ISO
 * (`AAAA-MM-JJ`, les dix premiers caractères sont lus) dans le fuseau du centre — le serveur le calcule
 * (`common/temps/jour-local.ts`), jamais `toISOString().slice(0, 10)`.
 */
export interface LigneSynthese {
  niveau: Niveau;
  statut: StatutVerdict;
  source: string | null;
  mention: string | null;
  composition: StatutComposition | null;
  valableJusquAu?: string | null;
}

/** Le statut EFFECTIF d'une ligne : une citation dont la validité est passée vaut « périmé » (jamais « permis »). */
export function statutEffectif(l: LigneSynthese, aujourdhui: string): StatutVerdict {
  if ((l.statut === 'cite' || l.statut === 'permis') && l.valableJusquAu && l.valableJusquAu.slice(0, 10) < aujourdhui.slice(0, 10)) return 'perime';
  return l.statut;
}

/** Une source qui dit « oui » et dont la validité tient. */
function ditOui(l: LigneSynthese): boolean {
  return (l.statut === 'cite' || l.statut === 'permis') && l.niveau !== 4;
}

/**
 * La synthèse selon le seuil (cadrage § 1 et § 4 ; maquette) : on lit les niveaux 1 à `seuil`, au jour `aujourdhui`
 * (ISO, fuseau du centre).
 * - une source dit « non cacher », à QUELQUE niveau que ce soit (même sous le seuil : choix le plus protecteur, à valider)
 *   → « Non cacher », fondée sur elle (le rouge, réservé) ;
 * - sinon, une source de niveau 1-3 dit « oui » (validité tenue) → « Permis », fondée sur la plus haute ;
 * - sinon → « Non vérifié » (ambre). Le niveau 4 n'est JAMAIS un vert : au mieux il reste « non vérifié ·
 *   composition seule » ; au pire il dit « non cacher ».
 * Une source périmée (statut `perime`, ou citation dont `valableJusquAu` est passé) ne fonde jamais un « permis » ;
 * sous le seuil 4 avec une composition lue, c'est la composition qui donne la pastille (« additif douteux » /
 * « composition seule »), la liste périmée restant lisible sur sa ligne (choix du 20/10/2026, fiche du lot 1).
 */
export function calculerSynthese(lignesBrutes: LigneSynthese[], seuil: Niveau, aujourdhui: string): Synthese {
  const lignes = lignesBrutes.map((l) => ({ ...l, statut: statutEffectif(l, aujourdhui) }));
  const lues = lignes.filter((l) => l.niveau <= seuil).sort((a, b) => a.niveau - b.niveau);
  const tete = `Selon votre seuil : ${libelleNiveau(seuil)}`;

  const non = [...lignes].sort((a, b) => a.niveau - b.niveau).find((l) => l.statut === 'non_casher');
  if (non) {
    return {
      verdict: 'non_casher',
      ton: 'danger',
      pastille: non.niveau === 4 ? 'Non cacher · composition' : non.mention ? `Non cacher · ${non.mention}` : 'Non cacher',
      source: non.source,
      niveauFondateur: non.niveau,
      phrase: non.source ? `Fondé sur ${non.source}.` : `${tete}.`,
      proposerScanIngredients: false,
    };
  }

  const oui = lues.find(ditOui);
  if (oui) {
    return {
      verdict: 'permis',
      ton: 'ok',
      pastille: oui.mention ? `Permis · ${oui.mention}` : `Permis · niveau ${oui.niveau}`,
      source: oui.source,
      niveauFondateur: oui.niveau,
      phrase: oui.source ? `Fondé sur ${oui.source}.` : `${tete}.`,
      proposerScanIngredients: false,
    };
  }

  const composition = lignes.find((l) => l.niveau === 4);
  const compositionLue = composition?.composition ?? null;
  const perimee = lues.find((l) => l.statut === 'perime');
  const ton: Ton = 'warn';
  // Lot 3 (correction du lot 2) : une marque citée sous une rubrique ÉTRANGÈRE au produit ne fonde pas un « permis » ;
  // la ligne arrive `non_verifie` avec sa mention (« rubrique « X » : à vérifier »), et la synthèse le dit.
  // Lot 5 : une contribution validée « douteux » (niveau 3) arrive de même `non_verifie` avec sa mention : la synthèse dit
  // « Non vérifié · douteux », fondée sur la communauté — jamais un « non cacher » (Moutar cite, il ne décide pas).
  const aVerifier = lues.find((l) => l.statut === 'non_verifie' && l.niveau !== 4 && l.mention);
  const douteux = aVerifier?.niveau === 3;
  if (compositionLue && seuil === 4) {
    // Au seuil 4, la composition donne la pastille, mais un « douteux » communautaire validé reste CITÉ dans la phrase.
    const signale = douteux ? `, et ${aVerifier?.source ?? 'la communauté'} le signale douteux` : '';
    return {
      verdict: 'non_verifie',
      ton,
      pastille: compositionLue === 'douteux' ? 'Non vérifié · additif douteux' : 'Non vérifié · composition seule',
      source: composition?.source ?? null,
      niveauFondateur: 4,
      phrase:
        compositionLue === 'douteux'
          ? `Un additif de la composition est douteux ; aucune liste ni certification ne cite ce produit${signale}.`
          : `Aucun additif repéré, mais la composition seule ne garantit rien ; aucune liste ni certification ne cite ce produit${signale}.`,
      proposerScanIngredients: false,
    };
  }
  return {
    verdict: 'non_verifie',
    ton,
    pastille: perimee ? 'Non vérifié · liste périmée' : douteux ? 'Non vérifié · douteux' : aVerifier ? 'Non vérifié · à vérifier' : 'Non vérifié',
    source: perimee?.source ?? aVerifier?.source ?? null,
    niveauFondateur: perimee?.niveau ?? aVerifier?.niveau ?? null,
    phrase: perimee
      ? `Cité seulement par une source périmée (${perimee.source ?? 'sans nom'}). Il reste la composition (niveau 4).`
      : douteux
        ? `Signalé douteux par ${aVerifier?.source ?? 'la communauté'} (${aVerifier?.mention}) : vérifiez avant d’acheter. Il reste la composition (niveau 4).`
        : aVerifier
        ? `Cité par ${aVerifier.source ?? 'une liste'} sous une autre rubrique (${aVerifier.mention}) : vérifiez que ce produit en relève. Il reste la composition (niveau 4).`
        : compositionLue
          ? 'Aucun logo lu, aucune liste ne cite ce produit. La composition (niveau 4) a été lue : voir ci-dessous.'
          : 'Aucun logo lu, aucune liste ne cite ce produit. Il reste la composition (niveau 4).',
    proposerScanIngredients: compositionLue === null,
  };
}
