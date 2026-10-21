import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Le front appelle l'API en même origine via /api → proxifié vers NestJS (3100). PWA installable : manifeste + service
 * worker qui ne met en cache QUE les fichiers de l'application — jamais une réponse de l'API (un verdict ne se garde pas).
 */
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icone.svg', 'icone-180.png', 'icone-192.png', 'icone-512.png', 'icone-512-maskable.png'],
      manifest: {
        name: 'Moutar',
        short_name: 'Moutar',
        description: 'Vérifier la cacherout d’un produit : une ligne par source, avec sa date et sa validité.',
        lang: 'fr',
        start_url: '/',
        display: 'standalone',
        // Seules couleurs en dur du web (avec index.html) : égales aux jetons `--bg` et `--primary` (lavande) de global.css.
        background_color: '#f6f1fb',
        theme_color: '#7b58d9',
        // Les PNG sont rendus depuis icone.svg (Chromium headless, fond lavande du manifeste) ; la « maskable » est pleine
        // (lavande --primary jusqu'aux bords : le système rogne les coins), le glyphe reste dans la zone sûre.
        icons: [
          { src: '/icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icone-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/icone.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // Le lecteur ZXing (lourd, utile seulement sans `BarcodeDetector` natif) ne se précache pas : il se charge à la demande.
        globIgnores: ['**/zxing-*.js'],
      },
    }),
  ],
  envDir: '../../',
  build: {
    rollupOptions: {
      // ZXing dans son propre morceau, exclu du précache du service worker (voir `workbox.globIgnores`).
      output: { manualChunks: { zxing: ['@zxing/browser', '@zxing/library'] } },
    },
  },
  server: {
    port: 5273,
    proxy: { '/api': { target: 'http://localhost:3100', changeOrigin: true } },
  },
});
