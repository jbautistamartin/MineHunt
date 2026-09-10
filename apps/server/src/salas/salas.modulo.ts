import { Module } from '@nestjs/common';

import { leerConfiguracion, type Configuracion } from '../configuracion.js';
import { AZAR, CONFIGURACION, RELOJ, type Azar, type Reloj } from './dependencias.js';
import { LimitadorDeRitmo } from './limitador.js';
import { PasarelaPartida } from './partida.pasarela.js';
import { InterceptorDeRitmo } from './ritmo.interceptor.js';
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
    { provide: CONFIGURACION, useFactory: () => leerConfiguracion() },
    {
      // Uno solo para todo el servidor: son las marcas de cada conexion, y dos
      // limitadores dejarian pasar el doble sin que se notara.
      provide: LimitadorDeRitmo,
      useFactory: (configuracion: Configuracion, ahora: Reloj) =>
        new LimitadorDeRitmo(configuracion.maxMensajesPorSegundo, ahora),
      inject: [CONFIGURACION, RELOJ],
    },
    InterceptorDeRitmo,
  ],
  exports: [ServicioSalas],
})
export class ModuloSalas {}
