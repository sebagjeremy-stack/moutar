import { mkdirSync } from 'node:fs';
import { expect, test as setup } from '@playwright/test';
import { DOSSIER_E2E, ETAT_ADMIN, graine, motDePasseAdmin } from './_base';

/**
 * UNE connexion à la console pour toute la passe (10 essais par quart d'heure, par e-mail et par adresse) : les cookies
 * sont enregistrés dans `.devstack/e2e/admin.json` (ignoré par git) et rejoués par le projet `console` (`storageState`)
 * ou par `sessionAdmin`. Si la graine l'a demandé (aucune liste active ne cite « Lu »), une liste Consistoire FICTIVE est
 * importée ici par l'API de la console — elle devient l'édition active du code (il n'y en avait pas).
 */
setup('connexion de la console, cookies enregistrés', async ({ page, context }) => {
  const g = graine();
  mkdirSync(DOSSIER_E2E, { recursive: true });
  const r = await page.request.post('/api/v1/admin/connexion', { data: { email: g.adminEmail, motDePasse: motDePasseAdmin() } });
  if (r.status() !== 200 && r.status() !== 201) throw new Error(`Connexion refusée (${r.status()}) : ${await r.text()}`);
  const moi = await page.request.get('/api/v1/admin/moi');
  expect(moi.ok(), await moi.text()).toBe(true);
  await context.storageState({ path: ETAT_ADMIN });

  if (g.listeFictiveAImporter) {
    const listes = (await (await page.request.get('/api/v1/admin/listes')).json()) as { listes: Array<{ code: string; active: boolean }> };
    if (!listes.listes.some((l) => l.code === 'consistoire_paris' && l.active)) {
      const importee = await page.request.post('/api/v1/admin/listes', {
        data: {
          code: 'consistoire_paris',
          titre: 'Consistoire de Paris — liste FICTIVE des tests e2e',
          publieLe: '2026-07-01',
          valableJusquAu: '2027-07-31',
          noteSource: 'Liste fictive importée par les tests bout-en-bout : aucune valeur religieuse.',
          lignes: [
            { rubrique: 'BISCUITS SECS', marque: 'Lu', produitLibelle: 'Petit Beurre', mention: null, touteMarque: false, rubriqueReservee: false },
            { rubrique: 'BISCUITS SECS', marque: 'Gerblé', produitLibelle: null, mention: 'lait non surveillé', touteMarque: false, rubriqueReservee: false },
            { rubrique: 'YAOURTS', marque: null, produitLibelle: null, mention: null, touteMarque: true, rubriqueReservee: false },
          ],
        },
      });
      expect(importee.status(), await importee.text()).toBe(201);
    }
  }
});
