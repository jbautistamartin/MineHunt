import { Tablero } from './tablero.js';
import type {
  Coordenada,
  EstadoPartida,
  OndaJugador,
  Jugador,
  OpcionesPartida,
  ResultadoClic,
} from './tipos.js';
import {
  ErrorPartida,
  MAX_JUGADORES,
  MIN_JUGADORES,
  RECARGA_ONDA_POR_DEFECTO_S,
  SIN_LIMITE_DE_TIEMPO,
} from './tipos.js';

/**
 * Motor de una partida de MineHunt.
 *
 * Reglas implementadas:
 * - Un clic normal revela UNICAMENTE la celda clicada, sea mina, numero o
 *   celda vacia. No hay cascada automatica.
 * - El onda expansiva si la provoca: gastandolo, una celda vacia
 *   arrastra a todas las celdas vacias conectadas y a su borde numerado. El
 *   jugador decide cuando le compensa, y la onda entra en recarga al usarlo.
 * - Quien encuentra mina SIGUE jugando: el turno solo pasa al siguiente cuando
 *   el clic no da mina. Una buena racha se premia encadenando clics.
 * - Si la partida tiene limite de tiempo por turno, quien se queda pensando
 *   demasiado pierde el turno sin haber jugado.
 * - La partida termina cuando se encuentran TODAS las minas. No hay final
 *   anticipado: mientras quede una mina, sigue habiendo partida.
 * - Un jugador puede rendirse: sale del juego, deja de recibir turnos y ya no
 *   puede ganar, aunque puede seguir mirando. Si solo queda uno sin rendirse,
 *   la partida acaba y ese es el ganador, tenga las minas que tenga.
 * - Gana quien mas minas haya encontrado; si hay varios en cabeza, es empate.
 */
export class MotorJuego {
  private readonly tablero: Tablero;
  private readonly marcador: number[];
  private readonly aleatorio: () => number;
  private readonly ahora: () => number;
  private readonly recargaOndaMs: number;
  /** Milisegundos por turno; 0 si la partida no aprieta el reloj. */
  private readonly tiempoPorTurnoMs: number;
  /** Onda armada y pendiente de gastarse, por jugador. */
  private readonly ondaArmada: boolean[];
  /** Instante en el que cada jugador recupera su onda; null si lo tiene. */
  private readonly recargaHasta: (number | null)[];
  /** Quien se ha rendido y ya no juega. */
  private readonly rendidos: boolean[];
  private turnoActual = 0;
  private minasEncontradas = 0;
  private partidaTerminada = false;
  /** Instante en el que empezo a correr el turno en curso. */
  private inicioDelTurno: number;

  private constructor(
    ancho: number,
    alto: number,
    minas: number,
    numJugadores: number,
    opciones: OpcionesPartida,
  ) {
    this.tablero = new Tablero(ancho, alto, minas);
    this.marcador = new Array<number>(numJugadores).fill(0);
    this.ondaArmada = new Array<boolean>(numJugadores).fill(false);
    this.rendidos = new Array<boolean>(numJugadores).fill(false);
    this.recargaHasta = new Array<number | null>(numJugadores).fill(null);
    this.aleatorio = opciones.aleatorio ?? Math.random;
    this.ahora = opciones.ahora ?? Date.now;
    this.recargaOndaMs =
      (opciones.recargaOndaSegundos ?? RECARGA_ONDA_POR_DEFECTO_S) * 1000;
    this.tiempoPorTurnoMs =
      Math.max(0, opciones.tiempoPorTurnoSegundos ?? SIN_LIMITE_DE_TIEMPO) * 1000;
    // El reloj del primer turno arranca al crear la partida, no al primer clic:
    // mirar el tablero sin decidirte tambien consume tu tiempo.
    this.inicioDelTurno = this.ahora();
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
    const usaOnda = this.ondaArmada[jugador] === true;
    let celdasReveladas: Coordenada[];
    let codigo: ResultadoClic['codigo'];

    if (this.tablero.tieneMina(x, y)) {
      celdasReveladas = this.tablero.marcarMinaEncontrada(x, y, jugador);
      this.marcador[jugador] = (this.marcador[jugador] as number) + 1;
      this.minasEncontradas += 1;
      codigo = 'MINA_ENCONTRADA';
    } else if (usaOnda) {
      // El onda expansiva: la unica via por la que se propaga la cascada.
      celdasReveladas = this.tablero.despejarEnCascada(x, y);
      codigo = 'ONDA_EXPANSIVA';
    } else {
      celdasReveladas = this.tablero.revelarUna(x, y);
      codigo = 'CELDA_DESPEJADA';
    }

    // La onda se gasta con el clic aunque haya caido sobre una mina.
    if (usaOnda) {
      this.ondaArmada[jugador] = false;
      this.recargaHasta[jugador] = this.ahora() + this.recargaOndaMs;
    }

    // Quien encuentra mina repite; quien no, cede el turno. En ambos casos el
    // reloj del turno vuelve a empezar.
    const repite = codigo === 'MINA_ENCONTRADA';
    if (repite) {
      this.inicioDelTurno = this.ahora();
    } else {
      this.pasarTurno();
    }
    this.actualizarFinDePartida();

    return {
      codigo,
      jugador,
      celdasReveladas,
      minasEncontradasPorElJugador: this.marcador[jugador] as number,
      ondaUsada: usaOnda,
      turnoDe: this.turnoActual,
      repite,
      terminada: this.partidaTerminada,
    };
  }

