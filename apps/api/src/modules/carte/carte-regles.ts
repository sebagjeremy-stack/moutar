import type { AnalyseComposition, LigneCarte, Produit, SousLigneListe } from '@moutar/shared-types';
import { calculerSynthese, type LigneSynthese } from '@moutar/shared-types/regles/synthese';
import { AVERTISSEMENT_COMPOSITION, SOURCE_TABLE } from '../analyse/analyse-composition-regles';
import { NOM_COURT_LISTE } from '../listes/correspondance-liste-regles';

/**
 * Règles PURES des lignes de la carte (lot 1). Les niveaux 1 à 3 n'existent pas encore : ils disent « non vérifié »
 * (ambre), JAMAIS « non ». Le niveau 4 n'est jamais vert.
 */
export function ligneCertifie(): LigneCarte {
  return {
    niveau: 1,
    statut: 'non_verifie',
    pastille: 'Aucun logo lu',
    ton: 'neutre',
    source: null,
    detail: 'Aucune certification reconnue : la lecture du logo arrive au lot 3.',
    mention: null,
    publieLe: null,
    valableJusquAu: null,
    composition: null,
    avertissement: null,
  };
}

/**
 * Niveau 2 (lot 2) : UNE ligne pour l'écran, qui porte ce que dit CHAQUE liste active (`sousLignes`). La pastille suit la
 * meilleure sous-ligne : `cite` (vert, « Cité · Consistoire ») > `cite_par_rubrique` (vert, « Cité par rubrique », confiance
 * plus faible, le détail le dit) > `perime` (ambre, « Cité · liste périmée ») > `non_cite` (neutre, « Non cité » — ce n'est
 * pas un « non ») ; sans aucune liste active : « Non vérifié » (ambre, « aucune liste importée »).
 */
export function ligneListeOfficielle(sousLignes: SousLigneListe[] = []): LigneCarte {
  const base = { niveau: 2 as const, composition: null, avertissement: null, sousLignes };
  if (sousLignes.length === 0) {
    return { ...base, statut: 'non_verifie', pastille: 'Non vérifié', ton: 'warn', source: null, detail: 'Aucune liste officielle importée : la console permet d’importer le Consistoire de Paris et le Rav Wolff.', mention: null, publieLe: null, valableJusquAu: null };
  }
  const detail = sousLignes.map((s) => s.detail).join(' ');
  const citee = parConfiance(sousLignes).find((s) => s.statut === 'cite');
  if (citee) {
    return { ...base, statut: 'cite', pastille: `Cité · ${NOM_COURT_LISTE[citee.code]}`, ton: 'ok', source: citee.source, detail, mention: mentionSousLigne(citee), publieLe: citee.publieLe, valableJusquAu: citee.valableJusquAu };
  }
  const parRubrique = sousLignes.find((s) => s.statut === 'cite_par_rubrique');
  if (parRubrique) {
    return { ...base, statut: 'cite', pastille: `Cité par rubrique · ${NOM_COURT_LISTE[parRubrique.code]}`, ton: 'ok', source: parRubrique.source, detail, mention: mentionSousLigne(parRubrique), publieLe: parRubrique.publieLe, valableJusquAu: parRubrique.valableJusquAu };
  }
  const perimee = sousLignes.find((s) => s.statut === 'perime');
  if (perimee) {
    return { ...base, statut: 'perime', pastille: 'Cité · liste périmée', ton: 'warn', source: perimee.source, detail, mention: perimee.mention, publieLe: perimee.publieLe, valableJusquAu: perimee.valableJusquAu };
  }
  return { ...base, statut: 'non_cite', pastille: 'Non cité', ton: 'neutre', source: null, detail, mention: null, publieLe: null, valableJusquAu: null };
}

/**
 * Ce que la synthèse lit du niveau 2 : UNE `LigneSynthese` PAR liste active (chacune avec sa validité), ou la ligne
 * agrégée elle-même quand aucune liste n'est importée.
 */
export function lignesSyntheseNiveau2(ligne: LigneCarte): LigneSynthese[] {
  const sousLignes = ligne.sousLignes ?? [];
  if (sousLignes.length === 0) return [{ niveau: 2, statut: ligne.statut, source: ligne.source, mention: ligne.mention, composition: null, valableJusquAu: ligne.valableJusquAu }];
  return parConfiance(sousLignes).map((s) => ({
    niveau: 2,
    statut: s.statut === 'non_cite' ? 'non_cite' : s.statut === 'perime' ? 'perime' : 'cite',
    source: s.source,
    mention: mentionSousLigne(s),
    composition: null,
    valableJusquAu: s.valableJusquAu,
  }));
}

