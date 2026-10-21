import { defineConfig, devices } from '@playwright/test';
import { ETAT_ADMIN } from './e2e/_base';
import { executablePathChromium } from './e2e/_chromium';

/**
 * Tests bout-en-bout de Moutar (Chromium headless, parcours réels contre la pile de développement).
 * Pré-requis : la pile DÉMARRÉE (`bash scripts/dev-restart.sh` : web 5273, API 3100) et la graine
 * `pnpm --filter @moutar/api db:seed-e2e` passée. Aucun `webServer` ici : on ne relance jamais la pile depuis les tests.
 * Trois projets : `setup` (une seule connexion à la console, cookies rejoués ensuite — 10 essais par quart d'heure),
 * `mobile` (iPhone 13, 390 × 844, thème clair) et `console` (1 100 px, session administrateur rejouée).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'line',
  outputDir: '.devstack/e2e/resultats',
  use: {
    baseURL: 'http://localhost:5273',
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'retain-on-failure',
    launchOptions: { executablePath: executablePathChromium() },
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 1100, height: 800 } } },
    {
      name: 'mobile',
      testMatch: /(accueil|carte-produit|ingredients|logo|seuil-historique|accessibilite|dictee)\.spec\.ts/,
      // Un iPhone 13 (390 × 844) en Chromium : le moteur WebKit n'est pas installé ici, la taille et le tactile suffisent.
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light' },
      dependencies: ['setup'],
    },
    {
      name: 'console',
      testMatch: /(admin|contribution)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1100, height: 900 }, colorScheme: 'light', storageState: ETAT_ADMIN },
      dependencies: ['setup'],
    },
  ],
});
