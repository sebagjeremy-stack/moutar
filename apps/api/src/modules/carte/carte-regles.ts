import type { AnalyseComposition, LigneCarte, Produit } from '@moutar/shared-types';
import { AVERTISSEMENT_COMPOSITION, SOURCE_TABLE } from '../analyse/analyse-composition-regles';

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

export function ligneListeOfficielle(): LigneCarte {
  return {
    niveau: 2,
    statut: 'non_verifie',
    pastille: 'Non vérifié',
    ton: 'warn',
    source: null,
    detail: 'Les listes du Consistoire de Paris et du Rav Wolff ne sont pas encore importées (lot 2).',
    mention: null,
    publieLe: null,
    valableJusquAu: null,
    composition: null,
    avertissement: null,
  };
}

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
