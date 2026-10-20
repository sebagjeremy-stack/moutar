const { resolve } = require('node:path');

/**
 * Les jetons de `mockups/moutar.css` deviennent les jetons Tailwind : mêmes noms, valeurs en `var(--…)` (définies dans
 * `src/styles/global.css`, clair et sombre). Jamais une couleur en dur dans un composant.
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: [resolve(__dirname, 'index.html'), resolve(__dirname, 'src/**/*.{ts,tsx}')],
  // Les classes de ton de la maquette existent toujours, même composées dynamiquement.
  safelist: [{ pattern: /^(pastille|synthese|bandeau)-(ok|warn|danger|neutre|info)$/ }],
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
      ok: { DEFAULT: 'var(--ok)', soft: 'var(--ok-soft)' },
      warn: { DEFAULT: 'var(--warn)', soft: 'var(--warn-soft)' },
      danger: { DEFAULT: 'var(--danger)', soft: 'var(--danger-soft)' },
      neutral: { DEFAULT: 'var(--neutral)', soft: 'var(--neutral-soft)' },
    },
    fontFamily: { sans: ['var(--font)'] },
    fontSize: {
      small: ['var(--fs-small)', '1.4'],
      note: ['var(--fs-note)', '1.45'],
      body: ['var(--fs-body)', '1.45'],
      title: ['var(--fs-title)', '1.3'],
      '17': ['17px', '1.35'],
      '18': ['18px', '1.3'],
      '19': ['19px', '1.3'],
    },
    borderRadius: { none: '0', sm: 'var(--radius-sm)', DEFAULT: 'var(--radius)', full: '999px' },
    boxShadow: { DEFAULT: 'var(--shadow)', none: 'none' },
    extend: {
      minHeight: { tap: 'var(--tap)' },
      spacing: { gutter: 'var(--gutter)', tap: 'var(--tap)' },
      maxWidth: { ecran: '430px', console: '1100px' },
    },
  },
  plugins: [],
};
