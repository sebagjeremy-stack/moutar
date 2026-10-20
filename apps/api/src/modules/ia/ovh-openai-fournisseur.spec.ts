import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ErreurIa } from './fournisseur-ia';
import { OvhOpenAiFournisseur, confianceDesSegments, type FetchIa } from './ovh-openai-fournisseur';

const schema = z.object({ texte: z.string(), confiance: z.number() });
const image = { octets: Buffer.from('fausse image'), type: 'image/png' as const };
const consigne = { systeme: 'sys', utilisateur: 'lis' };
const cfg = { baseUrl: 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/', apiKey: 'jeton-test', modeleVision: 'Qwen2.5-VL-72B-Instruct', modeleAudio: 'whisper' };

const reponse = (statut: number, corps: unknown): Response => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status: statut, headers: { 'content-type': 'application/json' } });
const chat = (contenu: string, finish = 'stop') => ({ model: 'Qwen2.5-VL-72B-Instruct', choices: [{ message: { content: contenu }, finish_reason: finish }], usage: { prompt_tokens: 515, completion_tokens: 42 } });
const options = { signal: AbortSignal.timeout(5_000) };

async function erreur(p: Promise<unknown>): Promise<ErreurIa> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(ErreurIa);
    return e as ErreurIa;
  }
  throw new Error('aucune erreur');
}

