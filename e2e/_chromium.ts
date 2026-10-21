import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

/**
 * Le Chromium que Playwright lance. Le conteneur porte un Chromium PRÉ-INSTALLÉ (`PLAYWRIGHT_BROWSERS_PATH`,
 * `/opt/pw-browsers`) dont la révision peut différer de celle que la version installée de `@playwright/test` attend
 * (`browsers.json` de `playwright-core`) : sans téléchargement (`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`), on pointe alors
 * `executablePath` vers le Chromium présent. Quand la révision attendue est là, on laisse Playwright faire (`undefined`).
 */
export function executablePathChromium(): string | undefined {
  const dossier = process.env['PLAYWRIGHT_BROWSERS_PATH'] || resolve(process.env['HOME'] ?? '', '.cache/ms-playwright');
  if (!existsSync(dossier)) return undefined;
  let attendue: string | null = null;
  try {
    const require = createRequire(resolve(process.cwd(), 'package.json'));
    const core = dirname(require.resolve('playwright-core/package.json'));
    const navigateurs = JSON.parse(readFileSync(resolve(core, 'browsers.json'), 'utf8')) as { browsers: { name: string; revision: string }[] };
    attendue = navigateurs.browsers.find((b) => b.name === 'chromium')?.revision ?? null;
  } catch {
    attendue = null;
  }
  if (attendue && existsSync(resolve(dossier, `chromium-${attendue}`))) return undefined;
  const candidats = readdirSync(dossier)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => Number(b.slice(9)) - Number(a.slice(9)));
  for (const c of candidats) {
    const chemin = resolve(dossier, c, 'chrome-linux', 'chrome');
    if (existsSync(chemin)) return chemin;
  }
  return undefined;
}
