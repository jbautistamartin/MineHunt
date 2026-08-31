/**
 * Tipos publicos del motor de MineHunt.
 *
 * Regla de oro: nada de lo que sale de aqui revela si una celda OCULTA tiene
 * mina. Los jugadores humanos y la IA (Fase 2) consumen exactamente la misma
 * informacion, y esa informacion es la que describen estos tipos.
 */

/** Estado visible de una celda. */
export type EstadoCelda = 'oculta' | 'despejada' | 'mina-encontrada';

/** Posicion en el tablero. El origen (0, 0) es la esquina superior izquierda. */
export interface Coordenada {
  readonly x: number;
  readonly y: number;
}

/** Celda tal y como la ve un jugador. */
export interface CeldaVisible {
  readonly x: number;
  readonly y: number;
  readonly estado: EstadoCelda;
  /**
   * Numero de minas en las ocho celdas vecinas.
   * Solo tiene valor cuando la celda esta despejada; en cualquier otro caso
   * es null, porque el jugador todavia no puede conocerlo.
   */
  readonly minasAdyacentes: number | null;
  /**
   * Id del jugador que encontro la mina de esta celda.
   * Solo tiene valor cuando el estado es 'mina-encontrada'.
   */
  readonly encontradaPor: number | null;
}

/** Marcador de un jugador. */
export interface Jugador {
  /** Indice del jugador, de 0 a numJugadores - 1. */
  readonly id: number;
  readonly minasEncontradas: number;
}

/** Fotografia completa de la partida desde el punto de vista de los jugadores. */
export interface EstadoPartida {
  readonly ancho: number;
  readonly alto: number;
  readonly totalMinas: number;
  readonly minasEncontradas: number;
  readonly minasRestantes: number;
  /** Filas de celdas: celdas[y][x]. */
  readonly celdas: readonly (readonly CeldaVisible[])[];
  readonly jugadores: readonly Jugador[];
  /** Id del jugador al que le toca mover. */
  readonly turnoDe: number;
  readonly terminada: boolean;
  /** Id del ganador; null si hay empate o la partida sigue en curso. */
  readonly ganador: number | null;
  /** true solo si la partida termino con varios jugadores empatados en cabeza. */
  readonly empate: boolean;
}

/**
 * Codigo del resultado de un clic.
 *
 * Son codigos, no texto: el cliente Angular los traduce al idioma del jugador
 * y el servidor (Fase 6) los emitira tal cual por WebSocket.
 */
export type CodigoResultadoClic = 'MINA_ENCONTRADA' | 'CELDA_DESPEJADA';

/** Que ocurrio tras un clic. */
export interface ResultadoClic {
  readonly codigo: CodigoResultadoClic;
  /** Jugador que hizo el clic. */
  readonly jugador: number;
  /** Celdas que pasaron a ser visibles, incluida la clicada. */
  readonly celdasReveladas: readonly Coordenada[];
  /** Marcador del jugador despues del clic. */
  readonly minasEncontradasPorElJugador: number;
  /** Jugador al que le toca ahora. */
  readonly turnoDe: number;
  readonly terminada: boolean;
}

/** Motivos por los que el motor rechaza una operacion. */
export type CodigoError =
  | 'DIMENSIONES_INVALIDAS'
  | 'MINAS_INVALIDAS'
  | 'JUGADORES_INVALIDOS'
  | 'CELDA_FUERA_DEL_TABLERO'
  | 'CELDA_YA_REVELADA'
  | 'PARTIDA_TERMINADA'
  | 'SIN_JUGADAS';

/**
 * Error del motor con codigo traducible.
 * El mensaje en ingles es solo para depuracion; la interfaz traduce el codigo.
 */
export class ErrorPartida extends Error {
  constructor(
    readonly codigo: CodigoError,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorPartida';
  }
}

/** Ajustes opcionales de una partida. */
export interface OpcionesPartida {
  /**
   * Fuente de aleatoriedad para colocar las minas, en [0, 1).
   * Se puede inyectar para que las pruebas sean deterministas.
   */
  readonly aleatorio?: () => number;
}

/** Numero minimo y maximo de jugadores admitidos. */
export const MIN_JUGADORES = 2;
export const MAX_JUGADORES = 4;
