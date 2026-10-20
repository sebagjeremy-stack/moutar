import { z } from 'zod';
import type { Consigne } from '../ia/fournisseur-ia';
import { confianceBornee } from '../certification/consigne-logo';
import { INGREDIENTS_MAX } from '../produits/produits.controller';

/**
 * La consigne de l'OCR d'une liste d'ingrédients (lot 3) : transcrire FIDÈLEMENT la liste lisible, et seulement elle (ni
 * les valeurs nutritionnelles, ni le marketing), en français si l'étiquette est en français, sans corriger ni compléter.
 * Rien d'autre que l'image et cette consigne ne part au moteur.
 */
export const CONSIGNE_OCR: Consigne = {
  systeme: [
    'Tu es un transcripteur d’étiquettes alimentaires. Tu transcris FIDÈLEMENT la LISTE D’INGRÉDIENTS lisible sur la photo, et SEULEMENT elle :',
    'ni le tableau nutritionnel, ni les textes publicitaires, ni les conseils de conservation. Tu gardes les codes des additifs tels qu’écrits (E 120, E-322, E471),',
    'les pourcentages, les parenthèses et les allergènes en majuscules. Tu ne corriges pas, tu ne complètes pas, tu n’inventes rien : un mot illisible s’écrit « [illisible] ».',
    'Si l’étiquette est en français, tu transcris en français ; sinon, dans sa langue, sans traduire.',
    'Réponds UNIQUEMENT par un objet JSON, sans texte autour, de cette forme exacte :',
    '{"texte":"la liste d’ingrédients transcrite (sans le mot « Ingrédients : » en tête)","langue":"code de langue (fr, en, it, es, he…)","lisible":true,"confiance":0.0}.',
    'Si aucune liste d’ingrédients n’est visible ou lisible, "texte" est vide et "lisible" est false. "confiance" est un nombre entre 0 et 1.',
  ].join(' '),
  utilisateur: 'Transcris la liste d’ingrédients visible sur cette photo, en JSON, selon la consigne.',
};

export interface ReponseOcr {
  texte: string;
  langue: string | null;
  lisible: boolean;
  confiance: number;
}

/** Le texte lu est borné à 10 000 caractères (la même borne que `PUT …/ingredients`, `INGREDIENTS_MAX`). */
export const TEXTE_OCR_MAX = INGREDIENTS_MAX;

/**
 * Ce qu'on accepte du modèle : on TRONQUE, on ne refuse pas — le texte est coupé à 10 000, la langue à 10, la confiance
 * ramenée dans [0, 1] (0 si elle n'est pas un nombre). Seule l'ABSENCE de `texte` (ou un `texte` qui n'est pas une chaîne)
 * reste un refus (502 `reponse_illisible`).
 */
export const schemaReponseOcr: z.ZodType<ReponseOcr, z.ZodTypeDef, unknown> = z.object({
  texte: z.string().transform((s) => s.slice(0, TEXTE_OCR_MAX)),
  langue: z.preprocess((v) => (typeof v === 'string' && v.trim() ? v.trim().toLowerCase().slice(0, 10) : null), z.string().nullable()).default(null),
  lisible: z.preprocess((v) => (typeof v === 'boolean' ? v : typeof v === 'string' ? !/^(false|non|no|0)$/i.test(v.trim()) : true), z.boolean()),
  confiance: confianceBornee,
});
