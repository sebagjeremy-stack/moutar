import { z } from 'zod';
import type { LectureLogo } from '@moutar/shared-types';
import type { Consigne } from '../ia/fournisseur-ia';

/**
 * La consigne de lecture d'un logo de certification (lot 3), en français, STRICTE : décrire les symboles visibles, ne
 * jamais deviner un symbole absent, ne jamais nommer l'organisme à la place du code — le modèle rend des CANDIDATS (texte
 * lu, forme, confiance), et c'est `correspondance-certificateur-regles.ts` qui les rapproche du catalogue. Rien d'autre
 * que l'image et cette consigne ne part au moteur : ni EAN, ni nom de produit, ni identité.
 */
export const CONSIGNE_LOGO: Consigne = {
  systeme: [
    'Tu es un lecteur d’étiquettes alimentaires. Tu décris les SYMBOLES DE CERTIFICATION CACHER (hechsher) visibles sur la photo d’un emballage :',
    'une lettre ou des lettres dans un cercle, un K dans une étoile, un K dans une lettre hébraïque, un sigle (KBDP, KLBD, NIK…), le nom d’un organisme',
    '(Beth Din, Badatz, Rabbinat, Orthodox Union, Rav Wolff, Star-K, Kof-K…), un texte en hébreu dans un cartouche.',
    'Règles strictes : tu ne devines JAMAIS un symbole absent ; tu transcris les lettres EXACTEMENT comme elles sont écrites (« U », pas « OU », si seul un U est lisible) ;',
    'tu ne nommes pas l’organisme à la place des lettres ; tu ne juges pas si le produit est cacher.',
    'Réponds UNIQUEMENT par un objet JSON, sans texte autour, de cette forme exacte :',
    '{"candidats":[{"texteLu":"les lettres ou mots lus DANS le symbole, tels quels","forme":"description courte de la forme (ex. lettre U dans un cercle ; K dans une étoile ; rectangle avec texte hébreu)","confiance":0.0}],',
    '"mentions":["les mentions lues PRÈS des symboles, telles quelles (par ex. Parve, D, Dairy, P, Pessah, Mehadrin, Halavi, Chalav Yisrael)"],',
    '"autresTextes":["les autres textes visibles sur l’emballage, un par entrée"]}.',
    'Si aucun symbole de certification n’est visible, "candidats" est une liste vide. "confiance" est un nombre entre 0 et 1.',
  ].join(' '),
  utilisateur: 'Décris les symboles de certification cacher visibles sur cette photo, en JSON, selon la consigne.',
};

/**
 * Ce qu'on accepte du modèle : on TRONQUE, on ne refuse pas (relecture des lots 3-5) — un texte trop long est coupé, un
 * tableau trop long est coupé, une confiance hors [0, 1] est ramenée dans l'intervalle (0 si elle n'est pas un nombre), une
 * entrée qui n'est pas une chaîne est écartée. Seule l'ABSENCE de `candidats` reste un refus (502 `reponse_illisible`) : le
 * code fait ensuite la correspondance, jamais une confiance aveugle au modèle.
 */
const texte = (max: number) => z.string().transform((s) => s.trim().slice(0, max));
const texteFacultatif = (max: number) => z.preprocess((v) => (typeof v === 'string' ? v : ''), texte(max));
const chaines = (max: number, n: number) =>
  z.preprocess((v) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, n) : []), z.array(texte(max)));
/** Une confiance 0-1 : bornée (`clamp`), 0 si le modèle n'a pas rendu un nombre. */
export const confianceBornee = z.preprocess((v) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}, z.number());

export const schemaLectureLogo: z.ZodType<LectureLogo, z.ZodTypeDef, unknown> = z.object({
  candidats: z.preprocess(
    (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'object' && x !== null).slice(0, 20) : v),
    z.array(z.object({ texteLu: texteFacultatif(200), forme: texteFacultatif(300), confiance: confianceBornee })),
  ),
  mentions: chaines(100, 20),
  autresTextes: chaines(300, 40),
});
