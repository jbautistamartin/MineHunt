/**
 * Punto de entrada publico del motor de juego de MineHunt.
 *
 * Fase 1: tablero, revelado en cascada, turnos y marcador.
 * La IA llega en la Fase 2 y el item de despeje en la Fase 3.
 */

export { MotorJuego } from './motor.js';
export { Tablero } from './tablero.js';
export {
  ErrorPartida,
  MAX_JUGADORES,
  MIN_JUGADORES,
  type CeldaVisible,
  type CodigoError,
  type CodigoResultadoClic,
  type Coordenada,
  type EstadoCelda,
  type EstadoPartida,
  type Jugador,
  type OpcionesPartida,
  type ResultadoClic,
} from './tipos.js';

/** Version del motor, util para comprobar que cliente y servidor comparten la misma. */
export const VERSION_MOTOR = '0.1.0';

/**
 * Saludo de comprobacion: confirma que el paquete compila, se exporta y se
 * puede consumir desde otros paquetes del monorepo.
 */
export function saludar(): string {
  return `MineHunt: motor de juego ${VERSION_MOTOR} listo`;
}
