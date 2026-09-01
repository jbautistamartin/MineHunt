/**
 * Punto de entrada publico del motor de juego de MineHunt.
 *
 * Fase 1: tablero, revelado en cascada, turnos y marcador.
 * Fase 2: bots con cinco niveles de inteligencia.
 * Fase 3: onda expansiva con recarga, turno que se conserva al encontrar mina,
 * reloj de turno opcional y rendicion.
 */

export {
  celdasOcultas,
  construirRestricciones,
  deducirBasico,
  deducirCombinado,
  estimarProbabilidades,
  type Deducciones,
  type Restriccion,
} from './ia/analisis.js';
export {
  JugadorIA,
  NIVELES_IA,
  type DecisionIA,
  type MotivoDecision,
  type NivelIA,
  type OpcionesIA,
} from './ia/jugador-ia.js';
export { MotorJuego } from './motor.js';
export { Tablero } from './tablero.js';
export {
  ErrorPartida,
  MAX_JUGADORES,
  MIN_JUGADORES,
  RECARGA_ONDA_POR_DEFECTO_S,
  SIN_LIMITE_DE_TIEMPO,
  type CeldaVisible,
  type CodigoError,
  type CodigoResultadoClic,
  type CodigoSuceso,
  type Coordenada,
  type EstadoCelda,
  type EstadoOnda,
  type EstadoPartida,
  type Jugador,
  type OndaJugador,
  type OpcionesPartida,
  type ResultadoClic,
} from './tipos.js';

/** Version del motor, util para comprobar que cliente y servidor comparten la misma. */
export const VERSION_MOTOR = '0.5.0';

/**
 * Saludo de comprobacion: confirma que el paquete compila, se exporta y se
 * puede consumir desde otros paquetes del monorepo.
 */
export function saludar(): string {
  return `MineHunt: motor de juego ${VERSION_MOTOR} listo`;
}