/** Les sous-lignes, confiance forte d'abord (tri stable : à confiance égale, l'ordre des listes). */
function parConfiance(sousLignes: SousLigneListe[]): SousLigneListe[] {
  const rang = (s: SousLigneListe): number => (s.confiance === 'forte' ? 0 : s.confiance === 'faible' ? 1 : 2);
  return [...sousLignes].sort((a, b) => rang(a) - rang(b));
}

/**
 * La mention d'une sous-ligne pour une pastille : une marque citée sous une rubrique étrangère au nom du produit (confiance
 * faible) le dit (« rubrique « BISCUITS SECS » : à vérifier ») ; « cité par rubrique » aussi (« rubrique « YAOURTS », toute
 * marque · lait non surveillé »). La synthèse l'affiche derrière « Permis · ».
 */
export function mentionSousLigne(s: SousLigneListe): string | null {
  if (s.statut === 'cite' && s.confiance === 'faible' && s.ligne) {
    const averti = `rubrique « ${s.ligne.rubrique} » : à vérifier`;
    return s.mention ? `${s.mention} · ${averti}` : averti;
  }
  if (s.statut !== 'cite_par_rubrique') return s.mention;
  const rubrique = s.ligne ? `rubrique « ${s.ligne.rubrique} », toute marque` : 'toute marque dans la rubrique';
  return s.mention ? `${rubrique} · ${s.mention}` : rubrique;
}

// `calculerSynthese` est réexporté pour que le service n'importe la synthèse qu'une fois (par les règles de la carte).
export { calculerSynthese };

export function ligneCommunautaire(): LigneCarte {
  return {
    niveau: 3,
    statut: 'non_verifie',
    pastille: 'Non vérifié',
    ton: 'warn',
    source: null,
    detail: 'Aucune contribution Les Bons Plans Cachères (lot 5).',
    mention: null,
    publieLe: null,
    valableJusquAu: null,
    composition: null,
    avertissement: null,
  };
}

const JOUR = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Paris' });

export function ligneComposition(p: Produit, analyse: AnalyseComposition | null, luLe: Date): LigneCarte {
  if (!analyse) {
    return {
      niveau: 4,
      statut: 'non_verifie',
      pastille: 'Ingrédients inconnus',
      ton: 'warn',
      source: null,
      detail: p.source === 'off' ? 'La fiche Open Food Facts ne donne pas les ingrédients : saisissez-les ou photographiez l’étiquette.' : 'Les ingrédients ne sont pas saisis.',
      mention: null,
      publieLe: null,
      valableJusquAu: null,
      composition: null,
      avertissement: null,
    };
  }
  const codes = analyse.additifs.map((a) => `${a.code} (${a.nom.toLowerCase()}${a.statut === 'casher' ? '' : ` · ${libelleStatut(a.statut)}`})`);
  const suspects = analyse.ingredientsSuspects.length ? ` Ingrédients à examiner : ${analyse.ingredientsSuspects.join(', ')}.` : '';
  const compte = `${analyse.nombreIngredients} ingrédient${analyse.nombreIngredients > 1 ? 's' : ''}, ${analyse.additifs.length} additif${analyse.additifs.length > 1 ? 's' : ''}`;
  const detail = `Table d’additifs Moutar (ligne sourcée), lue le ${JOUR.format(luLe)} : ${compte}${codes.length ? ` — ${codes.join(', ')}` : ''}.${suspects}`;
  const pastilles = {
    aucun_additif_problematique: { pastille: 'Aucun additif repéré · composition seule', ton: 'neutre' as const, statut: 'non_verifie' as const },
    douteux: { pastille: 'Additif douteux · composition seule', ton: 'warn' as const, statut: 'non_verifie' as const },
    non_casher: { pastille: 'Non cacher · composition', ton: 'danger' as const, statut: 'non_casher' as const },
  }[analyse.statut];
  return {
    niveau: 4,
    ...pastilles,
    source: SOURCE_TABLE,
    detail,
    mention: null,
    publieLe: luLe.toISOString(),
    valableJusquAu: null,
    composition: analyse.statut,
    avertissement: AVERTISSEMENT_COMPOSITION,
  };
}

function libelleStatut(s: string): string {
  return s === 'non_casher' ? 'non cacher' : s === 'douteux' ? 'douteux' : s === 'inconnu' ? 'douteux, absent de la table' : s;
}
