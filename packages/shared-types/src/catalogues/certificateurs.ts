import type { Certificateur, MentionCertification } from '../index';

/**
 * Les certificateurs reconnus en v1 (cadrage § 8.3 : dix organismes, à compléter par le médecin-utilisateur avec ceux
 * qu'il croise en rayon). Lot 3 : la reconnaissance d'un logo sur photo rend des CANDIDATS (texte lu, forme) et c'est le
 * CODE qui fait la correspondance avec ce catalogue (`modules/certification/correspondance-certificateur-regles.ts`) :
 * - `motsCles` : les textes lisibles sur le logo, comparés en MOTS ENTIERS normalisés (« OK » ne se lit pas dans « OKAY ») ;
 *   un mot-clé COURT (deux lettres au plus : « OU », « U », « OK », « K ») n'est retenu que s'il est seul dans le symbole lu
 *   (hors mentions) ET que la forme lue correspond à `formeDuLogo` (le « U » de l'OU demande le cercle) — un mot-clé court
 *   peut donc être partagé (« K » : OK dans un cercle, Star-K dans une étoile, Kof-K dans un kof), la forme tranche ;
 * - `mentionsPossibles` : ce qu'un logo de cet organisme peut porter (parvé, halavi…), rien d'autre ne lui est attribué ;
 * - `formeDuLogo` : description courte, en français, rapprochée de la forme décrite par le modèle (mots-clés de forme :
 *   `MOTS_DE_FORME`).
 * La console peut désactiver un certificateur (`certificateur_surcharge` : actif, note) : il n'est alors plus proposé.
 */
export const MENTIONS_CERTIFICATION: readonly MentionCertification[] = ['parve', 'halavi', 'lait_non_surveille', 'pessah', 'mehadrin'];

export const LIBELLES_MENTIONS_CERTIFICATION: Readonly<Record<MentionCertification, string>> = {
  parve: 'parvé',
  halavi: 'halavi',
  lait_non_surveille: 'lait non surveillé',
  pessah: 'Pessah',
  mehadrin: 'mehadrin',
};

/** Le libellé humain d'une mention de certification (« parvé ») ; un code inconnu rend null. */
export function libelleMentionCertification(mention: string | null | undefined): string | null {
  if (!mention) return null;
  return (LIBELLES_MENTIONS_CERTIFICATION as Record<string, string>)[mention] ?? null;
}

const TOUTES: MentionCertification[] = ['parve', 'halavi', 'lait_non_surveille', 'pessah', 'mehadrin'];
const SANS_PESSAH: MentionCertification[] = ['parve', 'halavi', 'lait_non_surveille', 'mehadrin'];