  /**
   * Milisegundos que le quedan al jugador de turno, o null si esta partida no
   * tiene limite de tiempo (o ya termino). Nunca baja de 0.
   */
  tiempoRestanteDeTurnoMs(): number | null {
    if (this.tiempoPorTurnoMs === SIN_LIMITE_DE_TIEMPO || this.partidaTerminada) {
      return null;
    }
    const transcurrido = this.ahora() - this.inicioDelTurno;
    return Math.max(0, this.tiempoPorTurnoMs - transcurrido);
  }

  /**
   * Pasa el turno si al jugador se le agoto el tiempo. Devuelve true solo si
   * el turno cambio de manos.
   *
   * El motor no tiene temporizadores propios: quien lo usa (el cliente hoy, el
   * servidor en la Fase 6) llama a esto cada poco. Asi el motor sigue siendo
   * codigo puro sin relojes escondidos, y la unica fuente de tiempo es el
   * reloj inyectado.
   *
   * La onda que estuviera armada NO se pierde: no se llego a gastar, asi que
   * sigue armada para el proximo turno de ese jugador.
   */
  comprobarTiempoDeTurno(): boolean {
    const restante = this.tiempoRestanteDeTurnoMs();
    if (restante === null || restante > 0) {
      return false;
    }

    this.pasarTurno();
    return true;
  }

  /**
   * Un jugador tira la toalla: sale del juego y se queda de espectador.
   *
   * No pierde lo que encontro, pero sus minas dejan de contar: ya no puede
   * ganar. Si al rendirse queda un unico jugador en pie, la partida se acaba y
   * ese ultimo gana, tenga el marcador que tenga.
   */
  rendirse(idJugador: number): void {
    if (this.partidaTerminada) {
      throw new ErrorPartida('PARTIDA_TERMINADA', 'La partida ya ha terminado');
    }
    if (!Number.isInteger(idJugador) || idJugador < 0 || idJugador >= this.marcador.length) {
      throw new ErrorPartida(
        'JUGADORES_INVALIDOS',
        `El jugador ${String(idJugador)} no existe en esta partida`,
      );
    }
    if (this.rendidos[idJugador] === true) {
      throw new ErrorPartida(
        'YA_RENDIDO',
        `El jugador ${String(idJugador)} ya se habia rendido`,
      );
    }

    this.rendidos[idJugador] = true;
    // Si tenia la onda armada la suelta: no va a llegar a gastarla.
    this.ondaArmada[idJugador] = false;

    const eraSuTurno = this.turnoActual === idJugador;
    this.actualizarFinDePartida();
    if (!this.partidaTerminada && eraSuTurno) {
      this.pasarTurno();
    }
  }

  /** Jugadores que siguen en la partida, en orden de id. */
  jugadoresActivos(): readonly number[] {
    return this.marcador
      .map((_marcador, id) => id)
      .filter((id) => this.rendidos[id] !== true);
  }

  /** true si ese jugador se rindio. */
  estaRendido(idJugador: number): boolean {
    return this.rendidos[idJugador] === true;
  }

