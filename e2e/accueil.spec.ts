import { expect, test } from '@playwright/test';
import { graine } from './_base';

/**
 * ① L'accueil (lots 1, 2 et 4) : l'écran, le seuil par défaut (2), l'historique « gardé sur ce téléphone », 13 chiffres
 * tapés → la fiche sans Entrée, « bisc » → les suggestions (une liste `listbox`), Entrée → la recherche telle quelle.
 */
test('① l’écran d’accueil : titre, seuil par défaut, historique local, principe', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.getByRole('heading', { level: 1, name: 'Vérifier un produit' })).toBeAttached();
  await expect(page.getByRole('button', { name: 'Dicter' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Écrire' })).toBeVisible();
  await expect(page.getByText('Je m’arrête au niveau 2 · Liste officielle')).toBeVisible();
  await expect(page.getByText('Gardés sur ce téléphone seulement.')).toBeVisible();
  await expect(page.getByText('Rien pour l’instant : votre premier produit vérifié s’affichera ici.')).toBeVisible();
  await expect(page.getByText('Cette application ne décide pas, elle cite')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Photographier le produit' })).toBeVisible();
});

test('① 13 chiffres tapés ouvrent la fiche, sans Entrée', async ({ page }) => {
  const { eans } = graine();
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Nom du produit, marque ou code-barres' }).fill(eans.cite);
  await expect(page).toHaveURL(new RegExp(`/produit/${eans.cite}$`));
  await expect(page.getByRole('heading', { level: 1, name: 'Petit Beurre' })).toBeVisible();
});

test('① « bisc » → des suggestions dans une liste, un produit connu mène à sa fiche', async ({ page }) => {
  const { eans } = graine();
  await page.goto('/');
  const champ = page.getByRole('combobox', { name: 'Nom du produit, marque ou code-barres' });
  await champ.fill('bisc');
  const liste = page.getByRole('listbox', { name: 'Suggestions' });
  await expect(liste).toBeVisible();
  await expect(champ).toHaveAttribute('aria-expanded', 'true');
  const options = liste.getByRole('option');
  expect(await options.count()).toBeGreaterThan(0);
  // Le produit de la graine (« Biscuits apéritif ») est un produit connu : son option ouvre sa fiche.
  await liste.getByRole('option', { name: /Biscuits apéritif/ }).first().click();
  await expect(page).toHaveURL(new RegExp(`/produit/${eans.sansIngredients}$`));
});

test('① Entrée lance la recherche telle quelle, sans attendre l’anti-rebond', async ({ page }) => {
  await page.goto('/');
  const champ = page.getByRole('combobox', { name: 'Nom du produit, marque ou code-barres' });
  const requete = page.waitForRequest((r) => r.url().includes('/api/v1/recherche?q=petit'));
  await champ.pressSequentially('petit beurre', { delay: 10 });
  await champ.press('Enter');
  const r = await requete;
  expect(decodeURIComponent(new URL(r.url()).searchParams.get('q') ?? '')).toBe('petit beurre');
  await expect(page.getByRole('listbox', { name: 'Suggestions' }).getByRole('option', { name: /Petit Beurre/ }).first()).toBeVisible();
  // Rien de la recherche n'entre dans le stockage du téléphone.
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k !== 'moutar_seuil' && k !== 'moutar_historique'))).toEqual([]);
});
