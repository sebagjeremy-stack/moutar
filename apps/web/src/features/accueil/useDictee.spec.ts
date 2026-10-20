import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MESSAGE_INDISPONIBLE, useDictee } from './useDictee';

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
});