  /**
   * Activa la onda del jugador al que le toca. No despeja nada por si solo:
   * se gasta en el siguiente clic de ese jugador.
   */
  activarOnda(): void {
    if (this.partidaTerminada) {
      throw new ErrorPartida('PARTIDA_TERMINADA', 'La partida ya ha terminado');
    }
    if (this.estadoDeLaOnda(this.turnoActual).estado !== 'disponible') {
      throw new ErrorPartida(
        'ONDA_NO_DISPONIBLE',
        `El jugador ${String(this.turnoActual)} no tiene la onda disponible`,
      );
    }
    this.ondaArmada[this.turnoActual] = true;
  }

  /** Se arrepiente: desactiva la onda sin gastarlo. */
  desactivarOnda(): void {
    this.ondaArmada[this.turnoActual] = false;
  }

  /** Estado de la onda de un jugador en este instante. */
  estadoDeLaOnda(idJugador: number): OndaJugador {
    if (this.ondaArmada[idJugador] === true) {
      return { estado: 'activo', recargaRestanteMs: 0 };
    }

    const hasta = this.recargaHasta[idJugador] ?? null;
    if (hasta !== null) {
      const restante = hasta - this.ahora();
      if (restante > 0) {
        return { estado: 'recargando', recargaRestanteMs: restante };
      }
    }

    return { estado: 'disponible', recargaRestanteMs: 0 };
  }

  /** Fotografia de la partida sin informacion oculta. */
  obtenerEstado(): EstadoPartida {
    const jugadores: Jugador[] = this.marcador.map((minasEncontradas, id) => ({
      id,
      minasEncontradas,
      onda: this.estadoDeLaOnda(id),
      rendido: this.rendidos[id] === true,
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
      tiempoPorTurnoMs: this.tiempoPorTurnoMs,
      tiempoRestanteMs: this.tiempoRestanteDeTurnoMs(),
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
   *
   * Devuelve null si la partida sigue en curso o si termino en empate. Quien
   * se rindio no puede ganar aunque tuviera el mejor marcador; y si la partida
   * acabo por quedarse uno solo en pie, gana ese sin mirar el marcador.
   */
  obtenerGanador(): number | null {
    if (!this.partidaTerminada) {
      return null;
    }

    const activos = this.jugadoresActivos();
    if (activos.length === 0) {
      return null;
    }
    if (activos.length === 1) {
      return activos[0] as number;
    }

    const puntuaciones = activos.map((id) => this.marcador[id] as number);
    const maximo = Math.max(...puntuaciones);
    const lideres = activos.filter((id) => this.marcador[id] === maximo);
    return lideres.length === 1 ? (lideres[0] as number) : null;
  }

  /** Clasificacion ordenada de mas a menos minas encontradas. */
  obtenerClasificacion(): readonly Jugador[] {
    return this.marcador
      .map((minasEncontradas, id) => ({
        id,
        minasEncontradas,
        onda: this.estadoDeLaOnda(id),
        rendido: this.rendidos[id] === true,
      }))
      .sort((a, b) => b.minasEncontradas - a.minasEncontradas);
  }

  /**
   * Pasa el turno al siguiente jugador que siga en pie, saltandose a los que
   * se rindieron, y reinicia el reloj del turno.
   */
  private pasarTurno(): void {
    const total = this.marcador.length;
    for (let paso = 1; paso <= total; paso += 1) {
      const candidato = (this.turnoActual + paso) % total;
      if (this.rendidos[candidato] !== true) {
        this.turnoActual = candidato;
        break;
      }
    }
    this.inicioDelTurno = this.ahora();
  }

  private minasRestantes(): number {
    return this.tablero.totalMinas - this.minasEncontradas;
  }

  /**
   * Da la partida por terminada al encontrarse la ultima mina, o cuando solo
   * queda un jugador sin rendirse.
   *
   * No hay final anticipado por marcador: aunque el lider saque una ventaja
   * imposible de remontar, la partida sigue hasta destapar la ultima mina. Se
   * probo lo contrario y cortaba partidas que el jugador queria terminar; para
   * salir antes esta rendirse.
   */
  private actualizarFinDePartida(): void {
    if (this.minasRestantes() === 0 || this.jugadoresActivos().length <= 1) {
      this.partidaTerminada = true;
    }
  }
}
