import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EtatDictee } from './useDictee';

/**
 * L'état `incertain` de la dictée à l'accueil (relecture du lot 4) : `useDictee` est SIMULÉ dans cet état — la carte ambre
 * propose le texte, « Oui, chercher » appelle `confirmer` (qui rend le texte au champ, lequel cherche), « Non » appelle
 * `ignorer`. Rien n'est cherché avant le clic.
 */
const crochet = vi.hoisted(() => ({
  etat: { phase: 'incertain', mode: 'serveur', texte: 'biscuits', message: 'Vous avez dit « biscuits » ? Confirmez, ou tapez le nom.' } as EtatDictee,
  surTexte: null as ((t: string) => void) | null,
  demarrer: vi.fn(),
  arreter: vi.fn(),
  confirmer: vi.fn(),
  ignorer: vi.fn(),
}));
vi.mock('./useDictee', async (importer) => {
  const reel = await importer<typeof import('./useDictee')>();
  return {
    ...reel,
    useDictee: (surTexte: (t: string) => void) => {
      crochet.surTexte = surTexte;
      return { etat: crochet.etat, demarrer: crochet.demarrer, arreter: crochet.arreter, confirmer: crochet.confirmer, ignorer: crochet.ignorer };
    },
  };
});

import { AccueilPage } from './AccueilPage';

describe('AccueilPage — dictée incertaine', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('propose le texte entendu dans une carte ambre, sans rien chercher ; « Non » écarte', () => {
    const fetchSimule = vi.fn();
    vi.stubGlobal('fetch', fetchSimule);
    render(
      <MemoryRouter>
        <AccueilPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'J’ai entendu : « biscuits » — c’est bien ça ?' })).toBeTruthy();
    expect(screen.getByText('À confirmer').className).toContain('pastille-warn');
    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('');
    expect(fetchSimule).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Non' }));
    expect(crochet.ignorer).toHaveBeenCalledTimes(1);
    expect(crochet.confirmer).not.toHaveBeenCalled();
    expect(fetchSimule).not.toHaveBeenCalled();
  });

  it('« Oui, chercher » confirme : le texte va au champ, qui lance la recherche', async () => {
    const fetchSimule = vi.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ q: 'biscuits', produits: [], lignes: [] }) }));
    vi.stubGlobal('fetch', fetchSimule);
    // Le crochet réel, confirmé, rend le texte par `surTexte` : on fait pareil.
    crochet.confirmer.mockImplementation(() => crochet.surTexte?.('biscuits'));
    render(
      <MemoryRouter>
        <AccueilPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Oui, chercher' }));
    expect(crochet.confirmer).toHaveBeenCalledTimes(1);
    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('biscuits');
    await waitFor(() => expect(fetchSimule).toHaveBeenCalled(), { timeout: 2000 });
    const url = String((fetchSimule.mock.calls[0] as unknown[])[0]);
    expect(url).toContain('/api/v1/recherche?q=biscuits');
  });
});
