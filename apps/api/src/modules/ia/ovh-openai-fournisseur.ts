import { Logger } from '@nestjs/common';
import type { z } from 'zod';
import { interpreterJson } from './extraction-json';
import { ErreurIa, type AudioIa, type Consigne, type FournisseurIa, type ImageIa, type OptionsAppel, type ReponseIa, type TranscriptionIa } from './fournisseur-ia';

export interface ConfigOvh {
  /** L'adresse `/v1` d'OVHcloud AI Endpoints (hôte vérifié au démarrage contre `IA_HOTES_AUTORISES`). */
  baseUrl: string;
  /** Le jeton OVH, ou null quand un mandataire authentifie (conteneur de développement). */
  apiKey: string | null;
  modeleVision: string;
  modeleAudio: string;
}

export type FetchIa = typeof fetch;

/** `max_tokens` de la lecture d'une étiquette : une longue liste d'ingrédients en JSON tient (aligné sur Claude, 4096). */
export const MAX_TOKENS_OVH = 4096;

/** Le corps d'une réponse `audio/transcriptions` en `verbose_json` (ce qu'on en lit). */
interface ReponseTranscription {
  text?: string;
  language?: string;
  segments?: Array<{ avg_logprob?: number }>;
}

/** Le corps d'une réponse `chat/completions` (ce qu'on en lit). */
interface ReponseChat {
  choices?: Array<{ message?: { content?: string | null }; finish_reason?: string | null }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  model?: string;
}

/**
 * OVHcloud AI Endpoints, compatible OpenAI (UE) : `chat/completions` avec l'image en `image_url` (data: base64) et
 * `response_format: { type: 'json_object' }` quand le modèle l'accepte (Qwen2.5-VL l'accepte, vérifié le 20/10/2026) —
 * sinon la demande repart sans, et c'est l'extraction du premier bloc JSON qui lit la réponse. `fetch` est injectable
 * (tests avec un HTTP simulé). Température 0 : on lit une étiquette, on n'invente pas.
 */
export class OvhOpenAiFournisseur implements FournisseurIa {
  readonly nom = 'ovh' as const;
  readonly modeleParDefaut: string;
  private readonly logger = new Logger('IaOvh');
  private readonly baseUrl: string;

  constructor(
    private readonly cfg: ConfigOvh,
    private readonly fetchImpl: FetchIa = fetch,
  ) {
    this.baseUrl = cfg.baseUrl.replace(/\/+$/, '');
    this.modeleParDefaut = cfg.modeleVision;
  }

