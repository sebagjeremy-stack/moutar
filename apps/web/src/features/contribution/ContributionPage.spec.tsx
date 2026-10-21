import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContributionPage } from './ContributionPage';

/*
 * L'écran « Proposer une contribution » (21/10/2026) : à l'étape 1, « Continuer » sans choix écrit « Choisissez d'abord ce
 * que dit la source. » en ambre et les trois cartes ont le même fond neutre ; à l'étape 3, le formulaire porte `noValidate`
 * et ce sont NOS messages ambre qui parlent (texte vide, date future) ; au récapitulatif, le lien affiché est celui que le
 * serveur gardera (sans `fbclid`), avec la note. Aucun appel réseau n'est envoyé (le produit est lu, simulé).
 */
/** Rend la page et attend le nom du produit (la lecture simulée) : aucune mise à jour hors `act` ensuite. */
async function rendre() {
  render(
    <MemoryRouter initialEntries={['/produit/3000000000901/contribution']}>
      <Routes>
        <Route path="/produit/:ean/contribution" element={<ContributionPage />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByText('Petit Beurre');
}

describe('ContributionPage', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn());
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ nom: 'Petit Beurre', marque: 'Lu' }) })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('étape 1 : « Continuer » sans choix → message ambre ; les trois cartes ont le fond neutre ; la sélection se lit par « Choisi »', async () => {
    await rendre();
    expect(screen.getByText('Étape 1 sur 4')).toBeTruthy();
    const cartes = document.querySelectorAll('label.choix-seuil');
    expect(cartes).toHaveLength(3);
    for (const c of cartes) {
      expect(c.className).toContain('choix-seuil-4');
      expect(c.className).not.toMatch(/choix-seuil-[123]\b/);
    }
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(screen.getByRole('alert').textContent).toBe('Choisissez d’abord ce que dit la source.');
    expect(screen.getByText('Étape 1 sur 4')).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Le produit est cité comme cacher/));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Choisi')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(screen.getByText('Étape 2 sur 4')).toBeTruthy();
  });

  it('étape 3 : noValidate, un texte vide et une date future donnent nos messages ; étape 4 : le lien sans fbclid, avec la note', async () => {
    await rendre();
    fireEvent.click(screen.getByLabelText(/Le produit est cité comme cacher/));
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(screen.getByText('Étape 3 sur 4')).toBeTruthy();
    const formulaire = document.getElementById('formulaire-source') as HTMLFormElement;
    expect(formulaire.noValidate).toBe(true);
    fireEvent.change(screen.getByLabelText('Date de la source (facultatif)'), { target: { value: '2999-01-01' } });
    fireEvent.submit(formulaire);
    expect(screen.getByText('Recopiez ce que dit la source (au moins quelques mots).')).toBeTruthy();
    expect(screen.getByText('Le jour de la source doit être un jour du calendrier, au plus tard aujourd’hui.')).toBeTruthy();
    expect(screen.getByText('2 champs sont à corriger avant de continuer.')).toBeTruthy();
    expect(screen.getByText('Étape 3 sur 4')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Texte de la source'), { target: { value: 'Validé par le groupe.' } });
    fireEvent.change(screen.getByLabelText('Date de la source (facultatif)'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Lien de preuve (facultatif)'), { target: { value: 'https://www.facebook.com/groups/lbpc/posts/1?fbclid=IwAR0abc&utm_source=fb&comment_id=7' } });
    fireEvent.submit(formulaire);
    expect(screen.getByText('Étape 4 sur 4')).toBeTruthy();
    expect(screen.getByText('https://www.facebook.com/groups/lbpc/posts/1?comment_id=7')).toBeTruthy();
    expect(screen.getByText('(paramètres de suivi retirés)')).toBeTruthy();
    expect(screen.queryByText(/fbclid/)).toBeNull();
  });
});
