import { Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import type { z } from 'zod';
import { interpreterJson } from './extraction-json';
import { ErreurIa, type AudioIa, type Consigne, type FournisseurIa, type ImageIa, type OptionsAppel, type ReponseIa, type TranscriptionIa } from './fournisseur-ia';

/** Ce que le fournisseur lit du client Anthropic (un client simulé suffit aux tests). */
export type ClientAnthropic = {
  messages: { create(params: Anthropic.MessageCreateParamsNonStreaming, options?: Anthropic.RequestOptions): Promise<Anthropic.Message> };
};

export interface ConfigAnthropic {
  apiKey: string;
  modele: string;
}

/** `max_tokens` de la lecture d'une étiquette (une liste d'ingrédients tient largement). */
export const MAX_TOKENS_ANTHROPIC = 4096;

/** Le client officiel, sans relance propre (c'est le moteur qui relance une fois) ; le délai est celui de l'appel. */
export function creerClientAnthropic(apiKey: string): ClientAnthropic {
  return new Anthropic({ apiKey, maxRetries: 0 });
}

/**
 * Claude par le SDK officiel `@anthropic-ai/sdk` (CLAUDE.md, 20/10/2026) : image en base64 dans le message, consigne
 * système, réponse JSON demandée par la consigne et validée par zod. Ni `thinking` ni `budget_tokens` (le modèle décide),
 * pas de pré-remplissage de l'assistant. Les erreurs typées du SDK deviennent des `ErreurIa` : limite de débit → 429,
 * réseau et 5xx → 503 relançable, refus → `lecture_refusee`.
 */
export class AnthropicFournisseur implements FournisseurIa {
  readonly nom = 'anthropic' as const;
  private readonly logger = new Logger('IaAnthropic');
  private readonly client: ClientAnthropic;

  constructor(
    private readonly cfg: ConfigAnthropic,
    client?: ClientAnthropic,
  ) {
    this.client = client ?? creerClientAnthropic(cfg.apiKey);
  }

  async lireImage<T>(image: ImageIa, consigne: Consigne, schema: z.ZodType<T, z.ZodTypeDef, unknown>, options: OptionsAppel): Promise<ReponseIa<T>> {
    let message: Anthropic.Message;
    try {
      message = await this.client.messages.create(
        {
          model: this.cfg.modele,
          max_tokens: MAX_TOKENS_ANTHROPIC,
          system: consigne.systeme,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: image.type, data: image.octets.toString('base64') } },
                { type: 'text', text: consigne.utilisateur },
              ],
            },
          ],
        },
        { signal: options.signal },
      );
    } catch (e) {
      throw traduireErreur(e, this.logger);
    }
    if (message.stop_reason === 'refusal') throw new ErreurIa('lecture_refusee', 'Le moteur a refusé de lire cette image.');
    if (message.stop_reason === 'max_tokens') throw new ErreurIa('reponse_illisible', 'La réponse du moteur a été coupée au plafond de jetons.');
    const texte = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    if (!texte.trim()) throw new ErreurIa('reponse_illisible', 'Le moteur a rendu une réponse vide.');
    return { valeur: interpreterJson(texte, schema), modele: message.model ?? this.cfg.modele, jetonsEntree: message.usage?.input_tokens ?? null, jetonsSortie: message.usage?.output_tokens ?? null };
  }

  async transcrire(_audio: AudioIa, _options: OptionsAppel): Promise<ReponseIa<TranscriptionIa>> {
    throw new ErreurIa('non_supporte', 'La transcription audio n’existe pas chez ce fournisseur : réglez IA_FOURNISSEUR=ovh pour la dictée.');
  }
}

/** Les erreurs typées du SDK, du plus précis au plus général ; une erreur inconnue vaut « indisponible » (non relançable). */
export function traduireErreur(e: unknown, logger?: Logger): ErreurIa {
  if (e instanceof ErreurIa) return e;
  if (e instanceof Anthropic.RateLimitError) return new ErreurIa('moteur_sature', 'Le moteur limite le débit : réessayez dans un instant.');
  if (e instanceof Anthropic.APIConnectionTimeoutError) return new ErreurIa('moteur_indisponible', 'Le moteur n’a pas répondu dans le délai.', true);
  if (e instanceof Anthropic.APIUserAbortError) return new ErreurIa('moteur_indisponible', 'Le moteur n’a pas répondu dans le délai.', true);
  if (e instanceof Anthropic.APIConnectionError) return new ErreurIa('moteur_indisponible', 'Le moteur est injoignable.', true);
  if (e instanceof Anthropic.APIError) {
    const statut = typeof e.status === 'number' ? e.status : 0;
    if (statut >= 500) return new ErreurIa('moteur_indisponible', `Le moteur a répondu ${statut}.`, true);
    logger?.error(`Anthropic ${statut || '?'} : ${e.name}`);
    return new ErreurIa('moteur_indisponible', `Le moteur a refusé l’appel (${statut || 'erreur'}).`);
  }
  if (e instanceof Error && (e.name === 'AbortError' || e.name === 'TimeoutError')) return new ErreurIa('moteur_indisponible', 'Le moteur n’a pas répondu dans le délai.', true);
  logger?.error(`Anthropic : ${e instanceof Error ? e.name : String(e)}`);
  return new ErreurIa('moteur_indisponible', 'Le moteur est indisponible.');
}