  async lireImage<T>(image: ImageIa, consigne: Consigne, schema: z.ZodType<T, z.ZodTypeDef, unknown>, options: OptionsAppel): Promise<ReponseIa<T>> {
    const corps = {
      model: this.cfg.modeleVision,
      temperature: 0,
      max_tokens: MAX_TOKENS_OVH,
      messages: [
        { role: 'system', content: consigne.systeme },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${image.type};base64,${image.octets.toString('base64')}` } },
            { type: 'text', text: consigne.utilisateur },
          ],
        },
      ],
    };
    let res = await this.poster('/chat/completions', { ...corps, response_format: { type: 'json_object' } }, options.signal, true);
    if (res.status === 400) {
      if (!/response_format|json_object/i.test(await res.clone().text())) throw this.refus(res.status, '/chat/completions');
      // Le modèle n'accepte pas le format JSON imposé : on repart sans, l'extraction fera le tri.
      this.logger.warn(`${this.cfg.modeleVision} refuse response_format : nouvel essai sans.`);
      res = await this.poster('/chat/completions', corps, options.signal);
    }
    const data = await lireCorps<ReponseChat>(res);
    const choix = data.choices?.[0];
    const contenu = choix?.message?.content;
    if (typeof contenu !== 'string' || !contenu.trim()) throw new ErreurIa('reponse_illisible', 'Le moteur a rendu une réponse vide.');
    if (choix?.finish_reason === 'length') throw new ErreurIa('reponse_illisible', 'La réponse du moteur a été coupée au plafond de jetons.');
    return { valeur: interpreterJson(contenu, schema), modele: data.model ?? this.cfg.modeleVision, jetonsEntree: data.usage?.prompt_tokens ?? null, jetonsSortie: data.usage?.completion_tokens ?? null };
  }

  /**
   * Transcription (`audio/transcriptions`, Whisper, lot 4) : multipart, langue forcée au français (la dictée de Moutar
   * est en français ; à valider), `response_format: verbose_json` pour lire la langue reconnue et les segments — la
   * confiance est exp(moyenne des `avg_logprob`), bornée 0-1, null sans segment. L'audio n'est pas conservé ; rien
   * d'autre ne part (ni identité, ni EAN).
   */
  async transcrire(audio: AudioIa, options: OptionsAppel): Promise<ReponseIa<TranscriptionIa>> {
    const form = new FormData();
    form.append('model', this.cfg.modeleAudio);
    form.append('language', 'fr');
    form.append('response_format', 'verbose_json');
    form.append('file', new Blob([new Uint8Array(audio.octets)], { type: audio.type }), audio.nomFichier);
    const res = await this.appeler(`${this.baseUrl}/audio/transcriptions`, { method: 'POST', headers: this.entetes(false), body: form, signal: options.signal });
    const data = await lireCorps<ReponseTranscription>(res);
    if (typeof data.text !== 'string') throw new ErreurIa('reponse_illisible', 'Le moteur n’a pas rendu de texte.');
    return { valeur: { texte: data.text.trim(), langue: typeof data.language === 'string' && data.language ? data.language : null, confiance: confianceDesSegments(data.segments) }, modele: this.cfg.modeleAudio, jetonsEntree: null, jetonsSortie: null };
  }

  private poster(chemin: string, corps: unknown, signal: AbortSignal, tolerer400 = false): Promise<Response> {
    return this.appeler(`${this.baseUrl}${chemin}`, { method: 'POST', headers: this.entetes(true), body: JSON.stringify(corps), signal }, tolerer400);
  }

  /** Un 4xx est une erreur de notre appel (modèle inconnu, jeton) : le journal du serveur la garde, l'écran ne voit qu'un 503. */
  private refus(statut: number, chemin: string): ErreurIa {
    this.logger.error(`OVH ${statut} sur ${chemin}`);
    return new ErreurIa('moteur_indisponible', `Le moteur a refusé l’appel (${statut}).`);
  }

  /** Un appel HTTP : le réseau et le délai valent `moteur_indisponible` (relançable) ; un 5xx aussi ; un 429 `moteur_sature`. */
  private async appeler(url: string, init: RequestInit, tolerer400 = false): Promise<Response> {
    let res: Response;
    try {
      res = await this.fetchImpl(url, init);
    } catch (e) {
      const delai = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
      throw new ErreurIa('moteur_indisponible', delai ? 'Le moteur n’a pas répondu dans le délai.' : 'Le moteur est injoignable.', true);
    }
    if (res.status === 429) throw new ErreurIa('moteur_sature', 'Le moteur limite le débit : réessayez dans un instant.');
    if (res.status >= 500) throw new ErreurIa('moteur_indisponible', `Le moteur a répondu ${res.status}.`, true);
    if (!res.ok && !(tolerer400 && res.status === 400)) throw this.refus(res.status, url.replace(this.baseUrl, ''));
    return res;
  }

  private entetes(json: boolean): Record<string, string> {
    const h: Record<string, string> = json ? { 'Content-Type': 'application/json' } : {};
    if (this.cfg.apiKey) h['Authorization'] = `Bearer ${this.cfg.apiKey}`;
    return h;
  }
}

/** Pure : exp(moyenne des log-probabilités moyennes des segments), bornée 0-1 ; null sans segment chiffré. */
export function confianceDesSegments(segments: ReponseTranscription['segments']): number | null {
  const valeurs = (segments ?? []).map((s) => s.avg_logprob).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (valeurs.length === 0) return null;
  const moyenne = valeurs.reduce((a, b) => a + b, 0) / valeurs.length;
  return Math.round(Math.min(1, Math.max(0, Math.exp(moyenne))) * 100) / 100;
}

async function lireCorps<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    throw new ErreurIa('reponse_illisible', 'Le moteur a rendu une réponse qui n’est pas du JSON.');
  }
}
