import type { PropositionContribution } from '@moutar/shared-types';

/*
 * Lot 5 : la validation LOCALE d'une contribution (pure, testée), avant l'envoi — le serveur reste le juge
 * (`contributions-regles.ts`, 400 `preuve_refusee` / `date_invalide` / `pseudonyme_invalide`) ; l'écran le dit d'abord, en
 * français, sans attendre l'aller-retour. Mêmes bornes que le serveur.
 */

export const SOURCE_TEXTE_MAX = 1000;
export const AUTEUR_NOM_MAX = 40;
export const SIGNALEMENT_TEXTE_MAX = 500;
export const PREUVE_URL_MAX = 2000;
/** Les hôtes de preuve admis par défaut (le serveur lit `CONTRIBUTION_HOTES_PREUVE` ; l'écran dit la règle, le serveur tranche). */
export const HOTES_PREUVE: readonly string[] = ['facebook.com', 'lesbonsplanscachers.fr'];

/** Pure : un jour `AAAA-MM-JJ` qui existe (31 avril, 2026-13-45 refusés). Comparé en texte, jamais par `Date` (qui corrige en silence). */
export function jourReel(jour: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(jour);
  if (!m) return false;
  const [annee, mois, j] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (annee < 1900 || mois < 1 || mois > 12 || j < 1) return false;
  const bissextile = (annee % 4 === 0 && annee % 100 !== 0) || annee % 400 === 0;
  const longueurs = [31, bissextile ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return j <= longueurs[mois - 1];
}

/** Pure : la date de la source est vide, ou un jour réel au plus tard `aujourdhui` (`AAAA-MM-JJ`, le jour du téléphone). */
export function dateAdmise(jour: string, aujourdhui: string): boolean {
  const j = jour.trim();
  return j === '' || (jourReel(j) && j <= aujourdhui);
}

/** Pure : un pseudonyme est vide, ou ≤ 40 caractères sans « @ » (ni un nom, ni un e-mail). */
export function pseudonymeAdmis(nom: string): boolean {
  const n = nom.trim();
  return n === '' || (n.length <= AUTEUR_NOM_MAX && !n.includes('@'));
}

/** Pure : un lien de preuve est vide, ou en https vers un hôte admis ou l'un de ses sous-domaines (`m.facebook.com`). */
export function preuveAdmise(url: string, hotes: readonly string[] = HOTES_PREUVE): boolean {
  const u = url.trim();
  if (u === '') return true;
  if (u.length > PREUVE_URL_MAX) return false;
  let parsee: URL;
  try {
    parsee = new URL(u);
  } catch {
    return false;
  }
  if (parsee.protocol !== 'https:' || parsee.username || parsee.password) return false;
  const hote = parsee.hostname.toLowerCase();
  return hotes.some((h) => hote === h || hote.endsWith(`.${h}`));
}

/** Pure : le texte de la source est non vide et ≤ 1 000 caractères (après repli des espaces de bord). */
export function texteSourceAdmis(texte: string): boolean {
  const t = texte.trim();
  return t.length > 0 && t.length <= SOURCE_TEXTE_MAX;
}

export interface ErreursProposition {
  sourceTexte?: string;
  sourceDate?: string;
  preuveUrl?: string;
  auteurNom?: string;
}

/** Pure : les erreurs de l'étape 3, champ par champ, en français ; `{}` quand tout est admis. */
export function erreursProposition(p: { sourceTexte: string; sourceDate: string; preuveUrl: string; auteurNom: string }, aujourdhui: string, hotes: readonly string[] = HOTES_PREUVE): ErreursProposition {
  const e: ErreursProposition = {};
  if (!p.sourceTexte.trim()) e.sourceTexte = 'Recopiez ce que dit la source (au moins quelques mots).';
  else if (p.sourceTexte.trim().length > SOURCE_TEXTE_MAX) e.sourceTexte = `Le texte de la source dépasse ${SOURCE_TEXTE_MAX.toLocaleString('fr-FR')} caractères : raccourcissez-le.`;
  if (!dateAdmise(p.sourceDate, aujourdhui)) e.sourceDate = 'Le jour de la source doit être un jour du calendrier, au plus tard aujourd’hui.';
  if (!preuveAdmise(p.preuveUrl, hotes)) e.preuveUrl = `Le lien de preuve doit commencer par https:// et pointer vers ${hotes.join(' ou ')}.`;
  if (!pseudonymeAdmis(p.auteurNom)) e.auteurNom = p.auteurNom.includes('@') ? 'Un pseudonyme, pas votre nom ni votre e-mail : retirez le « @ ».' : `Le pseudonyme dépasse ${AUTEUR_NOM_MAX} caractères.`;
  return e;
}

/** Pure : ce qui part au serveur — champs facultatifs vides → null, textes ébarbés. */
export function corpsProposition(p: { statutPropose: PropositionContribution['statutPropose']; sourceType: PropositionContribution['sourceType']; sourceTexte: string; sourceDate: string; preuveUrl: string; auteurNom: string }): PropositionContribution {
  const ouNull = (s: string) => (s.trim() === '' ? null : s.trim());
  return { statutPropose: p.statutPropose, sourceType: p.sourceType, sourceTexte: p.sourceTexte.trim(), sourceDate: ouNull(p.sourceDate), preuveUrl: ouNull(p.preuveUrl), auteurNom: ouNull(p.auteurNom) };
}
