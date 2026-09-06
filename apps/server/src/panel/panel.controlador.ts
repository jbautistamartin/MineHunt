import { Controller, Get, Header } from '@nestjs/common';
import { VERSION_MOTOR } from '@minehunt/game-engine';

import type { InformeSala } from '../salas/sala.js';
import { ServicioSalas } from '../salas/salas.servicio.js';
import { contenidoDelPanel, paginaDelPanel } from './panel.js';

/**
 * Sirve el panel del servidor.
 *
 * Esta en la raiz porque es lo que uno abre al escribir la direccion del
 * servidor a secas; `/panel` lleva a lo mismo y es la que quedara cuando en la
 * Fase 9 la raiz la ocupe la web del juego servida por el propio Nest.
 */
@Controller()
export class ControladorPanel {
  constructor(private readonly salas: ServicioSalas) {}

  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  pagina(): string {
    return paginaDelPanel(this.informes(), VERSION_MOTOR);
  }

  @Get('panel')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  paginaEnSuRuta(): string {
    return this.pagina();
  }

  /** Solo la lista, que es lo que el navegador vuelve a pedir cada poco. */
  @Get('panel/salas')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  lista(): string {
    return contenidoDelPanel(this.informes());
  }

  private informes(): readonly InformeSala[] {
    return this.salas.todas().map((sala) => sala.informe());
  }
}
