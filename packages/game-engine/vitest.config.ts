import { defineConfig } from 'vitest/config';

// Configuracion de pruebas del motor de juego.
// Los ficheros de prueba usan el sufijo .prueba.ts para mantener el codigo en espanol.
export default defineConfig({
  test: {
    include: ['src/**/*.prueba.ts'],
    environment: 'node',
  },
});
