import { expect, test } from '@playwright/test';
import { graine } from './_base';

/**
 * ② La carte produit (lots 1 et 2) : la synthèse et les quatre niveaux ; le niveau 2 porte UNE sous-ligne par liste active,
 * chacune avec ses dates ; le rouge n'apparaît que pour « non cacher » ; un produit sans ingrédients propose de les scanner ;
 * une API qui ne répond pas donne « non lu » en ambre avec « Réessayer » — jamais « aucun ».
 */
test('② Petit Beurre : synthèse, quatre niveaux, sous-lignes du niveau 2 datées', async ({ page }) => {
  const { eans } = graine();
  await page.goto(`/produit/${eans.cite}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Petit Beurre' })).toBeVisible();
  await expect(page.getByText('Lu', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Selon votre seuil : niveau 2 · Liste officielle/ })).toBeVisible();
  // La synthèse porte une pastille avec son mot (jamais la seule couleur).
  const synthese = page.getByRole('region', { name: /Selon votre seuil/ }).or(page.locator('section[aria-labelledby="titre-synthese"]'));
  await expect(synthese.locator('.pastille').first()).not.toHaveText('');
  // Les quatre niveaux, dans l'ordre.
  const niveaux = page.locator('section[aria-labelledby="titre-niveaux"] > ol > li');
  await expect(niveaux).toHaveCount(4);
  for (const [i, mot] of ['Certifié', 'Liste officielle', 'Communautaire', 'Sur composition'].entries()) await expect(niveaux.nth(i)).toContainText(mot);
  // Niveau 1 sans certification : « Aucun logo lu » (neutre) et la photo du logo.
  await expect(niveaux.nth(0).locator('.pastille-neutre')).toHaveText('Aucun logo lu');
  await expect(niveaux.nth(0).getByRole('link', { name: 'Photographier le logo' })).toBeVisible();
  // Niveau 2 : une sous-ligne par liste active, la source en gras, les dates, la pastille « Cité … » avec son mot.
  const sousLignes = page.getByRole('list', { name: 'Sources du niveau 2' }).getByRole('listitem');
  const n = await sousLignes.count();
  expect(n).toBeGreaterThanOrEqual(1);
  for (let i = 0; i < n; i++) {
    const s = sousLignes.nth(i);
    await expect(s).toContainText(/publiée le \d{2}\/\d{2}\/\d{4}|date de publication non indiquée/);
    await expect(s).toContainText(/valable jusqu’au \d{2}\/\d{2}\/\d{4}|expirée le \d{2}\/\d{2}\/\d{4}|sans date de fin annoncée/);
    await expect(s.locator('.pastille')).toContainText(/^Cité/);
  }
  // La marque « Lu » est nommée par les listes fictives : au moins une sous-ligne le dit, et aucune n'est rouge.
  await expect(page.locator('.pastille-danger')).toHaveCount(0);
  // Le niveau 3 propose une contribution ; le niveau 4 lit la composition (E322) sans jamais être vert.
  await expect(niveaux.nth(2).getByRole('link', { name: 'Proposer une contribution' })).toBeVisible();
  await expect(niveaux.nth(3).locator('.pastille-ok')).toHaveCount(0);
  // L'attribution Open Food Facts (ODbL) vit dans la carte des ingrédients, repliée.
  await page.locator('details.carte > summary').click();
  await expect(page.locator('details.carte').getByText(/Open Food Facts \(ODbL\)|Open Food Facts · ODbL/)).toBeVisible();
});

test('② Bonbons gélifiés (gélatine, E120) : « Non cacher · composition » en rouge, et le rouge seulement là', async ({ page }) => {
  const { eans } = graine();
  await page.goto(`/produit/${eans.nonCacher}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Bonbons gélifiés' })).toBeVisible();
  const niveaux = page.locator('section[aria-labelledby="titre-niveaux"] > ol > li');
  await expect(niveaux.nth(3).locator('.pastille-danger')).toHaveText('Non cacher · composition');
  // Un « non cacher » se lit à tout niveau : la synthèse le porte aussi (rouge), avec le mot.
  await expect(page.locator('section[aria-labelledby="titre-synthese"] .pastille-danger')).toContainText('Non cacher');
  // Toute pastille rouge dit « Non cacher » : jamais un rouge décoratif, jamais sans son mot.
  const rouges = page.locator('.pastille-danger');
  for (let i = 0; i < (await rouges.count()); i++) await expect(rouges.nth(i)).toContainText('Non cacher');
  // Le niveau 4 porte toujours son avertissement.
  await expect(niveaux.nth(3).locator('.bandeau-warn')).toBeVisible();
  // Les ingrédients se lisent, repliés, avec les codes mis en avant.
  await page.locator('details.carte > summary').click();
  await expect(page.locator('details.carte').getByText(/Sirop de glucose, sucre, gélatine/)).toBeVisible();
});

test('② un produit sans ingrédients propose « Scanner les ingrédients »', async ({ page }) => {
  const { eans } = graine();
  await page.goto(`/produit/${eans.sansIngredients}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Biscuits apéritif' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Scanner les ingrédients' })).toBeVisible();
  const niveaux = page.locator('section[aria-labelledby="titre-niveaux"] > ol > li');
  const pastillesNiveau2 = niveaux.nth(1).locator('.pastille');
  expect(await pastillesNiveau2.count()).toBeGreaterThanOrEqual(1);
  for (let i = 0; i < (await pastillesNiveau2.count()); i++) await expect(pastillesNiveau2.nth(i)).toContainText(/Non cité|Non vérifié/);
  await expect(niveaux.nth(3).getByRole('link', { name: 'Saisir les ingrédients' })).toBeVisible();
  await expect(page.locator('.pastille-danger')).toHaveCount(0);
});

test('② l’API ne répond pas (503) : « non lu » en ambre et « Réessayer », jamais « aucun »', async ({ page }) => {
  const ean = '3000000000999';
  let appels = 0;
  await page.route('**/api/v1/produits/**', async (route) => {
    appels++;
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'source_indisponible', message: 'Open Food Facts ne répond pas : la fiche n’a pas pu être lue. Réessayez, ou créez le produit à la main.' }) });
  });
  await page.goto(`/produit/${ean}`);
  await expect(page.getByRole('heading', { name: 'Fiche non lue' })).toBeVisible();
  await expect(page.locator('.pastille-warn')).toHaveText('Non lu');
  await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible();
  const texte = (await page.locator('main').innerText()).toLowerCase();
  expect(texte).not.toContain('aucun');
  expect(texte).not.toMatch(/\b(zéro|0 additif)\b/);
  await expect(page.locator('.pastille-danger')).toHaveCount(0);
  const avant = appels;
  await page.getByRole('button', { name: 'Réessayer' }).click();
  await expect.poll(() => appels).toBeGreaterThan(avant);
  await expect(page.getByRole('heading', { name: 'Fiche non lue' })).toBeVisible();
});