describe('OvhOpenAiFournisseur (HTTP simulé)', () => {
  it('envoie l’image en data:base64, la consigne, response_format json_object, le jeton ; lit le JSON et les jetons', async () => {
    const fetchImpl = vi.fn<FetchIa>(async () => reponse(200, chat('{"texte":"farine","confiance":0.9}')));
    const f = new OvhOpenAiFournisseur(cfg, fetchImpl);
    const r = await f.lireImage(image, consigne, schema, options);
    expect(r).toEqual({ valeur: { texte: 'farine', confiance: 0.9 }, modele: 'Qwen2.5-VL-72B-Instruct', jetonsEntree: 515, jetonsSortie: 42 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions');
    const corps = JSON.parse(String(init?.body));
    expect(corps.response_format).toEqual({ type: 'json_object' });
    expect(corps.temperature).toBe(0);
    expect(corps.messages[0]).toEqual({ role: 'system', content: 'sys' });
    expect(corps.messages[1].content[0].image_url.url).toBe(`data:image/png;base64,${image.octets.toString('base64')}`);
    expect((init?.headers as Record<string, string>)['Authorization']).toBe('Bearer jeton-test');
    // Aucune identité, aucun EAN : seuls l'image et la consigne partent.
    expect(JSON.stringify(corps)).not.toMatch(/ean|patient|nom/i);
  });
  it('sans jeton (mandataire), aucun en-tête Authorization', async () => {
    const fetchImpl = vi.fn<FetchIa>(async () => reponse(200, chat('{"texte":"x","confiance":1}')));
    await new OvhOpenAiFournisseur({ ...cfg, apiKey: null }, fetchImpl).lireImage(image, consigne, schema, options);
    expect((fetchImpl.mock.calls[0][1]?.headers as Record<string, string>)['Authorization']).toBeUndefined();
  });
  it('un JSON invalide ou hors schéma → reponse_illisible, non relançable', async () => {
    const f = new OvhOpenAiFournisseur(cfg, async () => reponse(200, chat('Je vois un logo mais pas de JSON.')));
    const e = await erreur(f.lireImage(image, consigne, schema, options));
    expect(e.code).toBe('reponse_illisible');
    expect(e.relancable).toBe(false);
    const g = new OvhOpenAiFournisseur(cfg, async () => reponse(200, chat('{"texte": 12}')));
    expect((await erreur(g.lireImage(image, consigne, schema, options))).code).toBe('reponse_illisible');
  });
  it('un contenu vide ou coupé au plafond → reponse_illisible', async () => {
    expect((await erreur(new OvhOpenAiFournisseur(cfg, async () => reponse(200, chat(''))).lireImage(image, consigne, schema, options))).code).toBe('reponse_illisible');
    expect((await erreur(new OvhOpenAiFournisseur(cfg, async () => reponse(200, chat('{"texte":"a"', 'length'))).lireImage(image, consigne, schema, options))).code).toBe('reponse_illisible');
  });
  it('un 5xx → moteur_indisponible RELANÇABLE ; un 429 → moteur_sature ; un 401 → moteur_indisponible non relançable', async () => {
    const e500 = await erreur(new OvhOpenAiFournisseur(cfg, async () => reponse(502, 'Bad gateway')).lireImage(image, consigne, schema, options));
    expect(e500).toMatchObject({ code: 'moteur_indisponible', relancable: true });
    const e429 = await erreur(new OvhOpenAiFournisseur(cfg, async () => reponse(429, { error: 'rate' })).lireImage(image, consigne, schema, options));
    expect(e429).toMatchObject({ code: 'moteur_sature', relancable: false });
    const e401 = await erreur(new OvhOpenAiFournisseur(cfg, async () => reponse(401, { error: 'jeton' })).lireImage(image, consigne, schema, options));
    expect(e401).toMatchObject({ code: 'moteur_indisponible', relancable: false });
  });
  it('le réseau coupé ou le délai (AbortError) → moteur_indisponible relançable', async () => {
    const coupe = new OvhOpenAiFournisseur(cfg, async () => {
      throw new TypeError('fetch failed');
    });
    expect(await erreur(coupe.lireImage(image, consigne, schema, options))).toMatchObject({ code: 'moteur_indisponible', relancable: true });
    const delai = new OvhOpenAiFournisseur(cfg, async () => {
      throw Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
    });
    const e = await erreur(delai.lireImage(image, consigne, schema, options));
    expect(e.relancable).toBe(true);
    expect(e.message).toMatch(/délai/);
  });
  it('si le modèle refuse response_format (400), la demande repart sans et l’extraction lit le premier bloc JSON', async () => {
    const fetchImpl = vi.fn<FetchIa>(async (_url, init) => {
      const corps = JSON.parse(String(init?.body));
      if (corps.response_format) return reponse(400, { error: { message: 'response_format is not supported' } });
      return reponse(200, chat('Voici :\n```json\n{"texte":"sucre","confiance":0.7}\n```'));
    });
    const r = await new OvhOpenAiFournisseur(cfg, fetchImpl).lireImage(image, consigne, schema, options);
    expect(r.valeur).toEqual({ texte: 'sucre', confiance: 0.7 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchImpl.mock.calls[1][1]?.body)).response_format).toBeUndefined();
  });
  it('transcrire envoie un multipart (verbose_json, langue fr) à audio/transcriptions et rend texte, langue, confiance', async () => {
    const fetchImpl = vi.fn<FetchIa>(async () => reponse(200, { text: ' bonjour ', language: 'fr', segments: [{ avg_logprob: -0.1 }, { avg_logprob: -0.3 }] }));
    const r = await new OvhOpenAiFournisseur(cfg, fetchImpl).transcrire({ octets: Buffer.from('audio'), type: 'audio/webm', nomFichier: 'd.webm' }, options);
    expect(r).toEqual({ valeur: { texte: 'bonjour', langue: 'fr', confiance: 0.82 }, modele: 'whisper', jetonsEntree: null, jetonsSortie: null });
    expect(fetchImpl.mock.calls[0][0]).toBe('https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/audio/transcriptions');
    const form = fetchImpl.mock.calls[0][1]?.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(form.get('response_format')).toBe('verbose_json');
    expect(form.get('language')).toBe('fr');
    expect((form.get('file') as File).name).toBe('d.webm');
  });
  it('transcrire : sans segments la confiance est null ; sans texte → reponse_illisible', async () => {
    const r = await new OvhOpenAiFournisseur(cfg, async () => reponse(200, { text: 'x' })).transcrire({ octets: Buffer.from('a'), type: 'audio/wav', nomFichier: 'd.wav' }, options);
    expect(r.valeur).toEqual({ texte: 'x', langue: null, confiance: null });
    expect(confianceDesSegments([{ avg_logprob: 0 }])).toBe(1);
    expect(confianceDesSegments([])).toBeNull();
    const e = await erreur(new OvhOpenAiFournisseur(cfg, async () => reponse(200, { language: 'fr' })).transcrire({ octets: Buffer.from('a'), type: 'audio/wav', nomFichier: 'd.wav' }, options));
    expect(e.code).toBe('reponse_illisible');
  });
});
