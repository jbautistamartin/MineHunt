import { Injectable } from '@nestjs/common';

import { VERSION_MOTOR, saludar } from '@minehunt/game-engine';

/**
 * Servicio principal del servidor.
 *
 * Fase 0: solo comprueba que el servidor puede consumir el motor de juego
 * enlazado como dependencia del workspace. La logica de salas y partidas
 * llega en la Fase 6.
 */
@Injectable()
export class ServicioPrincipal {
  /** Estado del servidor, para comprobar de un vistazo que responde. */
  obtenerEstado(): string {
    return `Servidor de MineHunt operativo (motor ${VERSION_MOTOR})`;
  }

  /** Delega en el motor de juego: prueba de que el enlace del monorepo funciona. */
  obtenerSaludoDelMotor(): string {
    return saludar();
  }
}
