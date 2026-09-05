import { Module } from '@nestjs/common';

import { AZAR, RELOJ, type Azar, type Reloj } from './dependencias.js';
import { PasarelaPartida } from './partida.pasarela.js';
import { ServicioSalas } from './salas.servicio.js';

/**
 * El multijugador online: salas, lobby y partidas con el servidor de
 * autoridad.
 *
 * El reloj y el azar se declaran aqui como proveedores para poder cambiarlos
 * en las pruebas sin tocar el codigo que los usa.
 */
@Module({
  providers: [
    ServicioSalas,
    PasarelaPartida,
    { provide: RELOJ, useValue: (() => Date.now()) satisfies Reloj },
    { provide: AZAR, useValue: (() => Math.random()) satisfies Azar },
  ],
  exports: [ServicioSalas],
})
export class ModuloSalas {}
