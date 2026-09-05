/**
 * Punto de entrada publico del motor de juego de MineHunt.
 *
 * Fase 1: tablero, revelado en cascada, turnos y marcador.
 * Fase 2: bots con cinco niveles de inteligencia.
 * Fase 3: onda expansiva con recarga, turno que se conserva al encontrar mina,
 * reloj de turno opcional y rendicion.
 * Fase 4: tabla de niveles del Modo Historia y logica de progreso.
 * Fase 6: el protocolo con el que cliente y servidor se hablan en las partidas
 * online, que vive aqui por ser el vocabulario comun de los dos.
 */

export {
  MENSAJES_DEL_CLIENTE,
  MENSAJES_DEL_SERVIDOR,
  VERSION_PROTOCOLO,
  versionesCompatibles,
  type CodigoErrorProtocolo,
  type CodigoErrorSala,
  type ConfiguracionSala,
  type Entrada,
  type EstadoSala,
  type PeticionClic,
  type PeticionConVersion,
  type PeticionCrearSala,
  type PeticionOnda,
  type PeticionReconectar,
  type PeticionUnirse,
  type PuestoSala,
  type Reentrada,
  type Resultado,
  type SucesoPartida,
  type VistaSala,
} from './red/protocolo.js';

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
export {
  NIVELES_HISTORIA,
  NIVELES_POR_ZONA,
  TOTAL_NIVELES,
  TOTAL_ZONAS,
  obtenerNivel,
  type NivelHistoria,
} from './historia/niveles.js';
export {
  estaDesbloqueado,
  estaSuperado,
  historiaCompletada,
  progresoInicial,
  registrarResultado,
  type ProgresoHistoria,
} from './historia/progreso.js';
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

import { VERSION_MOTOR } from './version.js';

export { VERSION_MOTOR } from './version.js';

/**
 * Saludo de comprobacion: confirma que el paquete compila, se exporta y se
 * puede consumir desde otros paquetes del monorepo.
 */
export function saludar(): string {
  return `MineHunt: motor de juego ${VERSION_MOTOR} listo`;
}
