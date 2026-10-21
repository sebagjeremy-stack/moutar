import { expect, test } from '@playwright/test';
import { graine } from './_base';

/**
 * ⑥ Le seuil et l'historique (lots 1 et 4), tous deux gardés sur CE téléphone seulement : changer le seuil relit la fiche
 * « selon votre seuil » ; l'historique montre les derniers produits, une ligne se retire d'un clic, « Tout effacer » se
 * confirme en place. Un contexte neuf par test : le stockage est vide au départ.
 */
test('⑥ changer le seuil → l’accueil et la fiche le relisent', async ({ page }) => {
  const { eans } = graine();
  await page.goto('/');
  await page.getByRole('link', { name: 'Modifier mon seuil' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Mon seuil' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Liste officielle/ })).toBeChecked();
  await page.getByText('Communautaire', { exact: true }).click();
  await expect(page.getByRole('radio', { name: /Communautaire/ })).toBeChecked();
  await page.getByRole('button', { name: 'Garder ce seuil' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('Je m’arrête au niveau 3 · Communautaire')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('moutar_seuil'))).toBe('3');
  const lecture = page.waitForRequest((r) => r.url().includes(`/produits/${eans.cite}/carte?seuil=3`));
  await page.goto(`/produit/${eans.cite}`);
  await lecture;
  await expect(page.getByRole('heading', { name: 'Selon votre seuil : niveau 3 · Communautaire' })).toBeVisible();
});

test('⑥ historique : une ligne par produit vu, retrait d’un clic, « Tout effacer » confirmé en place', async ({ page }) => {
  const { eans } = graine();
  await page.goto(`/produit/${eans.cite}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Petit Beurre' })).toBeVisible();
  await page.goto(`/produit/${eans.nonCacher}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Bonbons gélifiés' })).toBeVisible();
  // L'accueil : la plus récente en tête, avec sa pastille (le mot) ; rien de personnel.
  await page.goto('/');
  const derniers = page.locator('section[aria-labelledby="titre-derniers"] li');
  await expect(derniers).toHaveCount(2);
  await expect(derniers.nth(0)).toContainText('Bonbons gélifiés');
  await expect(derniers.nth(0).locator('.pastille-danger')).toContainText('Non cacher');
  await expect(derniers.nth(1)).toContainText('Petit Beurre');
  const brut = await page.evaluate(() => localStorage.getItem('moutar_historique') ?? '');
  expect(brut).toContain(eans.cite);
  expect(brut).not.toMatch(/@|photo|image/);
  // La page de l'historique.
  await page.getByRole('link', { name: 'Historique des produits vérifiés' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Historique' })).toBeVisible();
  await expect(page.getByText('Gardés sur ce téléphone seulement · les 20 derniers.')).toBeVisible();
  const lignes = page.locator('section[aria-labelledby="titre-liste"] ul > li');
  await expect(lignes).toHaveCount(2);
  await page.getByRole('button', { name: 'Retirer Petit Beurre de l’historique' }).click();
  await expect(lignes).toHaveCount(1);
  await expect(page.getByRole('link', { name: /Petit Beurre/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Tout effacer' }).click();
  await expect(page.getByRole('alert')).toContainText('Effacer tout l’historique de ce téléphone ?');
  await page.getByRole('button', { name: 'Garder' }).click();
  await expect(lignes).toHaveCount(1);
  await page.getByRole('button', { name: 'Tout effacer' }).click();
  await page.getByRole('button', { name: 'Oui, tout effacer' }).click();
  await expect(page.getByText('Pas encore de produit : photographiez-en un.')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('moutar_historique'))).toBeNull();
});
