import { defineConfig } from 'vitest/config';

// Pruebas end-to-end del servidor: levantan la aplicacion Nest completa.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-prueba.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
