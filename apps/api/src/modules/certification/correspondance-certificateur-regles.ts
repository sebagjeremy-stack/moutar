import type { Certificateur, LectureLogo, MentionCertification, PropositionCertificateur, ResultatLectureLogo } from '@moutar/shared-types';
import { MOTS_DE_FORME } from '@moutar/shared-types/catalogues/certificateurs';
import { contientMotsEntiers, mots, normaliser } from '@moutar/shared-types/regles/normalisation';

/**
 * Règle PURE du niveau 1 (lot 3) : des CANDIDATS lus par le modèle (texte, forme, confiance) aux PROPOSITIONS de
 * certificateurs du catalogue. Rien n'est écrit : l'utilisateur valide d'un clic.
 * - un mot-clé LONG (trois caractères et plus) se cherche en mots entiers normalisés dans le texte lu (« OK » ne se lit
 *   pas dans « OKAY », « Beth Din de Paris » dans « certifié Beth Din de Paris ») ;
 * - un mot-clé COURT (« OU », « U », « OK », « K ») n'est retenu que s'il est SEUL dans le symbole lu, une fois les mots de
 *   mention retirés (« U PARVE » → « u »), ET que la forme lue partage un mot de forme avec celle du logo (« U dans un
 *   cercle » pour l'OU ; « K dans une étoile » pour Star-K, pas pour OK) — « OU » demande donc le cercle, ou « Orthodox Union » ;
 * - un nom d'organisme lu hors symbole (`autresTextes`, « Certifié par le Rav Wolff ») compte aussi, moins fort ;
 * - les mentions (parvé, halavi, lait non surveillé, Pessah, mehadrin) se lisent dans les mentions globales et dans le
 *   symbole lui-même (« OU-D »), et ne sont gardées que si l'organisme peut les porter.
 * Score : confiance du modèle × force du mot-clé (long : 1 ; court avec forme : 0,9 ; nom hors symbole : 0,6).
 */
const POIDS_LONG = 1;
const POIDS_COURT = 0.9;
const POIDS_HORS_SYMBOLE = 0.6;

/** Les mots d'une mention, qui ne font pas partie du sigle lu (« OU D », « K PARVE »). */
const MOTS_DE_MENTION: ReadonlySet<string> = new Set([
  'parve', 'pareve', 'parev', 'parv', 'd', 'dairy', 'halavi', 'chalavi', 'halav', 'chalav', 'lait', 'milk', 'yisrael', 'israel', 'stam', 'p', 'pessah', 'pesach', 'passover', 'mehadrin', 'mehadrine',
  'kosher', 'kasher', 'casher', 'cacher', 'certified', 'certifie', 'certification', 'for', 'pour', 'de', 'meat', 'glatt', 'fish', 'pas', 'non', 'surveille', 'surveille',
]);

const MENTIONS: ReadonlyArray<{ mention: MentionCertification; motifs: RegExp }> = [
  // Les phrases d'abord : « lait non surveillé » contient « lait » (halavi) ; « chalav stam » aussi.
  { mention: 'lait_non_surveille', motifs: /\b(lait non surveille|non surveille|chalav stam|halav stam|stam)\b/ },
  { mention: 'halavi', motifs: /\b(halavi|chalavi|dairy|lait|milk|d|chalav yisrael|halav yisrael|chalav israel|halav israel|lait surveille)\b/ },
  { mention: 'pessah', motifs: /\b(pessah|pesach|passover|p)\b/ },
  { mention: 'parve', motifs: /\b(parve|pareve|parev|parv)\b/ },
  { mention: 'mehadrin', motifs: /\b(mehadrin|mehadrine)\b/ },
];

/** Pure : les mentions de certification lues dans des textes libres (« PARVE », « OU-D », « Chalav Yisrael »). */
export function lireMentions(textes: ReadonlyArray<string>): MentionCertification[] {
  const vues = new Set<MentionCertification>();
  for (const t of textes) {
    const n = normaliser(t);
    if (!n) continue;
    for (const { mention, motifs } of MENTIONS) {
      if (!motifs.test(n)) continue;
      // « lait non surveillé » n'est pas « halavi » ; « lait » seul l'est.
      if (mention === 'halavi' && /\b(non surveille|stam)\b/.test(n)) continue;
      vues.add(mention);
    }
  }
  return [...vues];
}

