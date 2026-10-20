import { describe, expect, it, vi } from 'vitest';
import { ErreurMetier } from '../../common/erreurs/erreur-metier';
import { AnthropicFournisseur } from '../ia/anthropic-fournisseur';
import type { AudioIa } from '../ia/fournisseur-ia';
import type { EntreeJournalIa, JournalIa } from '../ia/journal-ia.service';
import { MoteurIa } from '../ia/moteur-ia';
import { OvhOpenAiFournisseur, type FetchIa } from '../ia/ovh-openai-fournisseur';
import { TranscriptionService } from './transcription.service';

class JournalMemoire implements JournalIa {
  lignes: EntreeJournalIa[] = [];
  async enregistrer(e: EntreeJournalIa): Promise<void> {
    this.lignes.push(e);
  }
}

const cfg = { baseUrl: 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1', apiKey: null, modeleVision: 'Qwen2.5-VL-72B-Instruct', modeleAudio: 'whisper-large-v3-turbo' };
const audio: AudioIa = { octets: Buffer.from('un faux webm'), type: 'audio/webm', nomFichier: 'dictee.webm' };
const reponse = (statut: number, corps: unknown): Response => new Response(JSON.stringify(corps), { status: statut, headers: { 'content-type': 'application/json' } });

async function erreurMetier(p: Promise<unknown>): Promise<{ statut: number; code: unknown }> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(ErreurMetier);
    const err = e as ErreurMetier;
    return { statut: err.getStatus(), code: (err.getResponse() as { code: unknown }).code };
  }
  throw new Error('aucune erreur');
}

describe('TranscriptionService (lot 4, HTTP simulé)', () => {
  it('OVH : le texte, la langue et la confiance ; UNE ligne « transcription » au journal, sans contenu', async () => {
    const fetchImpl = vi.fn<FetchIa>(async () => reponse(200, { text: ' Biscuits cachères Saint-Michel ', language: 'fr', segments: [{ avg_logprob: -0.2 }] }));
    const journal = new JournalMemoire();
    const service = new TranscriptionService(new MoteurIa(new OvhOpenAiFournisseur(cfg, fetchImpl), journal));
    expect(await service.transcrire(audio)).toEqual({ texte: 'Biscuits cachères Saint-Michel', langue: 'fr', confiance: 0.82 });
    expect(journal.lignes).toHaveLength(1);
    expect(journal.lignes[0]).toMatchObject({ fournisseur: 'ovh', modele: 'whisper-large-v3-turbo', usage: 'transcription', ok: true, erreur: null, jetonsEntree: null, jetonsSortie: null });
    expect(JSON.stringify(journal.lignes[0])).not.toMatch(/Biscuits|webm/);
    // Ce qui part : l'audio sous NOTRE nom de fichier, le modèle, la langue, le format ; rien d'autre.
    const form = fetchImpl.mock.calls[0][1]?.body as FormData;
    expect([...form.keys()].sort()).toEqual(['file', 'language', 'model', 'response_format']);
    expect((form.get('file') as File).name).toBe('dictee.webm');
  });
  it('OVH en 5xx : relancé une fois puis 503 moteur_indisponible, deux lignes d’échec « transcription »', async () => {
    const journal = new JournalMemoire();
    const service = new TranscriptionService(new MoteurIa(new OvhOpenAiFournisseur(cfg, async () => reponse(502, { error: 'x' })), journal));
    expect(await erreurMetier(service.transcrire(audio))).toEqual({ statut: 503, code: 'moteur_indisponible' });
    expect(journal.lignes.map((l) => [l.usage, l.ok, l.erreur])).toEqual([
      ['transcription', false, 'moteur_indisponible'],
      ['transcription', false, 'moteur_indisponible'],
    ]);
  });
  it('Claude (Anthropic) : 501 non_supporte, une ligne d’échec au journal, aucun appel réseau', async () => {
    const journal = new JournalMemoire();
    const service = new TranscriptionService(new MoteurIa(new AnthropicFournisseur({ apiKey: 'sk-test', modele: 'claude-opus-5-5' }), journal));
    expect(await erreurMetier(service.transcrire(audio))).toEqual({ statut: 501, code: 'non_supporte' });
    expect(journal.lignes).toEqual([expect.objectContaining({ fournisseur: 'anthropic', usage: 'transcription', ok: false, erreur: 'non_supporte' })]);
  });
  it('sans moteur réglé : 503 moteur_non_configure', async () => {
    const service = new TranscriptionService(new MoteurIa(null, new JournalMemoire()));
    expect(await erreurMetier(service.transcrire(audio))).toEqual({ statut: 503, code: 'moteur_non_configure' });
  });
});
