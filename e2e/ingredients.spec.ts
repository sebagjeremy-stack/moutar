import { expect, test } from '@playwright/test';
import { graine, imagePng, remettreSansIngredients } from './_base';

/**
 * ③ Les ingrédients (lots 1 et 3) : saisis à la main → analyse par le code ; lus sur une photo par un OCR SIMULÉ (la route
 * `…/ingredients/ocr` est interceptée : le moteur d'IA n'est jamais appelé en e2e) → le texte dans la zone, relu, enregistré
 * (`PUT` réel, `source: 'ocr'`) → la carte à jour. Le produit de la graine est remis sans ingrédients à la fin.
 */
test.describe('③ ingrédients', () => {
  test.afterEach(async () => {
    await remettreSansIngredients(graine().eans.ocr);
  });

  test('③ saisie manuelle → « Analyser » → la carte lit la composition', async ({ page }) => {
    const { eans } = graine();
    await page.goto(`/produit/${eans.ocr}/ingredients`);
    await expect(page.getByRole('heading', { level: 1, name: 'Scanner les ingrédients' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Photographier l’étiquette' })).toBeVisible();
    await page.getByLabel('Liste d’ingrédients').fill('Sucre, huile de palme, noisettes 13 %, cacao maigre, lait écrémé en poudre, émulsifiant : lécithine de soja (E322), vanilline.');
    await page.getByRole('button', { name: 'Analyser les ingrédients' }).click();
    await expect(page).toHaveURL(new RegExp(`/produit/${eans.ocr}$`));
    const niveau4 = page.locator('section[aria-labelledby="titre-niveaux"] > ol > li').nth(3);
    await expect(niveau4.locator('.pastille')).not.toHaveText('');
    await expect(niveau4.getByRole('link', { name: 'Saisir les ingrédients' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Scanner les ingrédients' })).toHaveCount(0);
  });

  test('③ OCR simulé → texte relu dans la zone → enregistrer → carte à jour (E120 : non cacher)', async ({ page }) => {
    const { eans } = graine();
    let appelsOcr = 0;
    await page.route('**/ingredients/ocr', async (route) => {
      appelsOcr++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ texte: 'Sucre, sirop de glucose, colorant : E120, arômes.', texteBrut: 'Sucre, sirop de glucose, colorant : E 1 2 0, arômes.', langue: 'fr', lisible: true, confiance: 0.9 }),
      });
    });
    await page.goto(`/scan?pour=ingredients&ean=${eans.ocr}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Photographier l’étiquette' })).toBeVisible();
    // Sans caméra (Chromium headless) : l'image vient de l'appareil — un PNG de synthèse, jamais une photo réelle.
    await page.locator('input[type="file"]').setInputFiles(imagePng());
    await expect(page.getByText(/envoyée seulement si vous lisez, jamais gardée/)).toBeVisible();
    await page.getByRole('button', { name: 'Lire les ingrédients' }).click();
    await expect(page).toHaveURL(new RegExp(`/produit/${eans.ocr}/ingredients$`));
    expect(appelsOcr).toBe(1);
    await expect(page.getByText('Lu sur la photo · relisez avant d’enregistrer')).toBeVisible();
    await expect(page.locator('.pastille-neutre')).toHaveText('Confiance : très probable');
    const zone = page.getByLabel('Liste d’ingrédients');
    await expect(zone).toHaveValue('Sucre, sirop de glucose, colorant : E120, arômes.');
    // Le texte lu tel quel reste consultable (il diffère du texte nettoyé).
    await page.getByText('Voir le texte lu tel quel').click();
    await expect(page.getByText('E 1 2 0')).toBeVisible();
    const envoi = page.waitForRequest((r) => r.method() === 'PUT' && r.url().endsWith(`/produits/${eans.ocr}/ingredients`));
    await page.getByRole('button', { name: 'Enregistrer et analyser' }).click();
    expect((await envoi).postDataJSON()).toMatchObject({ source: 'ocr' });
    await expect(page).toHaveURL(new RegExp(`/produit/${eans.ocr}$`));
    const niveau4 = page.locator('section[aria-labelledby="titre-niveaux"] > ol > li').nth(3);
    await expect(niveau4.locator('.pastille-danger')).toHaveText('Non cacher · composition');
    await expect(page.getByText('Fiche lue sur l’étiquette', { exact: false })).toBeVisible();
  });
});