/** Vrai si la forme lue partage un mot de forme avec la forme attendue du logo (« cercle », « étoile », « kof »…). */
export function formeCorrespond(formeLue: string, formeDuLogo: string): boolean {
  const lue = new Set(mots(formeLue).map(radicalForme));
  const attendue = new Set(mots(formeDuLogo).map(radicalForme));
  return MOTS_DE_FORME.some((m) => lue.has(m) && attendue.has(m));
}

/** Un mot de forme ramené à son mot-clé : « rond », « circle », « circulaire » valent « cercle » ; « star » vaut « étoile »… */
function radicalForme(mot: string): string {
  if (['circle', 'circulaire', 'cercles', 'rond', 'ronde', 'ronds', 'rondes', 'anneau'].includes(mot)) return 'cercle';
  if (['star', 'etoiles', 'etoilee'].includes(mot)) return 'etoile';
  if (['oval', 'ovales'].includes(mot)) return 'ovale';
  if (['rectangulaire', 'rectangles', 'cadre', 'encadre'].includes(mot)) return 'rectangle';
  if (['hebraiques', 'hebrew', 'hebreu', 'hebreux'].includes(mot)) return 'hebraique';
  if (['kouf', 'qof', 'quf', 'kuf'].includes(mot)) return 'kof';
  return mot;
}

interface Meilleure {
  score: number;
  texteLu: string;
  mentions: Set<MentionCertification>;
}

/** Pure : des candidats lus aux propositions, sur le catalogue EFFECTIF (les certificateurs actifs seulement) ; le jeton, c'est le service qui l'émet. */
export function correspondreCertificateurs(lecture: LectureLogo, catalogue: ReadonlyArray<Certificateur>): Omit<ResultatLectureLogo, 'jeton'> {
  const meilleures = new Map<string, Meilleure>();
  const mentionsGlobales = lireMentions(lecture.mentions);
  const reconnus = new Set<number>();

  const retenir = (c: Certificateur, score: number, texteLu: string, mentionsLocales: MentionCertification[]): void => {
    const mentions = new Set([...mentionsGlobales, ...mentionsLocales].filter((m) => c.mentionsPossibles.includes(m)));
    const actuelle = meilleures.get(c.code);
    if (!actuelle || score > actuelle.score) meilleures.set(c.code, { score, texteLu, mentions });
    else for (const m of mentions) actuelle.mentions.add(m);
  };

  lecture.candidats.forEach((candidat, index) => {
    const texte = normaliser(candidat.texteLu);
    if (!texte) return;
    const confiance = Math.min(1, Math.max(0, candidat.confiance));
    const utiles = mots(texte).filter((m) => !MOTS_DE_MENTION.has(m));
    const seul = utiles.join(' ');
    const mentionsLocales = lireMentions([candidat.texteLu]);
    for (const c of catalogue) {
      for (const motCle of c.motsCles) {
        const cle = normaliser(motCle);
        if (!cle) continue;
        if (cle.length <= 2) {
          if (seul === cle && formeCorrespond(candidat.forme, c.formeDuLogo)) {
            retenir(c, confiance * POIDS_COURT, candidat.texteLu, mentionsLocales);
            reconnus.add(index);
          }
        } else if (contientMotsEntiers(texte, cle)) {
          retenir(c, confiance * POIDS_LONG, candidat.texteLu, mentionsLocales);
          reconnus.add(index);
        }
      }
    }
  });

  // Un nom d'organisme écrit en toutes lettres hors symbole (« Certifié par le Rav Wolff ») : moins fort, jamais un sigle court.
  for (const autre of lecture.autresTextes) {
    const texte = normaliser(autre);
    if (!texte) continue;
    for (const c of catalogue) {
      for (const motCle of c.motsCles) {
        const cle = normaliser(motCle);
        if (cle.length >= 4 && contientMotsEntiers(texte, cle)) retenir(c, POIDS_HORS_SYMBOLE, autre, lireMentions([autre]));
      }
    }
  }

  const propositions: PropositionCertificateur[] = [];
  for (const c of catalogue) {
    const m = meilleures.get(c.code);
    if (!m) continue;
    propositions.push({ code: c.code, nom: c.nom, nomCourt: c.nomCourt, confiance: Math.round(m.score * 100) / 100, texteLu: m.texteLu, mentions: [...m.mentions] });
  }
  propositions.sort((a, b) => b.confiance - a.confiance);
  const candidatsNonReconnus = lecture.candidats.filter((c, i) => !reconnus.has(i) && c.texteLu.trim()).map((c) => c.texteLu.trim());
  return { propositions, aucun: propositions.length === 0, candidatsNonReconnus, autresTextes: lecture.autresTextes };
}
