import { Injectable } from '@nestjs/common';

import { saludar } from '@minehunt/game-engine';

/**
 * Servicio principal del servidor.
 *
 * Comprueba que el servidor puede consumir el motor de juego enlazado como
 * dependencia del workspace. Lo que se ve al abrir la direccion del servidor
 * no es esto, sino el panel de salas (`panel/`).
 */
@Injectable()
export class ServicioPrincipal {
  /** Delega en el motor de juego: prueba de que el enlace del monorepo funciona. */
  obtenerSaludoDelMotor(): string {
    return saludar();
  }
}
