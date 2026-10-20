import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MESSAGE_INDISPONIBLE, texteDicteUtile, useDictee } from './useDictee';

/** Une reconnaissance simulée : le test déclenche `onresult`, `onerror`, `onend`. */
class ReconnaissanceSimulee {
  static derniere: ReconnaissanceSimulee | null = null;
  lang = '';
  continuous = true;
  interimResults = true;
  maxAlternatives = 3;
  onresult: ((e: { results: Array<Array<{ transcript: string }>> }) => void) | null = null;
  onerror: ((e: { error?: string }) => void) | null = null;
  onend: (() => void) | null = null;
  demarree = false;
  constructor() {
    ReconnaissanceSimulee.derniere = this;
  }
  start() {
    this.demarree = true;
  }
  stop() {
    this.onend?.();
  }
  abort() {
    this.onend?.();
  }
}

describe('useDictee', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    ReconnaissanceSimulee.derniere = null;
  });

  it('sans reconnaissance ni enregistreur (jsdom) → « indisponible », et demarrer ne change rien', () => {
    const surTexte = vi.fn();
    const { result } = renderHook(() => useDictee(surTexte));
    expect(result.current.etat).toEqual({ phase: 'indisponible', message: MESSAGE_INDISPONIBLE });
    act(() => result.current.demarrer());
    expect(result.current.etat.phase).toBe('indisponible');
    expect(surTexte).not.toHaveBeenCalled();
  });

  it('avec la Web Speech API : fr-FR, non continue ; le texte reconnu est rendu, puis « pret »', () => {
    vi.stubGlobal('webkitSpeechRecognition', ReconnaissanceSimulee);
    const surTexte = vi.fn();
    const { result } = renderHook(() => useDictee(surTexte));
    expect(result.current.etat).toEqual({ phase: 'pret', mode: 'navigateur' });
    act(() => result.current.demarrer());
    const r = ReconnaissanceSimulee.derniere!;
    expect(r.demarree).toBe(true);
    expect(r).toMatchObject({ lang: 'fr-FR', continuous: false, interimResults: false, maxAlternatives: 1 });
    expect(result.current.etat).toEqual({ phase: 'ecoute', mode: 'navigateur' });
    act(() => {
      r.onresult?.({ results: [[{ transcript: 'petit beurre' }]] });
      r.onend?.();
    });
    expect(surTexte).toHaveBeenCalledWith('petit beurre');
    expect(result.current.etat).toEqual({ phase: 'pret', mode: 'navigateur' });
  });

  it('un micro refusé → une phrase française, jamais « aucun »', () => {
    vi.stubGlobal('SpeechRecognition', ReconnaissanceSimulee);
    const { result } = renderHook(() => useDictee(() => undefined));
    act(() => result.current.demarrer());
    act(() => {
      ReconnaissanceSimulee.derniere!.onerror?.({ error: 'not-allowed' });
      ReconnaissanceSimulee.derniere!.onend?.();
    });
    expect(result.current.etat.phase).toBe('echec');
    expect((result.current.etat as { message: string }).message).toMatch(/micro est refusé/);
  });

  it('secours serveur : la route sondée répond 404 → « indisponible », sans rien enregistrer', async () => {
    const getUserMedia = vi.fn();
    vi.stubGlobal('MediaRecorder', class {});
    vi.stubGlobal('navigator', { ...navigator, mediaDevices: { getUserMedia } });
    const fetchSimule = vi.fn(async () => ({ ok: false, status: 404, text: async () => JSON.stringify({ code: 'introuvable', message: 'Not Found' }) }));
    vi.stubGlobal('fetch', fetchSimule);
    const { result } = renderHook(() => useDictee(() => undefined));
    expect(result.current.etat).toEqual({ phase: 'pret', mode: 'serveur' });
    await act(async () => {
      result.current.demarrer();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchSimule).toHaveBeenCalledTimes(1);
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(result.current.etat).toEqual({ phase: 'indisponible', message: MESSAGE_INDISPONIBLE });
  });

  /** Le secours serveur simulé : un micro accordé, un enregistreur qui rend un morceau puis s'arrête, une route qui répond `reponse`. */
  function serveurSimule(reponse: { texte: string; confiance: number | null }) {
    const piste = { stop: vi.fn() };
    vi.stubGlobal('navigator', { ...navigator, mediaDevices: { getUserMedia: vi.fn(async () => ({ getTracks: () => [piste] })) } });
    vi.stubGlobal(
      'MediaRecorder',
      class {
        state = 'inactive';
        mimeType = 'audio/webm';
        ondataavailable: ((e: { data: Blob }) => void) | null = null;
        onstop: (() => void) | null = null;
        start() {
          this.state = 'recording';
          setTimeout(() => {
            this.ondataavailable?.({ data: new Blob(['x']) });
            this.stop();
          }, 0);
        }
        stop() {
          if (this.state === 'inactive') return;
          this.state = 'inactive';
          this.onstop?.();
        }
      },
    );
    let appels = 0;
    const fetchSimule = vi.fn(async () => {
      appels++;
      // Le premier appel est la sonde (corps vide) : 400 audio_absent = la route existe.
      if (appels === 1) return { ok: false, status: 400, text: async () => JSON.stringify({ code: 'audio_absent', message: 'x' }) };
      return { ok: true, status: 200, text: async () => JSON.stringify(reponse) };
    });
    vi.stubGlobal('fetch', fetchSimule);
    return { fetchSimule, piste };
  }

  const attendre = () => new Promise((r) => setTimeout(r, 20));

  it('secours serveur : une hallucination de Whisper (« Sous-titrage MFP. ») vaut « rien entendu » ; rien n’est cherché', async () => {
    const { fetchSimule, piste } = serveurSimule({ texte: 'Sous-titrage MFP.', confiance: 0.5 });
    const surTexte = vi.fn();
    const { result } = renderHook(() => useDictee(surTexte));
    await act(async () => {
      result.current.demarrer();
      await attendre();
    });
    expect(fetchSimule).toHaveBeenCalledTimes(2);
    expect(piste.stop).toHaveBeenCalled();
    expect(surTexte).not.toHaveBeenCalled();
    expect(result.current.etat).toEqual({ phase: 'echec', message: expect.stringMatching(/Rien n’a été entendu/) });
  });

  it('secours serveur : une confiance sous 0,5 → « incertain » avec le texte proposé ; confirmer l’envoie, ignorer n’envoie rien', async () => {
    serveurSimule({ texte: 'galettes au beurre', confiance: 0.42 });
    const surTexte = vi.fn();
    const { result } = renderHook(() => useDictee(surTexte));
    await act(async () => {
      result.current.demarrer();
      await attendre();
    });
    expect(surTexte).not.toHaveBeenCalled();
    expect(result.current.etat).toMatchObject({ phase: 'incertain', mode: 'serveur', texte: 'galettes au beurre' });
    expect((result.current.etat as { message: string }).message).toContain('« galettes au beurre »');
    act(() => result.current.ignorer());
    expect(surTexte).not.toHaveBeenCalled();
    expect(result.current.etat).toEqual({ phase: 'pret', mode: 'serveur' });
    await act(async () => {
      result.current.demarrer();
      await attendre();
    });
    act(() => result.current.confirmer());
    expect(surTexte).toHaveBeenCalledWith('galettes au beurre');
    expect(result.current.etat).toEqual({ phase: 'pret', mode: 'serveur' });
  });

  it('secours serveur : une confiance suffisante envoie le texte au champ', async () => {
    serveurSimule({ texte: 'petit beurre', confiance: 0.82 });
    const surTexte = vi.fn();
    const { result } = renderHook(() => useDictee(surTexte));
    await act(async () => {
      result.current.demarrer();
      await attendre();
    });
    expect(surTexte).toHaveBeenCalledWith('petit beurre');
    expect(result.current.etat).toEqual({ phase: 'pret', mode: 'serveur' });
  });

  it('texteDicteUtile (pure) : ponctuation seule et hallucinations connues écartées, un nom de produit gardé', () => {
    for (const t of ['', '   ', '...', '…', '. . .', '!?', 'Sous-titrage MFP.', 'Sous-titrage ST\' 501', 'Merci d’avoir regardé cette vidéo', "Merci d'avoir regardé", 'Merci.', 'Abonnez-vous à la chaîne', '[Musique]']) {
      expect(texteDicteUtile(t), t).toBe(false);
    }
    for (const t of ['petit beurre', 'Galettes Saint-Michel', 'merci chocolat', 'E120', 'sous-vide de saumon']) expect(texteDicteUtile(t), t).toBe(true);
  });
});
