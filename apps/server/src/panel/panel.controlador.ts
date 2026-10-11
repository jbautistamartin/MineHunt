import { Controller, Get, Header } from '@nestjs/common';
import { VERSION_MOTOR } from '@minehunt/game-engine';

import type { InformeSala } from '@minehunt/game-engine';
import { ServicioSalas } from '../salas/salas.servicio.js';
import { contenidoDelPanel, paginaDelPanel } from './panel.js';

/**
 * Sirve el panel del servidor, en `/panel`.
 *
 * **Ya no ocupa la raiz**: desde la Fase 9 la imagen lleva dentro el cliente
 * web y es el propio Nest quien lo sirve, asi que quien escribe la direccion a
 * secas espera el juego y no la contabilidad del servidor. Sin bundle al lado
 * —desarrollando, con la web en su `ng serve`— la raiz redirige aqui, que es
 * lo unico que hay que ver entonces.
 */
@Controller()
export class ControladorPanel {
  constructor(private readonly salas: ServicioSalas) {}

  @Get('panel')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  pagina(): string {
    return paginaDelPanel(this.informes(), VERSION_MOTOR);
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
