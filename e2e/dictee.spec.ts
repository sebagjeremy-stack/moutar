import { expect, test } from '@playwright/test';

/**
 * ⑨ La dictée de secours (lot 4) en mode SERVEUR SIMULÉ : la Web Speech API est retirée du navigateur, le micro et
 * `MediaRecorder` sont simulés (`addInitScript`), la route `POST /transcriptions` est interceptée (sondée à vide : 400 ;
 * puis 200 avec une confiance de 0,3). Rien n'est cherché d'office : la carte ambre « J'ai entendu … — c'est bien ça ? »
 * attend « Oui, chercher » (le champ, puis les suggestions) ou « Non ». Le moteur d'IA n'est jamais appelé.
 */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Sans reconnaissance dans le navigateur, `useDictee` passe au secours serveur.
    for (const nom of ['SpeechRecognition', 'webkitSpeechRecognition']) Object.defineProperty(window, nom, { value: undefined, configurable: true, writable: true });
    class MediaRecorderSimule {
      static isTypeSupported() {
        return true;
      }
      state = 'inactive';
      mimeType: string;
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      constructor(_flux: unknown, options?: { mimeType?: string }) {
        this.mimeType = options?.mimeType ?? 'audio/webm';
      }
      start() {
        this.state = 'recording';
      }
      stop() {
        if (this.state === 'inactive') return;
        this.state = 'inactive';
        // Un faux WebM (en-tête EBML) : le serveur n'est pas appelé, la route est interceptée.
        this.ondataavailable?.({ data: new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0])], { type: 'audio/webm' }) });
        this.onstop?.();
      }
    }
    Object.defineProperty(window, 'MediaRecorder', { value: MediaRecorderSimule, configurable: true, writable: true });
    const mediaDevices = navigator.mediaDevices ?? ({} as MediaDevices);
    Object.defineProperty(mediaDevices, 'getUserMedia', { value: async () => ({ getTracks: () => [{ stop: () => undefined }] }), configurable: true, writable: true });
    if (!navigator.mediaDevices) Object.defineProperty(navigator, 'mediaDevices', { value: mediaDevices, configurable: true });
  });
});

test('⑨ une transcription incertaine (0,3) est proposée, jamais cherchée seule ; « Oui, chercher » remplit le champ', async ({ page }) => {
  let appels = 0;
  let audioRecu = false;
  await page.route('**/api/v1/transcriptions', async (route) => {
    appels++;
    const corps = route.request().postDataBuffer()?.toString('latin1') ?? '';
    const avecAudio = corps.includes('name="audio"');
    if (!avecAudio) {
      // La sonde, à vide : la route existe (400 `audio_absent`).
      await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'audio_absent', message: 'Aucun enregistrement reçu.' }) });
      return;
    }
    audioRecu = true;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ texte: 'biscuits', langue: 'fr', confiance: 0.3 }) });
  });
  await page.goto('/');
  const champ = page.getByRole('combobox', { name: 'Nom du produit, marque ou code-barres' });
  await page.getByRole('button', { name: 'Dicter' }).click();
  const ecoute = page.getByRole('button', { name: /À l’écoute/ });
  await expect(ecoute).toBeVisible();
  await expect(ecoute).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('status')).toContainText('Dites le nom du produit ou sa marque ; appuyez de nouveau pour arrêter.');
  // Un second appui arrête l'enregistrement : il part, la réponse est incertaine.
  await ecoute.click();
  const carte = page.locator('[data-dictee="incertaine"]');
  await expect(carte).toBeVisible();
  expect(audioRecu).toBe(true);
  expect(appels).toBe(2);
  await expect(carte.getByRole('heading')).toHaveText('J’ai entendu : « biscuits » — c’est bien ça ?');
  await expect(carte.locator('.pastille-warn')).toHaveText('À confirmer');
  // Rien n'est cherché d'office : le champ est vide, aucune requête de recherche n'est partie.
  await expect(champ).toHaveValue('');
  let recherches = 0;
  page.on('request', (r) => {
    if (r.url().includes('/api/v1/recherche')) recherches++;
  });
  await page.waitForTimeout(500);
  expect(recherches).toBe(0);
  // « Oui, chercher » : le texte va au champ, les suggestions suivent.
  await carte.getByRole('button', { name: 'Oui, chercher' }).click();
  await expect(carte).toHaveCount(0);
  await expect(champ).toHaveValue('biscuits');
  await expect(champ).toBeFocused();
  await expect(page.getByRole('listbox', { name: 'Suggestions' })).toBeVisible();
  expect(recherches).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Dicter' })).toBeVisible();
});

test('⑨ « Non » écarte le texte proposé : rien n’est cherché, le champ reste vide', async ({ page }) => {
  await page.route('**/api/v1/transcriptions', async (route) => {
    const corps = route.request().postDataBuffer()?.toString('latin1') ?? '';
    if (!corps.includes('name="audio"')) {
      await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'audio_absent', message: 'Aucun enregistrement reçu.' }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ texte: 'galettes au beurre', langue: 'fr', confiance: 0.42 }) });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Dicter' }).click();
  await page.getByRole('button', { name: /À l’écoute/ }).click();
  const carte = page.locator('[data-dictee="incertaine"]');
  await expect(carte.getByRole('heading')).toHaveText('J’ai entendu : « galettes au beurre » — c’est bien ça ?');
  let recherches = 0;
  page.on('request', (r) => {
    if (r.url().includes('/api/v1/recherche')) recherches++;
  });
  await carte.getByRole('button', { name: 'Non' }).click();
  await expect(carte).toHaveCount(0);
  const champ = page.getByRole('combobox', { name: 'Nom du produit, marque ou code-barres' });
  await expect(champ).toHaveValue('');
  await expect(champ).toBeFocused();
  await page.waitForTimeout(500);
  expect(recherches).toBe(0);
  await expect(page.getByRole('button', { name: 'Dicter' })).toBeVisible();
});
