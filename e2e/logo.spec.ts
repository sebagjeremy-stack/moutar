import { expect, test } from '@playwright/test';
import { carte, graine, imagePng, poserCertification, retirerVerdicts } from './_base';

/**
 * ④ Le logo de certification (lot 3) : la lecture est SIMULÉE (`…/logo` intercepté : le moteur d'IA n'est jamais appelé
 * en e2e) → les propositions → « C'est bien ce logo » part pour de vrai (`POST …/certification`) : le serveur ne connaît
 * pas ce jeton (il ne s'obtient que d'une lecture réelle, haché en mémoire) et répond 400 `proposition_inconnue`, que
 * l'écran traduit. Puis une certification POSÉE EN BASE (ce que le serveur écrit après une lecture réelle) donne la carte
 * « Certifié · OU », retirée d'un clic confirmé EN PLACE (`DELETE` réel) ; tout est nettoyé.
 */
test.describe('④ logo', () => {
  test.afterEach(async () => {
    await retirerVerdicts(graine().eans.cite, 1);
  });

  test('④ photo → propositions (lecture simulée) → validation réelle : le jeton inconnu est refusé, l’écran le dit', async ({ page }) => {
    const { eans } = graine();
    await page.route('**/logo', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          propositions: [{ code: 'ou', nom: 'Orthodox Union (OU)', nomCourt: 'OU', confiance: 0.9, texteLu: 'U', mentions: ['parve'] }],
          aucun: false,
          candidatsNonReconnus: ['XYZ'],
          autresTextes: ['Biscuits sablés'],
          jeton: 'jeton-simule-e2e-0000000000',
        }),
      });
    });
    await page.goto(`/scan?pour=logo&ean=${eans.cite}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Photographier le logo' })).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles(imagePng());
    await expect(page.getByText(/envoyée seulement si vous lisez, jamais gardée/)).toBeVisible();
    await page.getByRole('button', { name: 'Lire le logo' }).click();
    await expect(page).toHaveURL(new RegExp(`/produit/${eans.cite}/logo$`));
    // Le jeton voyage dans l'état de navigation, jamais dans l'adresse.
    expect(page.url()).not.toContain('jeton');
    await expect(page.getByRole('heading', { name: 'Logo proposé' })).toBeVisible();
    await expect(page.getByText('Orthodox Union (OU)')).toBeVisible();
    await expect(page.getByText('Lu sur la photo : « U »')).toBeVisible();
    await expect(page.locator('.pastille-neutre')).toHaveText('Confiance : très probable');
    await expect(page.getByRole('checkbox', { name: 'parvé' })).toBeChecked();
    await expect(page.getByText(/Symbole lu, inconnu du catalogue : « XYZ »/)).toBeVisible();
    const validation = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith(`/produits/${eans.cite}/certification`));
    await page.getByRole('button', { name: 'C’est bien ce logo' }).click();
    const r = await validation;
    expect(r.status()).toBe(400);
    expect(((await r.json()) as { code: string }).code).toBe('proposition_inconnue');
    await expect(page.getByRole('alert')).toContainText('La proposition a expiré : reprenez la photo.');
    await expect(page.getByRole('alert').getByRole('button', { name: 'Reprendre la photo' })).toBeVisible();
    // Rien n'a été écrit.
    const c = await carte(page.request, eans.cite);
    expect(c.lignes[0]?.pastille).toBe('Aucun logo lu');
  });

  test('④ une certification validée : carte « Certifié · OU », « Retirer » confirmé en place, DELETE réel, nettoyé', async ({ page }) => {
    const { eans } = graine();
    await poserCertification(eans.cite, { code: 'ou', nom: 'Orthodox Union (OU)', mentions: ['parve'], mentionsLibelles: ['parvé'], texteLu: 'U' });
    await page.goto(`/produit/${eans.cite}`);
    const niveau1 = page.locator('section[aria-labelledby="titre-niveaux"] > ol > li').nth(0);
    await expect(niveau1.locator('.pastille-ok')).toHaveText('Certifié · OU');
    await expect(niveau1).toContainText(/validé par vous le \d{2}\/\d{2}\/\d{4} \(texte lu : « U »\)\. Mention : parvé\./);
    await expect(page.locator('section[aria-labelledby="titre-synthese"] .pastille-ok')).toHaveText('Permis · OU · parvé');
    // La page du logo, ouverte à la main, relit la certification actuelle.
    await page.goto(`/produit/${eans.cite}/logo`);
    await expect(page.getByRole('heading', { name: 'Retenue aujourd’hui' })).toBeVisible();
    await expect(page.locator('.pastille-ok')).toHaveText('Certifié · OU');
    await expect(page.getByText(/Validée par vous le \d{2}\/\d{2}\/\d{4} · texte lu : « U »/)).toBeVisible();
    await page.getByRole('button', { name: 'Retirer' }).click();
    await expect(page.getByRole('alert')).toContainText('Retirer cette certification ?');
    const retrait = page.waitForResponse((r) => r.request().method() === 'DELETE' && r.url().endsWith(`/produits/${eans.cite}/certification`));
    await page.getByRole('button', { name: 'Oui, retirer' }).click();
    expect((await retrait).status()).toBe(200);
    await expect(page.locator('.pastille-neutre')).toHaveText('Aucun logo lu');
    const c = await carte(page.request, eans.cite);
    expect(c.lignes[0]?.pastille).toBe('Aucun logo lu');
  });
});
