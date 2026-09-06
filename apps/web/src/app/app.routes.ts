import { Routes } from '@angular/router';

/**
 * Rutas de la aplicacion.
 *
 * La raiz es el menu principal: desde ahi se elige modo. La configuracion del
 * Entrenamiento, que antes ocupaba la raiz, vive en /entrenamiento; el mapa de
 * niveles del Modo Historia en /historia, y los dos entran a la misma pantalla
 * de partida. El Multijugador Online vive en /online, y ahi caben sus tres
 * momentos —entrar, esperar en el lobby y jugar—, porque son el mismo sitio.
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./paginas/inicio/inicio').then((modulo) => modulo.Inicio),
  },
  {
    path: 'entrenamiento',
    loadComponent: () =>
      import('./paginas/configuracion/configuracion').then((modulo) => modulo.Configuracion),
  },
  {
    path: 'partida',
    loadComponent: () => import('./paginas/partida/partida').then((modulo) => modulo.Partida),
  },
  {
    path: 'historia',
    loadComponent: () => import('./paginas/historia/historia').then((modulo) => modulo.Historia),
  },
  {
    path: 'online',
    loadComponent: () => import('./paginas/online/online').then((modulo) => modulo.Online),
  },
  {
    path: 'ayuda',
    loadComponent: () => import('./paginas/ayuda/ayuda').then((modulo) => modulo.Ayuda),
  },
  {
    path: 'acerca',
    loadComponent: () => import('./paginas/acerca/acerca').then((modulo) => modulo.Acerca),
  },
  { path: '**', redirectTo: '' },
];
