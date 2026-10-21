import { expect, test } from '@playwright/test';
import { graine } from './_base';

/**
 * ⑧ Les garde-fous d'écran (CLAUDE.md) sur trois pages : aucune couleur en dur (les pastilles portent les JETONS
 * sémantiques, relus par `computedStyle` et comparés aux variables), chaque pastille porte son mot, aucun défilement
 * horizontal à 360 px, un `h1` par page, `lang="fr"`.
 */
const PAGES = (ean: string) => ['/', `/produit/${ean}`, '/scan'];

/** Les couleurs (fond, texte) qu'un jeton sémantique donne, lues dans le navigateur par un élément témoin. */
async function couleursDesJetons(page: import('@playwright/test').Page): Promise<Record<string, { fond: string; texte: string }>> {
  return page.evaluate(() => {
    const r: Record<string, { fond: string; texte: string }> = {};
    for (const jeton of ['ok', 'warn', 'danger', 'neutral']) {
      const temoin = document.createElement('span');
      temoin.style.backgroundColor = `var(--${jeton}-soft)`;
      temoin.style.color = `var(--${jeton})`;
      document.body.appendChild(temoin);
      const cs = getComputedStyle(temoin);
      r[jeton] = { fond: cs.backgroundColor, texte: cs.color };
      temoin.remove();
    }
    return r;
  });
}

for (const chemin of PAGES(graine().eans.nonCacher)) {
  test(`⑧ ${chemin} : jetons seulement, pastilles avec leur mot, pas de défilement horizontal, h1, lang`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto(chemin);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    // La page est rendue (la carte lue, le viseur ou le secours de la caméra, l'accueil).
    await expect(page.locator('main')).not.toContainText(/Lecture de la fiche…|Chargement…/);
    if (chemin.startsWith('/produit/')) await expect(page.locator('.pastille').first()).toBeVisible();
    // Aucune couleur en dur dans un style en ligne.
    expect(await page.locator('[style*="#"], [style*="rgb("], [style*="hsl("]').count()).toBe(0);
    // Chaque pastille porte son mot, et ses couleurs sont celles d'un jeton sémantique (jamais une valeur à elle).
    const jetons = await couleursDesJetons(page);
    const pastilles = await page.locator('.pastille').evaluateAll((els) =>
      els.map((el) => {
        const cs = getComputedStyle(el);
        return { texte: (el.textContent ?? '').trim(), fond: cs.backgroundColor, couleur: cs.color, classe: el.className };
      }),
    );
    for (const p of pastilles) {
      expect(p.texte, p.classe).not.toBe('');
      const jeton = Object.values(jetons).find((j) => j.fond === p.fond && j.texte === p.couleur);
      expect(jeton, `pastille « ${p.texte} » (${p.classe}) : fond ${p.fond}, texte ${p.couleur} — pas un jeton sémantique`).toBeTruthy();
    }
    // Le rouge ne dit que « non cacher ».
    for (const p of pastilles.filter((x) => x.classe.includes('pastille-danger'))) expect(p.texte).toContain('Non cacher');
    // Aucun défilement horizontal à 360 px.
    const largeurs = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, fenetre: window.innerWidth, corps: document.body.scrollWidth }));
    expect(largeurs.page, JSON.stringify(largeurs)).toBeLessThanOrEqual(largeurs.fenetre);
    expect(largeurs.corps).toBeLessThanOrEqual(largeurs.fenetre);
  });
}
