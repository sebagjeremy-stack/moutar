import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AnthropicFournisseur, MAX_TOKENS_ANTHROPIC, traduireErreur, type ClientAnthropic } from './anthropic-fournisseur';
import { ErreurIa } from './fournisseur-ia';

const schema = z.object({ texte: z.string(), confiance: z.number() });
const image = { octets: Buffer.from('fausse image'), type: 'image/jpeg' as const };
const consigne = { systeme: 'sys', utilisateur: 'lis' };
const cfg = { apiKey: 'sk-test', modele: 'claude-opus-5-5' };
const options = { signal: AbortSignal.timeout(5_000) };

function message(texte: string, stop: Anthropic.Message['stop_reason'] = 'end_turn'): Anthropic.Message {
  return {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-5-5',
    content: [{ type: 'text', text: texte, citations: null }],
    stop_reason: stop,
    stop_sequence: null,
    usage: { input_tokens: 1200, output_tokens: 80, cache_creation_input_tokens: null, cache_read_input_tokens: null, server_tool_use: null, service_tier: null },
  } as unknown as Anthropic.Message;
}

function client(create: ClientAnthropic['messages']['create']): ClientAnthropic {
  return { messages: { create } };
}

async function erreur(p: Promise<unknown>): Promise<ErreurIa> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(ErreurIa);
    return e as ErreurIa;
  }
  throw new Error('aucune erreur');
}

describe('AnthropicFournisseur (SDK simulé)', () => {
  it('appelle messages.create avec l’image en base64, la consigne système, max_tokens 4096, ni thinking ni prefill', async () => {
    const create = vi.fn<ClientAnthropic['messages']['create']>(async () => message('{"texte":"farine","confiance":0.95}'));
    const f = new AnthropicFournisseur(cfg, client(create));
    const r = await f.lireImage(image, consigne, schema, options);
    expect(r).toEqual({ valeur: { texte: 'farine', confiance: 0.95 }, modele: 'claude-opus-5-5', jetonsEntree: 1200, jetonsSortie: 80 });
    const [params, opts] = create.mock.calls[0];
    expect(params.model).toBe('claude-opus-5-5');
    expect(params.max_tokens).toBe(MAX_TOKENS_ANTHROPIC);
    expect(params.system).toBe('sys');
    expect(params).not.toHaveProperty('thinking');
    expect(JSON.stringify(params)).not.toMatch(/budget_tokens/);
    expect(params.messages).toHaveLength(1);
    expect(params.messages[0].role).toBe('user');
    expect(params.messages[0].content).toEqual([
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image.octets.toString('base64') } },
      { type: 'text', text: 'lis' },
    ]);
    expect(opts?.signal).toBe(options.signal);
  });
  it('un texte sans JSON, ou coupé (max_tokens) → reponse_illisible ; un refus → lecture_refusee', async () => {
    expect((await erreur(new AnthropicFournisseur(cfg, client(async () => message('Je ne peux pas lire.'))).lireImage(image, consigne, schema, options))).code).toBe('reponse_illisible');
    expect((await erreur(new AnthropicFournisseur(cfg, client(async () => message('{"texte":"a"', 'max_tokens'))).lireImage(image, consigne, schema, options))).code).toBe('reponse_illisible');
    expect((await erreur(new AnthropicFournisseur(cfg, client(async () => message('', 'refusal'))).lireImage(image, consigne, schema, options))).code).toBe('lecture_refusee');
  });
  it('les erreurs typées du SDK : RateLimitError → moteur_sature (429) ; 5xx et réseau → moteur_indisponible relançable ; 400 → non relançable', async () => {
    const limite = Anthropic.APIError.generate(429, { error: { type: 'rate_limit_error', message: 'x' } }, 'x', new Headers());
    expect(limite).toBeInstanceOf(Anthropic.RateLimitError);
    expect(traduireErreur(limite)).toMatchObject({ code: 'moteur_sature', relancable: false });
    const interne = Anthropic.APIError.generate(529, { error: { type: 'overloaded_error', message: 'x' } }, 'x', new Headers());
    expect(interne).toBeInstanceOf(Anthropic.InternalServerError);
    expect(traduireErreur(interne)).toMatchObject({ code: 'moteur_indisponible', relancable: true });
    expect(traduireErreur(new Anthropic.APIConnectionError({ message: 'coupé' }))).toMatchObject({ code: 'moteur_indisponible', relancable: true });
    expect(traduireErreur(new Anthropic.APIConnectionTimeoutError())).toMatchObject({ code: 'moteur_indisponible', relancable: true });
    const mauvaise = Anthropic.APIError.generate(400, { error: { type: 'invalid_request_error', message: 'x' } }, 'x', new Headers());
    expect(traduireErreur(mauvaise)).toMatchObject({ code: 'moteur_indisponible', relancable: false });
    expect(traduireErreur(new Error('inconnue'))).toMatchObject({ code: 'moteur_indisponible', relancable: false });
    // Par le fournisseur lui-même :
    const f = new AnthropicFournisseur(
      cfg,
      client(async () => {
        throw limite;
      }),
    );
    expect((await erreur(f.lireImage(image, consigne, schema, options))).code).toBe('moteur_sature');
  });
  it('la transcription n’existe pas chez Claude : non_supporte', async () => {
    const f = new AnthropicFournisseur(cfg, client(async () => message('')));
    expect((await erreur(f.transcrire({ octets: Buffer.from('a'), type: 'audio/webm', nomFichier: 'a.webm' }, options))).code).toBe('non_supporte');
  });
});
