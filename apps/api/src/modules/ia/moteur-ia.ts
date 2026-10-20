import { Inject, Injectable, Logger } from '@nestjs/common';
import type { z } from 'zod';
import { ErreurMetier } from '../../common/erreurs/erreur-metier';
import type { Env } from '../../config/env';
import { AnthropicFournisseur } from './anthropic-fournisseur';
import { ErreurIa, STATUT_ERREUR_IA, type AudioIa, type Consigne, type FournisseurIa, type ImageIa, type ReponseIa, type TranscriptionIa, type UsageIa } from './fournisseur-ia';
import { JournalIaService, type JournalIa } from './journal-ia.service';
import { OvhOpenAiFournisseur } from './ovh-openai-fournisseur';

export const FOURNISSEUR_IA = Symbol('FOURNISSEUR_IA');

/** Un appel au moteur dure 30 s au plus ; une tentative, puis UNE relance sur 5xx, réseau ou délai. */
export const DELAI_IA_MS = 30_000;
export const RELANCES = 1;

/**
 * Le fournisseur choisi par `IA_FOURNISSEUR` : `ovh` (défaut) demande `IA_BASE_URL` (sinon : moteur non configuré, les
 * routes répondent 503 `moteur_non_configure`, l'API démarre) ; `anthropic` exige `ANTHROPIC_API_KEY` (vérifié au
 * démarrage par `refusDemarrage`). Pur : lit l'environnement, rend le fournisseur ou null.
 */
export function creerFournisseur(env: Pick<Env, 'IA_FOURNISSEUR' | 'ANTHROPIC_API_KEY' | 'IA_MODELE_ANTHROPIC' | 'IA_BASE_URL' | 'IA_API_KEY' | 'IA_MODELE_VISION' | 'IA_MODELE_AUDIO'>): FournisseurIa | null {
  if (env.IA_FOURNISSEUR === 'anthropic') {
    if (!env.ANTHROPIC_API_KEY) throw new Error('IA_FOURNISSEUR=anthropic exige ANTHROPIC_API_KEY.');
    return new AnthropicFournisseur({ apiKey: env.ANTHROPIC_API_KEY, modele: env.IA_MODELE_ANTHROPIC });
  }
  if (!env.IA_BASE_URL) return null;
  return new OvhOpenAiFournisseur({ baseUrl: env.IA_BASE_URL, apiKey: env.IA_API_KEY ?? null, modeleVision: env.IA_MODELE_VISION, modeleAudio: env.IA_MODELE_AUDIO });
}

/**
 * LE module d'IA (CLAUDE.md : « tout appel passe par un module `ia` unique ») : délai, relance, journal sans contenu,
 * validation zod de la réponse, traduction des erreurs en `{ code, message }`. Aucune identité ni EAN ne part au moteur :
 * l'image et la consigne, rien d'autre. Jamais appelé dans une transaction.
 */
@Injectable()
export class MoteurIa {
  private readonly logger = new Logger('MoteurIa');

  constructor(
    @Inject(FOURNISSEUR_IA) private readonly fournisseur: FournisseurIa | null,
    @Inject(JournalIaService) private readonly journal: JournalIa,
    private readonly delaiMs: number = DELAI_IA_MS,
  ) {}

  /** Vrai quand un fournisseur est réglé. */
  get configure(): boolean {
    return this.fournisseur !== null;
  }

  get nomFournisseur(): string | null {
    return this.fournisseur?.nom ?? null;
  }

  lireImage<T>(image: ImageIa, consigne: Consigne, schema: z.ZodType<T, z.ZodTypeDef, unknown>, usage: UsageIa): Promise<ReponseIa<T>> {
    return this.appeler(usage, (f, signal) => f.lireImage(image, consigne, schema, { signal }));
  }

  transcrire(audio: AudioIa): Promise<ReponseIa<TranscriptionIa>> {
    return this.appeler('transcription', (f, signal) => f.transcrire(audio, { signal }));
  }

  private async appeler<T>(usage: UsageIa, appel: (f: FournisseurIa, signal: AbortSignal) => Promise<ReponseIa<T>>): Promise<ReponseIa<T>> {
    const f = this.fournisseur;
    if (!f) throw new ErreurMetier(503, 'moteur_non_configure', 'Le moteur d’IA n’est pas réglé (IA_BASE_URL ou ANTHROPIC_API_KEY) : la lecture des photos est indisponible.');
    let derniere: ErreurIa | null = null;
    for (let tentative = 0; tentative <= RELANCES; tentative++) {
      const t0 = Date.now();
      try {
        const r = await appel(f, AbortSignal.timeout(this.delaiMs));
        await this.journal.enregistrer({ fournisseur: f.nom, modele: r.modele, usage, dureeMs: Date.now() - t0, jetonsEntree: r.jetonsEntree, jetonsSortie: r.jetonsSortie, ok: true, erreur: null });
        return r;
      } catch (e) {
        derniere = e instanceof ErreurIa ? e : new ErreurIa('moteur_indisponible', 'Le moteur est indisponible.');
        this.logger.warn(`${f.nom} · ${usage} : ${derniere.code} (${derniere.message})${derniere.relancable && tentative < RELANCES ? ' — relance' : ''}`);
        await this.journal.enregistrer({ fournisseur: f.nom, modele: f.modeleParDefaut, usage, dureeMs: Date.now() - t0, jetonsEntree: null, jetonsSortie: null, ok: false, erreur: derniere.code });
        if (!derniere.relancable) break;
      }
    }
    const err = derniere!;
    throw new ErreurMetier(STATUT_ERREUR_IA[err.code], err.code, err.message);
  }
}
