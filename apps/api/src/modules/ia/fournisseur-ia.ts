import type { z } from 'zod';
import type { TypeImage } from '../../common/validation/type-image';

/**
 * Le contrat des deux fournisseurs du moteur d'IA (CLAUDE.md, 20/10/2026) : OVHcloud AI Endpoints (compatible OpenAI, UE)
 * et Claude (SDK officiel `@anthropic-ai/sdk`). Un fournisseur reçoit une image et une consigne, rend un objet validé par
 * le schéma zod donné — jamais une confiance aveugle au modèle. Le moteur (`moteur-ia.ts`) tient le délai, la relance, le
 * journal ; le fournisseur ne fait que l'appel et l'interprétation de la réponse.
 */
export type NomFournisseur = 'ovh' | 'anthropic';

export type UsageIa = 'lecture_logo' | 'ocr_ingredients' | 'transcription';

export interface ImageIa {
  octets: Buffer;
  type: TypeImage;
}

export interface AudioIa {
  octets: Buffer;
  type: string;
  nomFichier: string;
}

/** Ce qu'une transcription rend (lot 4) : le texte, la langue reconnue, une confiance 0-1 quand le moteur en donne une. */
export interface TranscriptionIa {
  texte: string;
  langue: string | null;
  confiance: number | null;
}

/** Une consigne : la partie « système » (rôle et format attendu) et la demande de l'utilisateur, en français. */
export interface Consigne {
  systeme: string;
  utilisateur: string;
}

export interface OptionsAppel {
  /** Le délai du moteur (30 s), posé par `MoteurIa`. */
  signal: AbortSignal;
}

/** Ce qu'un appel rend : la valeur validée, le modèle qui a répondu, les jetons si le fournisseur les donne. */
export interface ReponseIa<T> {
  valeur: T;
  modele: string;
  jetonsEntree: number | null;
  jetonsSortie: number | null;
}

export interface FournisseurIa {
  readonly nom: NomFournisseur;
  /** Lit une image selon la consigne et rend l'objet JSON validé par `schema`. */
  lireImage<T>(image: ImageIa, consigne: Consigne, schema: z.ZodType<T, z.ZodTypeDef, unknown>, options: OptionsAppel): Promise<ReponseIa<T>>;
  /** Transcrit un audio (lot 4 ; OVH seulement — Claude rend `non_supporte`). L'audio n'est jamais conservé. */
  transcrire(audio: AudioIa, options: OptionsAppel): Promise<ReponseIa<TranscriptionIa>>;
}

/**
 * Les codes d'erreur du moteur, lus par l'écran (`{ code, message }`) et écrits au journal (jamais le message du moteur) :
 * - `moteur_non_configure` (503) : aucun fournisseur n'est réglé ;
 * - `moteur_indisponible` (503) : réseau, 5xx, délai — RELANÇABLE une fois ;
 * - `moteur_sature` (429) : le fournisseur limite le débit ;
 * - `reponse_illisible` (502) : pas de JSON, ou un JSON qui ne respecte pas le schéma, ou une réponse tronquée ;
 * - `lecture_refusee` (503) : le modèle a refusé de lire l'image ;
 * - `non_supporte` (501) : l'usage n'existe pas chez ce fournisseur (la transcription chez Claude).
 */
export type CodeErreurIa = 'moteur_non_configure' | 'moteur_indisponible' | 'moteur_sature' | 'reponse_illisible' | 'lecture_refusee' | 'non_supporte';

export const STATUT_ERREUR_IA: Record<CodeErreurIa, number> = {
  moteur_non_configure: 503,
  moteur_indisponible: 503,
  moteur_sature: 429,
  reponse_illisible: 502,
  lecture_refusee: 503,
  non_supporte: 501,
};

export class ErreurIa extends Error {
  constructor(
    readonly code: CodeErreurIa,
    message: string,
    /** Vrai quand une relance a une chance (5xx, réseau, délai) ; faux sur une réponse illisible ou un refus. */
    readonly relancable = false,
  ) {
    super(message);
    this.name = 'ErreurIa';
  }
}
