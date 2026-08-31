import { defineConfig } from 'vitest/config';

// Pruebas unitarias del servidor.
// Los tiempos son holgados porque el primer arranque en Windows compila y
// carga los decoradores de Nest, y con la cache fria supera los 5s por defecto.
export default defineConfig({
  resolve: {
    // Resuelve los alias de rutas declarados en tsconfig.json, incluidos los
    // que anade `nest g library`.
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.prueba.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