export const CERTIFICATEURS: readonly Certificateur[] = [
  {
    code: 'beth_din_paris',
    nom: 'Beth Din de Paris (Consistoire)',
    nomCourt: 'Beth Din de Paris',
    pays: 'France',
    motsCles: ['KBDP', 'Beth Din de Paris', 'Beth Din Paris', 'Consistoire de Paris', 'Consistoire', 'Grand Rabbinat de France', 'Rabbinat de Paris'],
    mentionsPossibles: TOUTES,
    formeDuLogo: 'les lettres KBDP, ou le nom « Beth Din de Paris », souvent dans un ovale ou un rectangle',
  },
  {
    code: 'rav_wolff',
    nom: 'Rav Wolff',
    nomCourt: 'Rav Wolff',
    pays: 'France',
    motsCles: ['Rav Wolff', 'Rabbin Wolff', 'Wolff', 'Cacherout Rav Wolff'],
    mentionsPossibles: SANS_PESSAH,
    formeDuLogo: 'le nom « Rav Wolff » en toutes lettres, parfois dans un cartouche',
  },
  {
    code: 'badatz_eda_haredit',
    nom: 'Badatz Eda Haredit',
    nomCourt: 'Badatz',
    pays: 'Israël',
    motsCles: ['Badatz', 'Eda Haredit', 'Edah Hacharedis', 'Eda Hacharedit', 'Badatz Eda Haredit', 'Badatz Yerushalayim'],
    mentionsPossibles: TOUTES,
    formeDuLogo: 'un rectangle ou un cartouche portant « Badatz » et « Eda Haredit », souvent en hébreu (בד"ץ העדה החרדית)',
  },
  {
    code: 'ou',
    nom: 'Orthodox Union (OU)',
    nomCourt: 'OU',
    pays: 'États-Unis',
    motsCles: ['OU', 'U', 'Orthodox Union', 'OU Kosher'],
    mentionsPossibles: TOUTES,
    formeDuLogo: 'la lettre U dans un cercle (le O), parfois suivie de D, P ou « Parve »',
  },
  {
    code: 'ok',
    nom: 'OK Kosher',
    nomCourt: 'OK',
    pays: 'États-Unis',
    motsCles: ['OK', 'K', 'OK Kosher', 'OK Kosher Certification'],
    mentionsPossibles: TOUTES,
    formeDuLogo: 'la lettre K dans un cercle (le O), parfois suivie de D, P ou « Parve »',
  },
  {
    code: 'star_k',
    nom: 'Star-K',
    nomCourt: 'Star-K',
    pays: 'États-Unis',
    motsCles: ['Star-K', 'Star K', 'StarK', 'Star-D', 'K'],
    mentionsPossibles: TOUTES,
    formeDuLogo: 'la lettre K dans une étoile à cinq branches',
  },
  {
    code: 'kof_k',
    nom: 'Kof-K',
    nomCourt: 'Kof-K',
    pays: 'États-Unis',
    motsCles: ['Kof-K', 'Kof K', 'KofK', 'K'],
    mentionsPossibles: TOUTES,
    formeDuLogo: 'la lettre hébraïque kof (ק) contenant un K',
  },
  {
    code: 'klbd',
    nom: 'KLBD (London Beth Din)',
    nomCourt: 'KLBD',
    pays: 'Royaume-Uni',
    motsCles: ['KLBD', 'London Beth Din', 'Kosher London Beth Din'],
    mentionsPossibles: TOUTES,
    formeDuLogo: 'les lettres KLBD, souvent dans un ovale',
  },
  {
    code: 'rabbinat_hollande',
    nom: 'Rabbinat de Hollande',
    nomCourt: 'Rabbinat de Hollande',
    pays: 'Pays-Bas',
    motsCles: ['NIK', 'Rabbinat de Hollande', 'Rabbinat van Holland', 'Opperrabbinaat', 'Nederlands-Israëlitisch Kerkgenootschap', 'Rabbinat Amsterdam'],
    mentionsPossibles: SANS_PESSAH,
    formeDuLogo: 'les lettres NIK (Nederlands-Israëlitisch Kerkgenootschap), parfois dans un cercle ou un rectangle',
  },
  {
    code: 'rabbinat_milan',
    nom: 'Rabbinat de Milan',
    nomCourt: 'Rabbinat de Milan',
    pays: 'Italie',
    motsCles: ['Rabbinato Milano', 'Rabbinato di Milano', 'Rabbinat de Milan', 'Comunità Ebraica di Milano', 'Kosher Milano'],
    mentionsPossibles: ['parve', 'halavi', 'lait_non_surveille'],
    formeDuLogo: 'le nom « Rabbinato di Milano » en toutes lettres, parfois avec une étoile de David',
  },
];

export const CERTIFICATEURS_PAR_CODE: ReadonlyMap<string, Certificateur> = new Map(CERTIFICATEURS.map((c) => [c.code, c]));

/**
 * Les mots de forme que la correspondance rapproche entre la forme lue par le modèle et `formeDuLogo` : un mot-clé court
 * (« U », « K ») ne se retient que si la forme lue partage un de ces mots avec la forme attendue du logo.
 */
export const MOTS_DE_FORME: readonly string[] = ['cercle', 'etoile', 'ovale', 'rectangle', 'cartouche', 'kof', 'hebraique'];
