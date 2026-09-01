import { Routes } from '@angular/router';

/**
 * Rutas de la aplicacion.
 *
 * Fase 1: configuracion y partida del Modo Entrenamiento. El Modo Historia
 * (Fase 4) y el Multijugador Online (Fase 7) cuelgan de aqui.
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./paginas/configuracion/configuracion').then((modulo) => modulo.Configuracion),
  },
  {
    path: 'partida',
    loadComponent: () => import('./paginas/partida/partida').then((modulo) => modulo.Partida),
  },
  {
    path: 'ayuda',
    loadComponent: () => import('./paginas/ayuda/ayuda').then((modulo) => modulo.Ayuda),
  },
  { path: '**', redirectTo: '' },
];
