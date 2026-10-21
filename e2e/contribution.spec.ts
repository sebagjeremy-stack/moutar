import { expect, test } from '@playwright/test';
import { carte, graine, nettoyerContributions } from './_base';

/**
 * ⑤ Les contributions communautaires (lot 5) : le parcours en quatre écrans → 201 → la fiche dit « Contribution en attente
 * de validation » ; la console valide → « Validé par la communauté · LBPC » (au seuil 3, la synthèse est « Permis ») ;
 * la console refuse → la ligne redevient « Non vérifié » ; tout est retiré (doux) à la fin. Projet `console` : la session
 * administrateur est rejouée (`storageState`), jamais rouverte.
 */
test.describe('⑤ contribution', () => {
  test.afterEach(async () => {
    await nettoyerContributions(graine().eans.sansIngredients);
  });

  test('⑤ proposer → en attente → valider à la console → validé → refuser → retiré', async ({ page }) => {
    const { eans } = graine();
    const ean = eans.sansIngredients;
    await page.goto(`/produit/${ean}/contribution`);
    await expect(page.getByRole('heading', { level: 1, name: 'Proposer une contribution' })).toBeVisible();
    await expect(page.getByText('Étape 1 sur 4')).toBeVisible();
    await page.getByText('Le produit est cité comme cacher').click();
    await expect(page.getByText('Choisi')).toBeVisible();
    await page.getByRole('button', { name: 'Continuer' }).click();
    await expect(page.getByText('Étape 2 sur 4')).toBeVisible();
    await expect(page.getByRole('radio', { name: /Les Bons Plans Cachères/ })).toBeChecked();
    await page.getByRole('button', { name: 'Continuer' }).click();
    await expect(page.getByText('Étape 3 sur 4')).toBeVisible();
    await page.getByLabel('Texte de la source').fill('Validé par le groupe (essai e2e) : « OK selon la liste ».');
    await page.getByLabel('Pseudonyme (facultatif)').fill('testeur e2e');
    await page.getByRole('button', { name: 'Continuer' }).click();
    await expect(page.getByText('Étape 4 sur 4')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Récapitulatif' })).toBeVisible();
    const envoi = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith(`/produits/${ean}/contributions`));
    await page.getByRole('button', { name: 'Envoyer' }).click();
    expect((await envoi).status()).toBe(201);
    await expect(page.getByText('Votre contribution attend la validation.')).toBeVisible();
    await page.getByRole('link', { name: 'Retour à la fiche' }).click();
    const niveau3 = () => page.locator('section[aria-labelledby="titre-niveaux"] > ol > li').nth(2);
    await expect(niveau3().locator('.pastille-warn')).toHaveText('Contribution en attente de validation');
    await expect(page.locator('section[aria-labelledby="titre-synthese"] .pastille')).toContainText('Non vérifié');

    // La console : la ligne, nommée par son produit, se valide EN PLACE.
    await page.goto('/admin/contributions?etat=proposee');
    const ligne = page.getByRole('listitem').filter({ hasText: `EAN ${ean.replace(/(\d)(?=(\d{3})+$)/g, '$1 ')}` }).filter({ hasText: 'testeur e2e' });
    await expect(ligne.first()).toBeVisible();
    await expect(ligne.first().locator('.pastille-warn')).toHaveText('En attente');
    await ligne.first().getByRole('button', { name: 'Valider' }).click();
    await expect(ligne.first()).toContainText('Valider cette contribution ?');
    const validation = page.waitForResponse((r) => r.request().method() === 'PUT' && r.url().includes('/admin/contributions/'));
    await ligne.first().getByRole('button', { name: 'Oui, valider' }).click();
    expect((await validation).status()).toBe(200);
    await expect(page.getByRole('status').filter({ hasText: 'Contribution validée' })).toBeVisible();

    // La fiche la lit : verte au niveau 3, mais la synthèse reste « Non vérifié » au seuil 2 — « Permis » au seuil 3.
    await page.goto(`/produit/${ean}`);
    await expect(niveau3().locator('.pastille-ok')).toHaveText('Validé par la communauté · LBPC');
    await expect(niveau3()).toContainText('proposée par « testeur e2e »');
    await expect(niveau3().getByRole('link', { name: 'Proposer une contribution' })).toHaveCount(0);
    await expect(page.locator('section[aria-labelledby="titre-synthese"] .pastille')).toContainText('Non vérifié');
    const auSeuil3 = await carte(page.request, ean, 3);
    expect(auSeuil3.synthese.pastille).toBe('Permis · communauté · LBPC');
    await niveau3().locator('summary').click();
    await expect(niveau3().getByRole('list', { name: 'Contributions validées' }).locator('.pastille-ok')).toHaveText('Cité comme permis · LBPC');

    // Refuser depuis « Validées » : le verdict est retiré, la fiche redevient « Non vérifié ».
    await page.goto('/admin/contributions?etat=validee');
    const validee = page.getByRole('listitem').filter({ hasText: 'testeur e2e' }).first();
    await validee.getByRole('button', { name: 'Refuser' }).click();
    await validee.getByLabel('Motif (facultatif, gardé à la console)').fill('Essai e2e : retiré par le test.');
    const refus = page.waitForResponse((r) => r.request().method() === 'PUT' && r.url().includes('/admin/contributions/'));
    await validee.getByRole('button', { name: 'Oui, refuser' }).click();
    expect((await refus).status()).toBe(200);
    await page.goto(`/produit/${ean}`);
    await expect(niveau3().locator('.pastille-warn')).toHaveText('Non vérifié');
    await expect(niveau3().getByRole('link', { name: 'Proposer une contribution' })).toBeVisible();
    await expect(page.locator('.pastille-danger')).toHaveCount(0);
  });
});
