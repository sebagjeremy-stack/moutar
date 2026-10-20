import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/** Tests du front : composants (jsdom) et règles d'écran pures. */
export default defineConfig({
  plugins: [react()],
  test: { globals: true, environment: 'jsdom', include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'] },
});
