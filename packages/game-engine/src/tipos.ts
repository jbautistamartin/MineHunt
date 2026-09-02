/**
 * Tipos publicos del motor de MineHunt.
 *
 * Regla de oro: mientras la partida esta en curso, nada de lo que sale de aqui
 * revela si una celda OCULTA tiene mina. Los jugadores humanos y la IA (Fase 2)
 * consumen exactamente la misma informacion, y esa informacion es la que
 * describen estos tipos. Al terminar la partida se destapa el tablero entero,
 * que ya no hay ventaja que dar a nadie.
 */

/**
 * Estado visible de una celda.
 *
 * 'mina-sin-encontrar' solo aparece con la partida ya terminada: al acabar se
 * destapa el tablero entero y las minas que no se llevo nadie se ven, pero sin
 * duenno. Mientras se juega ese estado no sale nunca.
 */
export type EstadoCelda =
  | 'oculta'
  | 'despejada'
  | 'mina-encontrada'
  | 'mina-sin-encontrar';

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

/**
 * Estado de la onda expansiva de un jugador.
 *
 * - disponible: se puede activar.
 * - activo: activado, se gastara en el proximo clic de ese jugador.
 * - recargando: gastado, hay que esperar a que vuelva.
 */
export type EstadoOnda = 'disponible' | 'activo' | 'recargando';

export interface OndaJugador {
  readonly estado: EstadoOnda;
  /** Milisegundos que faltan para recuperarla; 0 si no esta recargando. */
  readonly recargaRestanteMs: number;
}

/** Marcador de un jugador. */
export interface Jugador {
  /** Indice del jugador, de 0 a numJugadores - 1. */
  readonly id: number;
  readonly minasEncontradas: number;
  readonly onda: OndaJugador;
  /**
   * Se ha rendido: ya no le llega el turno ni puede ganar, y se queda mirando
   * como espectador. Las minas que encontro siguen suyas en el tablero, pero
   * no cuentan para nada.
   */
  readonly rendido: boolean;
}

/** Fotografia completa de la partida desde el punto de vista de los jugadores. */
export interface EstadoPartida {
  readonly ancho: number;
  readonly alto: number;
  readonly totalMinas: number;
  readonly minasEncontradas: number;
  readonly minasRestantes: number;
  /**
   * Filas de celdas: celdas[y][x].
   * Con la partida terminada llegan todas destapadas: ya no hay nada que
   * proteger y quien mira quiere ver como estaba el tablero.
   */
  readonly celdas: readonly (readonly CeldaVisible[])[];
  readonly jugadores: readonly Jugador[];
  /** Id del jugador al que le toca mover. */
  readonly turnoDe: number;
  /**
   * Milisegundos que tiene cada jugador para mover, 0 si no hay limite.
   * Es el ajuste de la partida, no lo que queda del turno en curso.
   */
  readonly tiempoPorTurnoMs: number;
  /**
   * Milisegundos que le quedan al jugador de turno antes de perderlo.
   * null cuando la partida no tiene limite de tiempo o ya termino.
   */
  readonly tiempoRestanteMs: number | null;
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
export type CodigoResultadoClic =
  | 'MINA_ENCONTRADA'
  | 'CELDA_DESPEJADA'
  | 'ONDA_EXPANSIVA';

/**
 * Codigo de cualquier suceso de la partida, no solo de los clics.
 *
 * TURNO_PERDIDO y JUGADOR_RENDIDO no los produce ningun clic: el primero lo
 * levanta quien vigila el reloj al ver que comprobarTiempoDeTurno() ha pasado
 * el turno, y el segundo sale de rendirse(). Viven aqui para que cliente y
 * servidor (Fase 6) nombren los sucesos igual.
 */
export type CodigoSuceso =
  | CodigoResultadoClic
  | 'TURNO_PERDIDO'
  | 'JUGADOR_RENDIDO';

/** Que ocurrio tras un clic. */
export interface ResultadoClic {
  readonly codigo: CodigoResultadoClic;
  /** Jugador que hizo el clic. */
  readonly jugador: number;
  /** Celdas que pasaron a ser visibles, incluida la clicada. */
  readonly celdasReveladas: readonly Coordenada[];
  /** Marcador del jugador despues del clic. */
  readonly minasEncontradasPorElJugador: number;
  /** Si el clic gasto la onda expansiva. */
  readonly ondaUsada: boolean;
  /** Jugador al que le toca ahora. */
  readonly turnoDe: number;
  /** Si quien hizo el clic conserva el turno por haber encontrado mina. */
  readonly repite: boolean;
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
  | 'SIN_JUGADAS'
  | 'ONDA_NO_DISPONIBLE'
  | 'YA_RENDIDO'
  | 'NIVEL_INVALIDO';

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
  /** Segundos que tarda en recargarse la onda expansiva. */
  readonly recargaOndaSegundos?: number;
  /**
   * Segundos que tiene cada jugador para mover antes de perder el turno.
   * 0 (el valor por defecto) deja la partida sin limite de tiempo: es cada modo
   * quien decide si aprieta el reloj, no el motor. El Modo Historia (Fase 4) lo
   * ira bajando nivel a nivel.
   */
  readonly tiempoPorTurnoSegundos?: number;
  /**
   * Reloj en milisegundos. Se inyecta para que las pruebas no dependan del
   * tiempo real y para que en la Fase 6 mande el reloj del servidor.
   */
  readonly ahora?: () => number;
}

/** Recarga por defecto de la onda, en segundos. */
export const RECARGA_ONDA_POR_DEFECTO_S = 30;

/** Sin limite de tiempo por turno, que es como arranca el motor si nadie dice otra cosa. */
export const SIN_LIMITE_DE_TIEMPO = 0;

/** Numero minimo y maximo de jugadores admitidos. */
export const MIN_JUGADORES = 2;
export const MAX_JUGADORES = 4;
