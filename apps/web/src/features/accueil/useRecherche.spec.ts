import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { estCodeBarres, useRecherche } from './useRecherche';

/** Un `fetch` simulé : chaque appel note son adresse et son signal, et se résout quand le test le décide. */
interface Appel {
  url: string;
  signal: AbortSignal;
  repondre: (statut: number, corps: unknown) => void;
}

function fetchSimule() {
  const appels: Appel[] = [];
  const fn = vi.fn((url: string, init?: RequestInit) => {
    const signal = init?.signal as AbortSignal;
    return new Promise<{ ok: boolean; status: number; text: () => Promise<string> }>((resoudre, rejeter) => {
      signal.addEventListener('abort', () => rejeter(new DOMException('annulé', 'AbortError')));
      appels.push({ url, signal, repondre: (status, corps) => resoudre({ ok: status < 400, status, text: async () => JSON.stringify(corps) }) });
    });
  });
  return { fn, appels };
}

const vide = { q: 'bisc', produits: [], lignes: [] };
const plein = { q: 'bisc', produits: [{ id: 'p', ean: '3017760000001', nom: 'Petit Beurre', marque: 'Lu', imageUrl: null }], lignes: [] };

/** Laisse les promesses en attente se régler (sous les minuteurs simulés). */
const laisserPasser = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe('useRecherche', () => {
  let f: ReturnType<typeof fetchSimule>;
  beforeEach(() => {
    vi.useFakeTimers();
    f = fetchSimule();
    vi.stubGlobal('fetch', f.fn);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('n’appelle rien avant 3 caractères', async () => {
    const { result, rerender } = renderHook(({ s }) => useRecherche(s, () => undefined), { initialProps: { s: '' } });
    rerender({ s: 'bi' });
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(f.fn).not.toHaveBeenCalled();
    expect(result.current.etat.phase).toBe('repos');
  });

  it('anti-rebond : trois frappes rapides → un seul appel, avec le dernier texte, après 300 ms', async () => {
    const { rerender } = renderHook(({ s }) => useRecherche(s, () => undefined), { initialProps: { s: '' } });
    rerender({ s: 'bis' });
    await act(async () => { vi.advanceTimersByTime(100); });
    rerender({ s: 'bisc' });
    await act(async () => { vi.advanceTimersByTime(100); });
    rerender({ s: 'biscu' });
    await act(async () => { vi.advanceTimersByTime(299); });
    expect(f.fn).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(f.fn).toHaveBeenCalledTimes(1);
    expect(f.appels[0].url).toBe('/api/v1/recherche?q=biscu');
  });

  it('annule la requête précédente quand une nouvelle part : une seule en vol, la réponse tardive ne dit rien', async () => {
    const { result, rerender } = renderHook(({ s }) => useRecherche(s, () => undefined), { initialProps: { s: 'bis' } });
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(f.appels).toHaveLength(1);
    expect(result.current.etat.phase).toBe('recherche');
    rerender({ s: 'bisc' });
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(f.appels).toHaveLength(2);
    expect(f.appels[0].signal.aborted).toBe(true);
    expect(f.appels[1].signal.aborted).toBe(false);
    // La première, annulée, ne change rien ; la seconde rend ses résultats.
    f.appels[1].repondre(200, plein);
    await laisserPasser();
    expect(result.current.etat.phase).toBe('resultats');
  });

  it('13 chiffres → navigation vers la fiche, sans aucun appel', async () => {
    const naviguer = vi.fn();
    const { result, rerender } = renderHook(({ s }) => useRecherche(s, naviguer), { initialProps: { s: '' } });
    rerender({ s: '3017 7600 0000 1' });
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(naviguer).toHaveBeenCalledWith('3017760000001');
    expect(f.fn).not.toHaveBeenCalled();
    expect(result.current.etat.phase).toBe('repos');
  });

  it('une réponse sans résultat → « vide » (jamais pendant la recherche)', async () => {
    const { result } = renderHook(() => useRecherche('bisc', () => undefined));
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(result.current.etat.phase).toBe('recherche');
    f.appels[0].repondre(200, vide);
    await laisserPasser();
    expect(result.current.etat).toEqual({ phase: 'vide', q: 'bisc' });
  });

  it('429 → « Trop de recherches, patientez une minute » ; autre échec → « Recherche indisponible »', async () => {
    const { result, rerender } = renderHook(({ s }) => useRecherche(s, () => undefined), { initialProps: { s: 'bisc' } });
    await act(async () => { vi.advanceTimersByTime(300); });
    f.appels[0].repondre(429, { code: 'trop_de_demandes', message: 'Trop de recherches : patientez une minute.' });
    await laisserPasser();
    expect(result.current.etat).toEqual({ phase: 'echec', q: 'bisc', message: 'Trop de recherches, patientez une minute.' });
    rerender({ s: 'biscuit' });
    await act(async () => { vi.advanceTimersByTime(300); });
    f.appels[1].repondre(500, { code: 'erreur_interne', message: 'x' });
    await laisserPasser();
    expect(result.current.etat.phase).toBe('echec');
    expect((result.current.etat as { message: string }).message).toBe('Recherche indisponible.');
  });

  it('« Réessayer » relance la même recherche', async () => {
    const { result } = renderHook(() => useRecherche('bisc', () => undefined));
    await act(async () => { vi.advanceTimersByTime(300); });
    f.appels[0].repondre(500, {});
    await laisserPasser();
    act(() => result.current.reessayer());
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(f.appels).toHaveLength(2);
  });

  it('estCodeBarres : 13 chiffres seulement', () => {
    expect(estCodeBarres('3017760000001')).toBe('3017760000001');
    expect(estCodeBarres('301776000000')).toBeNull();
    expect(estCodeBarres('petit beurre')).toBeNull();
  });
});
