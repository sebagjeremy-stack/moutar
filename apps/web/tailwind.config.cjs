const { resolve } = require('node:path');

/**
 * Les jetons de `mockups/moutar-fun.css` deviennent les jetons Tailwind : mêmes noms, valeurs en `var(--…)` (définies dans
 * `src/styles/global.css`, clair et sombre). Jamais une couleur en dur dans un composant.
 * Les accents 1 à 4 (corail, soleil, lagon, lavande) sont DÉCORATIFS ; les sémantiques (ok, warn, danger, neutral)
 * gardent leur sens exclusif.
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: [resolve(__dirname, 'index.html'), resolve(__dirname, 'src/**/*.{ts,tsx}')],
  // Les classes de ton de la maquette existent toujours, même composées dynamiquement.
  safelist: [{ pattern: /^(pastille|synthese|bandeau)-(ok|warn|danger|neutre|info)$/ }, { pattern: /^(pastille-num|btn-accent|choix-seuil|viseur-coin)-[1-4]$/ }],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      bg: 'var(--bg)',
      surface: { DEFAULT: 'var(--surface)', 2: 'var(--surface-2)' },
      text: 'var(--text)',
      muted: 'var(--muted)',
      border: 'var(--border)',
      input: 'var(--input)',
      primary: { DEFAULT: 'var(--primary)', strong: 'var(--primary-strong)', soft: 'var(--primary-soft)', on: 'var(--on-primary)' },
      'accent-1': { DEFAULT: 'var(--accent-1)', hover: 'var(--accent-1-hover)', soft: 'var(--accent-1-soft)', on: 'var(--on-accent-1)' },
      'accent-2': { DEFAULT: 'var(--accent-2)', hover: 'var(--accent-2-hover)', soft: 'var(--accent-2-soft)', on: 'var(--on-accent-2)' },
      'accent-3': { DEFAULT: 'var(--accent-3)', hover: 'var(--accent-3-hover)', soft: 'var(--accent-3-soft)', on: 'var(--on-accent-3)' },
      'accent-4': { DEFAULT: 'var(--accent-4)', hover: 'var(--accent-4-hover)', soft: 'var(--accent-4-soft)', on: 'var(--on-accent-4)' },
      ok: { DEFAULT: 'var(--ok)', soft: 'var(--ok-soft)' },
      warn: { DEFAULT: 'var(--warn)', soft: 'var(--warn-soft)' },
      danger: { DEFAULT: 'var(--danger)', soft: 'var(--danger-soft)' },
      neutral: { DEFAULT: 'var(--neutral)', soft: 'var(--neutral-soft)' },
    },
    fontFamily: { sans: ['var(--font)'], display: ['var(--font-display)'] },
    fontSize: {
      small: ['var(--fs-small)', '1.4'],
      note: ['var(--fs-note)', '1.45'],
      body: ['var(--fs-body)', '1.45'],
      title: ['var(--fs-title)', '1.3'],
      '17': ['17px', '1.35'],
      '18': ['18px', '1.3'],
      '19': ['19px', '1.3'],
    },
    borderRadius: { none: '0', sm: 'var(--radius-sm)', DEFAULT: 'var(--radius)', fun: 'var(--radius)', full: '999px' },
    boxShadow: { DEFAULT: 'var(--shadow)', primary: 'var(--shadow-primary)', 'accent-1': 'var(--shadow-accent-1)', none: 'none' },
    extend: {
      minHeight: { tap: 'var(--tap)' },
      spacing: { gutter: 'var(--gutter)', tap: 'var(--tap)' },
      maxWidth: { ecran: '430px', console: '1100px' },
      transitionDuration: { fun: 'var(--duree)' },
      transitionTimingFunction: { fun: 'var(--courbe)' },
    },
  },
  plugins: [],
};
