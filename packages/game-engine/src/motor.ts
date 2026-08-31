import { Tablero } from './tablero.js';
import type {
  Coordenada,
  EstadoPartida,
  Jugador,
  OpcionesPartida,
  ResultadoClic,
} from './tipos.js';
import { ErrorPartida, MAX_JUGADORES, MIN_JUGADORES } from './tipos.js';

/**
 * Motor de una partida de MineHunt.
 *
 * Reglas implementadas:
 * - Un clic revela una mina (la anota en el marcador del jugador) o una celda
 *   sin mina, que arrastra la cascada si no tiene minas alrededor.
 * - El turno pasa SIEMPRE al siguiente jugador, se encuentre mina o no.
 * - La partida termina cuando se encuentran todas las minas o cuando el lider
 *   saca tanta ventaja que ya nadie puede alcanzarlo (mayoria matematica).
 * - Gana quien mas minas haya encontrado; si hay varios en cabeza, es empate.
 */
export class MotorJuego {
  private readonly tablero: Tablero;
  private readonly marcador: number[];
  private readonly aleatorio: () => number;
  private turnoActual = 0;
  private minasEncontradas = 0;
  private partidaTerminada = false;

  private constructor(
    ancho: number,
    alto: number,
    minas: number,
    numJugadores: number,
    opciones: OpcionesPartida,
  ) {
    this.tablero = new Tablero(ancho, alto, minas);
    this.marcador = new Array<number>(numJugadores).fill(0);
    this.aleatorio = opciones.aleatorio ?? Math.random;
  }

  /**
   * Crea una partida.
   *
   * Las minas todavia no se colocan: se reparten en el primer clic, evitando
   * la celda clicada, para que nadie encuentre una mina de salida por azar.
   */
  static crearPartida(
    ancho: number,
    alto: number,
    minas: number,
    numJugadores: number,
    opciones: OpcionesPartida = {},
  ): MotorJuego {
    if (!Number.isInteger(ancho) || !Number.isInteger(alto) || ancho < 1 || alto < 1) {
      throw new ErrorPartida(
        'DIMENSIONES_INVALIDAS',
        `Dimensiones invalidas: ${ancho}x${alto}`,
      );
    }
    const totalCeldas = ancho * alto;
    // Hace falta al menos una celda sin mina: la primera que se clica.
    if (!Number.isInteger(minas) || minas < 1 || minas > totalCeldas - 1) {
      throw new ErrorPartida(
        'MINAS_INVALIDAS',
        `Un tablero de ${ancho}x${alto} admite entre 1 y ${totalCeldas - 1} minas, no ${minas}`,
      );
    }
    if (
      !Number.isInteger(numJugadores) ||
      numJugadores < MIN_JUGADORES ||
      numJugadores > MAX_JUGADORES
    ) {
      throw new ErrorPartida(
        'JUGADORES_INVALIDOS',
        `El numero de jugadores debe estar entre ${MIN_JUGADORES} y ${MAX_JUGADORES}, no ${numJugadores}`,
      );
    }

    return new MotorJuego(ancho, alto, minas, numJugadores, opciones);
  }

  /** Clic de un jugador sobre una celda oculta. */
  clicCelda(x: number, y: number): ResultadoClic {
    if (this.partidaTerminada) {
      throw new ErrorPartida('PARTIDA_TERMINADA', 'La partida ya ha terminado');
    }
    if (!this.tablero.contiene(x, y)) {
      throw new ErrorPartida(
        'CELDA_FUERA_DEL_TABLERO',
        `La celda (${x}, ${y}) esta fuera del tablero`,
      );
    }
    if (this.tablero.estadoDe(x, y) !== 'oculta') {
      throw new ErrorPartida(
        'CELDA_YA_REVELADA',
        `La celda (${x}, ${y}) ya estaba revelada`,
      );
    }

    // Primer clic de la partida: aqui se reparten las minas, evitando esta celda.
    this.tablero.colocarMinas({ x, y }, this.aleatorio);

    const jugador = this.turnoActual;
    let celdasReveladas: Coordenada[];
    let codigo: ResultadoClic['codigo'];

    if (this.tablero.tieneMina(x, y)) {
      celdasReveladas = this.tablero.marcarMinaEncontrada(x, y, jugador);
      this.marcador[jugador] = (this.marcador[jugador] as number) + 1;
      this.minasEncontradas += 1;
      codigo = 'MINA_ENCONTRADA';
    } else {
      celdasReveladas = this.tablero.despejar(x, y);
      codigo = 'CELDA_DESPEJADA';
    }

    // El turno pasa siempre, se haya encontrado mina o no.
    this.turnoActual = (this.turnoActual + 1) % this.marcador.length;
    this.actualizarFinDePartida();

    return {
      codigo,
      jugador,
      celdasReveladas,
      minasEncontradasPorElJugador: this.marcador[jugador] as number,
      turnoDe: this.turnoActual,
      terminada: this.partidaTerminada,
    };
  }

  /** Fotografia de la partida sin informacion oculta. */
  obtenerEstado(): EstadoPartida {
    const jugadores: Jugador[] = this.marcador.map((minasEncontradas, id) => ({
      id,
      minasEncontradas,
    }));
    const ganador = this.obtenerGanador();

    return {
      ancho: this.tablero.ancho,
      alto: this.tablero.alto,
      totalMinas: this.tablero.totalMinas,
      minasEncontradas: this.minasEncontradas,
      minasRestantes: this.minasRestantes(),
      celdas: this.tablero.aVisible(),
      jugadores,
      turnoDe: this.turnoActual,
      terminada: this.partidaTerminada,
      ganador,
      empate: this.partidaTerminada && ganador === null,
    };
  }

  estaTerminada(): boolean {
    return this.partidaTerminada;
  }

  /**
   * Ganador de la partida.
   * Devuelve null si la partida sigue en curso o si termino en empate.
   */
  obtenerGanador(): number | null {
    if (!this.partidaTerminada) {
      return null;
    }
    const maximo = Math.max(...this.marcador);
    const lideres = this.marcador.filter((minas) => minas === maximo);
    if (lideres.length > 1) {
      return null;
    }
    return this.marcador.indexOf(maximo);
  }

  /** Clasificacion ordenada de mas a menos minas encontradas. */
  obtenerClasificacion(): readonly Jugador[] {
    return this.marcador
      .map((minasEncontradas, id) => ({ id, minasEncontradas }))
      .sort((a, b) => b.minasEncontradas - a.minasEncontradas);
  }

  private minasRestantes(): number {
    return this.tablero.totalMinas - this.minasEncontradas;
  }

  /**
   * Da la partida por terminada cuando ya no quedan minas o cuando el segundo
   * clasificado no puede alcanzar al lider ni llevandose todas las que quedan.
   */
  private actualizarFinDePartida(): void {
    const restantes = this.minasRestantes();
    if (restantes === 0) {
      this.partidaTerminada = true;
      return;
    }

    const ordenado = [...this.marcador].sort((a, b) => b - a);
    const lider = ordenado[0] as number;
    const segundo = ordenado[1] as number;
    if (lider > segundo + restantes) {
      this.partidaTerminada = true;
    }
  }
}
