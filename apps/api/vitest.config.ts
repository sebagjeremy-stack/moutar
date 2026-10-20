import { defineConfig } from 'vitest/config';

/** Tests de l'API : unitaires purs (règles, garde, limite de débit, client OFF simulé). Aucune base requise. */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    setupFiles: ['src/test/setup-env.ts'],
  },
});
