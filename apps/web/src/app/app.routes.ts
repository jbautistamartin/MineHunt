import { Routes } from '@angular/router';

/**
 * Rutas de la aplicacion.
 *
 * La raiz es el menu principal: desde ahi se elige modo. La configuracion del
 * Entrenamiento, que antes ocupaba la raiz, vive en /entrenamiento; el mapa de
 * niveles del Modo Historia en /historia, y los dos entran a la misma pantalla
 * de partida. El Multijugador Online vive en /online, y ahi caben sus tres
 * momentos —entrar, esperar en el lobby y jugar—, porque son el mismo sitio.
 *
 * El Multijugador Local (/local) es **esa misma pantalla** con otro dato en la
 * ruta. Lo unico que cambia entre los dos modos es por donde va la sala —un
 * servidor o el telefono de al lado—, y eso solo afecta a la primera de las
 * tres partes: el lobby y la partida son identicos hasta el pixel, y
 * duplicarlos para cambiar de donde sale el estado habria sido copiar
 * trescientas lineas de plantilla que dicen lo mismo.
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
    path: 'local',
    data: { modo: 'local' },
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
