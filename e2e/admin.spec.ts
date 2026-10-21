import { expect, test } from '@playwright/test';
import { sql } from './_base';

/**
 * ⑦ La console (lots 1, 2, 5), session administrateur REJOUÉE (projet `console`) : le tableau de bord (des comptes), les
 * additifs (une surcharge posée puis remise comme avant), les listes (l'aperçu d'un texte FICTIF, avec ses avertissements —
 * JAMAIS un import, qui désactiverait l'édition active), le journal (en ajout seul).
 */
const CODE = 'E1520';

test('⑦ tableau de bord : quatre comptes, chacun un lien vers son onglet', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Tableau de bord' })).toHaveAttribute('aria-current', 'page');
  for (const titre of ['Produits lus', 'Contributions en attente', 'Signalements ouverts', 'Lectures IA du jour']) {
    const tuile = page.getByRole('link').filter({ hasText: titre });
    await expect(tuile).toBeVisible();
    await expect(tuile.locator('span').first()).toHaveText(/^\d[\d\s ]*$/);
  }
  await expect(page.getByText('Des comptes seulement : la console ne voit aucune personne')).toBeVisible();
  await expect(page.locator('.pastille-danger')).toHaveCount(0);
});

test('⑦ additifs : une surcharge posée par PUT, journalisée, puis remise comme avant', async ({ page }) => {
  // L'état d'avant, relu par l'API, pour le remettre à la fin.
  type Ligne = { code: string; surcharge: { statut: string; source: string; note: string | null } | null };
  const avant = ((await (await page.request.get('/api/v1/admin/additifs')).json()) as Ligne[]).find((a) => a.code === CODE);
  expect(avant, `${CODE} est au catalogue`).toBeTruthy();
  try {
    await page.goto('/admin/additifs');
    await expect(page.getByRole('heading', { name: /^Additifs · \d+ lignes$/ })).toBeVisible();
    await page.getByLabel('Filtrer les additifs').fill(CODE);
    const ligne = page.getByRole('listitem').filter({ has: page.getByText(CODE, { exact: true }) }).first();
    await ligne.getByRole('button', { name: 'Modifier' }).click();
    await ligne.getByLabel('Statut').selectOption('douteux');
    await ligne.getByLabel('Source (obligatoire)').fill('essai e2e — surcharge de test');
    await ligne.getByLabel('Note').fill('Posée par le test ⑦, remise ensuite.');
    const envoi = page.waitForResponse((r) => r.request().method() === 'PUT' && r.url().endsWith(`/admin/additifs/${CODE}`));
    await ligne.getByRole('button', { name: 'Enregistrer' }).click();
    expect((await envoi).status()).toBe(200);
    await expect(ligne.locator('.pastille')).toHaveText('Douteux · confirmé');
    await expect(ligne).toContainText('Source : essai e2e — surcharge de test');
    // Le journal porte la ligne.
    await page.goto('/admin/journal');
    await expect(page.getByRole('heading', { name: /^Journal · \d+ dernières lignes$/ })).toBeVisible();
    await expect(page.getByText('En ajout seul : rien ne s’y modifie ni ne s’y efface.')).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: CODE }).first()).toContainText(/additif/);
  } finally {
    // Remise : la surcharge d'avant par PUT, ou, s'il n'y en avait pas, la ligne retirée (la table n'a pas de retrait doux).
    if (avant?.surcharge) {
      const r = await page.request.put(`/api/v1/admin/additifs/${CODE}`, { data: { statut: avant.surcharge.statut, source: avant.surcharge.source, note: avant.surcharge.note } });
      expect(r.status(), await r.text()).toBe(200);
    } else {
      await sql('DELETE FROM additif_surcharge WHERE code_e = $1', [CODE]);
    }
  }
  const apres = ((await (await page.request.get('/api/v1/admin/additifs')).json()) as Ligne[]).find((a) => a.code === CODE);
  expect(apres?.surcharge ?? null).toEqual(avant?.surcharge ?? null);
});

test('⑦ listes : l’aperçu d’un texte fictif lit des lignes et nomme ses avertissements, sans rien importer', async ({ page }) => {
  const nombreAvant = (await sql<{ n: string }>('SELECT count(*)::text AS n FROM liste_officielle'))[0]?.n;
  await page.goto('/admin/listes');
  await expect(page.getByRole('heading', { name: /^Listes officielles · \d+ éditions?$/ })).toBeVisible();
  await page.getByRole('button', { name: 'Importer une liste' }).click();
  await page.getByLabel('… ou le texte collé').fill(
    ['Liste FICTIVE pour un test : aucune valeur religieuse.', '', 'BISCUITS SECS', 'Marque Fictive : Petit Sablé, Galette (L)', 'Autre Marque', '', 'YAOURTS', '', 'VINS', '', 'CHOCOLATS', 'Choco Fictif sauf les gammes fourrées'].join('\n'),
  );
  const apercu = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/admin/listes/apercu'));
  await page.getByRole('button', { name: 'Aperçu', exact: true }).click();
  expect((await apercu).status()).toBe(200);
  await expect(page.getByRole('heading', { name: /^Aperçu · \d+ lignes lues/ })).toBeVisible();
  const avertissements = page.locator('.bandeau-warn').filter({ hasText: /avertissements? de l’analyse/ });
  await expect(avertissements).toBeVisible();
  await expect(avertissements).toContainText(/VINS/);
  await expect(avertissements).toContainText(/sauf/);
  await expect(page.getByLabel('Rubrique, ligne 1', { exact: true })).toHaveValue('BISCUITS SECS');
  await expect(page.getByLabel('Marque, ligne 1', { exact: true })).toHaveValue('Marque Fictive');
  await expect(page.getByLabel('Produit, ligne 1', { exact: true })).toHaveValue('Petit Sablé');
  await expect(page.getByLabel('Mention, ligne 2', { exact: true })).toHaveValue('lait non surveillé');
  await expect(page.getByLabel('Note de la source (introduction, réserves)')).toHaveValue(/Liste FICTIVE pour un test/);
  // Jamais d'import ici : il désactiverait l'édition active. On annule.
  await page.getByRole('button', { name: 'Annuler' }).last().click();
  await expect(page.getByRole('button', { name: 'Importer une liste' })).toBeVisible();
  expect((await sql<{ n: string }>('SELECT count(*)::text AS n FROM liste_officielle'))[0]?.n).toBe(nombreAvant);
});

test('⑦ journal : les dernières lignes, dont la connexion du compte e2e', async ({ page }) => {
  await page.goto('/admin/journal');
  await expect(page.getByRole('heading', { name: /^Journal · \d+ dernières lignes$/ })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'connexion' }).filter({ hasText: 'e2e@exemple.fr' }).first()).toBeVisible();
  // Aucune suppression possible : la route répond 405.
  const r = await page.request.delete('/api/v1/admin/journal');
  expect(r.status()).toBe(405);
});
