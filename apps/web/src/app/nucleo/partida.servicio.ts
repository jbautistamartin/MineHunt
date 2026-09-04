import { Injectable, computed, signal } from '@angular/core';
import {
  ErrorPartida,
  JugadorIA,
  MotorJuego,
  type CodigoError,
  type CodigoSuceso,
  type EstadoPartida,
  type NivelIA,
} from '@minehunt/game-engine';

/** Cada cuanto se relee el estado para mover las cuentas atras. */
const LATIDO_MS = 250;

/**
 * Lo que tarda un bot en jugar su turno, en milisegundos.
 *
 * Es un tiempo al azar dentro de este rango, distinto en cada turno: jugando
 * al instante los bots resultaban desconcertantes, porque el tablero cambiaba
 * antes de que te diera tiempo a ver de quien era el turno. Vale tanto con
 * humanos en la mesa como en las partidas de solo bots, que antes llevaban una
 * pausa fija configurable.
 */
const RETARDO_BOT_MINIMO_MS = 0;
const RETARDO_BOT_MAXIMO_MS = 2000;

/** Ajustes con los que se crea una partida de entrenamiento. */
export interface ConfiguracionPartida {
  readonly ancho: number;
  readonly alto: number;
  readonly minas: number;
  readonly numJugadores: number;
  /**
   * Cuantos de los jugadores son humanos, de 0 a numJugadores.
   * Los primeros ids son los humanos y el resto los controla la IA.
   */
  readonly numHumanos: number;
  /**
   * Nivel de cada bot, en orden de asiento: nivelesIA[0] es el primer bot, que
   * ocupa el puesto numHumanos. Cada uno lleva el suyo, asi que se puede
   * enfrentar un nivel 1 contra un nivel 5 y ver la diferencia jugando.
   */
  readonly nivelesIA: readonly NivelIA[];
  /** Segundos que tarda en recargarse la onda expansiva. */
  readonly recargaOndaSegundos: number;
  /** Segundos por turno antes de perderlo; 0 deja la partida sin reloj. */
  readonly tiempoPorTurnoSegundos: number;
}

/** Ultimo suceso de la partida, en forma de codigo mas datos sin traducir. */
export interface UltimoSuceso {
  readonly codigo: CodigoSuceso;
  readonly jugador: number;
  readonly celdas: number;
}

/**
 * Guarda la partida en curso del Modo Entrenamiento.
 *
 * Envuelve al motor y publica su estado como senal para que las pantallas se
 * repinten solas. Los sucesos se guardan como codigo, nunca como texto ya
 * traducido: asi la interfaz los muestra en el idioma activo y el mismo
 * mecanismo servira para los eventos que lleguen del servidor en la Fase 7.
 *
 * Tambien lleva el turno de los bots: cuando toca a uno, le pide la jugada a
 * su JugadorIA y la aplica sola. Cada bot tiene su propia instancia, porque
 * cada uno puede jugar a un nivel distinto.
 */
@Injectable({ providedIn: 'root' })
export class ServicioPartida {
  private motor: MotorJuego | null = null;
  /** Un JugadorIA por bot, indexado por id de jugador. */
  private readonly bots = new Map<number, JugadorIA>();
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  /** Refresco periodico mientras haya cuentas atras que mover. */
  private latido: ReturnType<typeof setInterval> | null = null;

  private readonly estadoInterno = signal<EstadoPartida | null>(null);
  private readonly configuracionInterna = signal<ConfiguracionPartida | null>(null);
  private readonly sucesoInterno = signal<UltimoSuceso | null>(null);
  private readonly errorInterno = signal<CodigoError | null>(null);

  readonly estado = this.estadoInterno.asReadonly();
  readonly configuracion = this.configuracionInterna.asReadonly();
  readonly ultimoSuceso = this.sucesoInterno.asReadonly();
  readonly ultimoError = this.errorInterno.asReadonly();

  readonly hayPartida = computed(() => this.estadoInterno() !== null);

  /** Le toca a un bot: la interfaz bloquea el tablero mientras tanto. */
  readonly esTurnoDeBot = computed(() => {
    const estado = this.estadoInterno();
    return estado !== null && !estado.terminada && this.esBot(estado.turnoDe);
  });

  /** Onda del jugador al que le toca, que es el unico que puede gastarla. */
  readonly ondaDelTurno = computed(() => {
    const estado = this.estadoInterno();
    if (estado === null) {
      return null;
    }
    return estado.jugadores[estado.turnoDe]?.onda ?? null;
  });

  /** Segundos que faltan para recuperar la onda, redondeados hacia arriba. */
  readonly segundosDeRecarga = computed(() =>
    Math.ceil((this.ondaDelTurno()?.recargaRestanteMs ?? 0) / 1000),
  );

  /** Segundos que le quedan al turno; null si la partida no tiene reloj. */
  readonly segundosDeTurno = computed(() => {
    const restante = this.estadoInterno()?.tiempoRestanteMs ?? null;
    return restante === null ? null : Math.ceil(restante / 1000);
  });

  /** Jugadores que siguen jugando: los que no se han rendido. */
  readonly jugadoresActivos = computed(() =>
    (this.estadoInterno()?.jugadores ?? []).filter((jugador) => !jugador.rendido),
  );

  /**
   * Ya no queda ningun humano jugando, pero la partida sigue entre bots.
   * Es el estado de espectador: se ve el tablero, no se toca.
   */
  readonly soloMiran = computed(() => {
    const estado = this.estadoInterno();
    const configuracion = this.configuracionInterna();
    if (estado === null || configuracion === null || configuracion.numHumanos === 0) {
      return false;
    }
    return !estado.terminada && this.jugadoresActivos().every((jugador) => this.esBot(jugador.id));
  });

  /**
   * Humano que puede tirar la toalla ahora mismo, o null si no hay ninguno.
   *
   * Normalmente es quien tiene el turno. Con un unico humano en la mesa es el
   * siempre, tambien mientras juega un bot: si no, una racha larga del rival
   * lo dejaria sin poder rendirse justo cuando mas ganas tiene. Con varios
   * humanos hay que esperar al turno propio, porque rendir al que no toca
   * seria rendir a otra persona.
   */
  readonly humanoQuePuedeRendirse = computed(() => {
    const estado = this.estadoInterno();
    const configuracion = this.configuracionInterna();
    if (estado === null || configuracion === null || estado.terminada) {
      return null;
    }
    if (!this.esBot(estado.turnoDe)) {
      return estado.turnoDe;
    }
    if (configuracion.numHumanos !== 1) {
      return null;
    }
    return estado.jugadores[0]?.rendido === true ? null : 0;
  });

  /** Parte del turno que queda, de 1 a 0, para pintar la barra. */
  readonly fraccionDeTurno = computed(() => {
    const estado = this.estadoInterno();
    if (estado === null || estado.tiempoRestanteMs === null || estado.tiempoPorTurnoMs === 0) {
      return null;
    }
    return estado.tiempoRestanteMs / estado.tiempoPorTurnoMs;
  });

  /** Crea una partida nueva con la configuracion dada. */
  iniciar(configuracion: ConfiguracionPartida): void {
    this.cancelarTurnoDeBot();
    this.motor = MotorJuego.crearPartida(
      configuracion.ancho,
      configuracion.alto,
      configuracion.minas,
      configuracion.numJugadores,
      {
        recargaOndaSegundos: configuracion.recargaOndaSegundos,
        tiempoPorTurnoSegundos: configuracion.tiempoPorTurnoSegundos,
      },
    );

    // Un bot por puesto no humano, cada uno con el nivel que se le asigno.
    this.bots.clear();
    for (let id = configuracion.numHumanos; id < configuracion.numJugadores; id += 1) {
      const nivel = configuracion.nivelesIA[id - configuracion.numHumanos];
      if (nivel !== undefined) {
        this.bots.set(id, new JugadorIA(nivel));
      }
    }

    this.configuracionInterna.set(configuracion);
    this.sucesoInterno.set(null);
    this.errorInterno.set(null);
    this.refrescar();
    this.programarTurnoDeBot();
  }

  /** Vuelve a jugar con los mismos ajustes y un tablero nuevo. */
  revancha(): void {
    const configuracion = this.configuracionInterna();
    if (configuracion !== null) {
      this.iniciar(configuracion);
    }
  }

  /**
   * Activa la onda expansiva del jugador humano al que le toca.
   * La onda no despeja nada por si sola: se gasta en el siguiente clic.
   */
  activarOnda(): boolean {
    if (this.motor === null) {
      return false;
    }
    try {
      this.motor.activarOnda();
      this.errorInterno.set(null);
      this.refrescar();
      return true;
    } catch (error) {
      this.errorInterno.set(error instanceof ErrorPartida ? error.codigo : null);
      return false;
    }
  }

  /**
   * El jugador tira la toalla: sale de la partida y se queda solo mirando. Si
   * con eso queda un unico jugador en pie, la partida se acaba y ese gana.
   *
   * Sin argumento se rinde `humanoQuePuedeRendirse()`, que es lo que hace el
   * boton. El id explicito rinde un puesto concreto, bots incluidos.
   */
  rendirse(idJugador: number | null = this.humanoQuePuedeRendirse()): boolean {
    const estado = this.estadoInterno();
    if (this.motor === null || estado === null) {
      return false;
    }
    if (idJugador === null) {
      // No hay a quien rendir: o la partida acabo, o le toca a otro humano.
      if (estado.terminada) {
        this.errorInterno.set('PARTIDA_TERMINADA');
      }
      return false;
    }

    const jugador = idJugador;
    try {
      this.motor.rendirse(jugador);
      this.sucesoInterno.set({ codigo: 'JUGADOR_RENDIDO', jugador, celdas: 0 });
      this.errorInterno.set(null);
      this.refrescar();
      this.programarTurnoDeBot();
      return true;
    } catch (error) {
      this.errorInterno.set(error instanceof ErrorPartida ? error.codigo : null);
      return false;
    }
  }

  /**
   * Clic que gasta la onda expansiva en esa misma celda, que es lo que hace el
   * boton derecho del raton.
   *
   * Si la onda no esta disponible **no se clica nada**: dejar caer el clic
   * normal gastaria el turno en una celda que el jugador eligio pensando en la
   * onda, y eso se siente como que el juego te la ha jugado.
   */
  clicConOnda(x: number, y: number): boolean {
    if (this.ondaDelTurno()?.estado !== 'activo' && !this.activarOnda()) {
      return false;
    }
    return this.clicEnCelda(x, y);
  }

  /** Se arrepiente antes de clicar: devuelve la onda sin gastarla. */
  desactivarOnda(): void {
    this.motor?.desactivarOnda();
    this.refrescar();
  }

  /** Descarta la partida en curso. */
  abandonar(): void {
    this.cancelarTurnoDeBot();
    this.detenerLatido();
    this.motor = null;
    this.bots.clear();
    this.estadoInterno.set(null);
    this.sucesoInterno.set(null);
    this.errorInterno.set(null);
  }

  /**
   * Clic del jugador de turno sobre una celda.
   * Devuelve false si el motor rechazo la jugada, dejando el motivo en
   * ultimoError para que la interfaz lo traduzca.
   */
  clicEnCelda(x: number, y: number): boolean {
    const aplicado = this.aplicarClic(x, y);
    if (aplicado) {
      this.programarTurnoDeBot();
    }
    return aplicado;
  }

  /** Indica si ese jugador lo controla la IA. */
  esBot(idJugador: number): boolean {
    const configuracion = this.configuracionInterna();
    return configuracion !== null && idJugador >= configuracion.numHumanos;
  }

  /** Nivel con el que juega ese bot, o null si el puesto es humano. */
  nivelDeBot(idJugador: number): NivelIA | null {
    return this.bots.get(idJugador)?.nivel ?? null;
  }

  /**
   * Juega el turno del bot ahora mismo, sin esperar al temporizador.
   * Es lo que usan las pruebas para no depender de relojes.
   */
  jugarTurnoDeBot(): boolean {
    const estado = this.estadoInterno();
    if (estado === null || estado.terminada) {
      return false;
    }
    const bot = this.bots.get(estado.turnoDe);
    if (bot === undefined) {
      return false;
    }

    const decision = bot.elegirJugada(estado);
    // La IA decide por su cuenta si le compensa gastar la onda.
    if (decision.usarOnda) {
      this.motor?.activarOnda();
    }
    return this.aplicarClic(decision.celda.x, decision.celda.y);
  }

  /**
   * Le pregunta al motor si al jugador de turno se le acabo el tiempo y, en
   * tal caso, le quita el turno. Devuelve true solo si cambio de manos.
   *
   * El motor no tiene temporizadores propios, asi que alguien tiene que
   * preguntarle: aqui lo hace el latido, y en la Fase 6 lo hara el servidor.
   */
  comprobarReloj(): boolean {
    const estado = this.estadoInterno();
    if (this.motor === null || estado === null) {
      return false;
    }

    const perdedor = estado.turnoDe;
    if (!this.motor.comprobarTiempoDeTurno()) {
      return false;
    }

    this.sucesoInterno.set({ codigo: 'TURNO_PERDIDO', jugador: perdedor, celdas: 0 });
    this.errorInterno.set(null);
    this.refrescar();
    this.programarTurnoDeBot();
    return true;
  }

  private aplicarClic(x: number, y: number): boolean {
    if (this.motor === null) {
      return false;
    }

    try {
      const resultado = this.motor.clicCelda(x, y);
      this.sucesoInterno.set({
        codigo: resultado.codigo,
        jugador: resultado.jugador,
        celdas: resultado.celdasReveladas.length,
      });
      this.errorInterno.set(null);
      this.refrescar();
      return true;
    } catch (error) {
      this.errorInterno.set(error instanceof ErrorPartida ? error.codigo : null);
      return false;
    }
  }

  /**
   * Encadena el turno del bot, haciendole esperar un poco antes de jugar.
   *
   * El retardo se sortea en cada turno, asi que dos bots seguidos no caen
   * nunca al mismo ritmo y la partida no parece un teletipo. Como ahora quien
   * acierta repite, un bot con racha encadena varios turnos, y cada uno de
   * ellos vuelve a esperar: se le ve pensar entre mina y mina.
   */
  private programarTurnoDeBot(): void {
    this.cancelarTurnoDeBot();
    if (!this.esTurnoDeBot()) {
      return;
    }

    this.temporizador = setTimeout(() => {
      this.temporizador = null;
      if (this.jugarTurnoDeBot()) {
        this.programarTurnoDeBot();
      }
    }, this.retardoDelBot());
  }

  /** Tiempo que se toma un bot antes de jugar, al azar dentro del rango. */
  private retardoDelBot(): number {
    const margen = RETARDO_BOT_MAXIMO_MS - RETARDO_BOT_MINIMO_MS;
    return Math.round(RETARDO_BOT_MINIMO_MS + Math.random() * margen);
  }

  private cancelarTurnoDeBot(): void {
    if (this.temporizador !== null) {
      clearTimeout(this.temporizador);
      this.temporizador = null;
    }
  }

  private refrescar(): void {
    this.estadoInterno.set(this.motor?.obtenerEstado() ?? null);
    this.ajustarLatido();
  }

  /**
   * Tanto la recarga de la onda como el reloj del turno corren con el tiempo y
   * no con las jugadas, asi que hay que releer el estado periodicamente para
   * que las cuentas atras bajen en pantalla y para preguntarle al motor si el
   * turno ya expiro. El latido solo vive mientras haya algo que contar.
   */
  private ajustarLatido(): void {
    const estado = this.estadoInterno();
    const hayQueContar =
      estado !== null &&
      !estado.terminada &&
      (estado.tiempoRestanteMs !== null ||
        estado.jugadores.some((jugador) => jugador.onda.estado === 'recargando'));

    if (hayQueContar && this.latido === null) {
      this.latido = setInterval(() => {
        // comprobarReloj ya refresca y reprograma si el turno cambia de manos.
        if (!this.comprobarReloj()) {
          this.estadoInterno.set(this.motor?.obtenerEstado() ?? null);
          this.ajustarLatido();
        }
      }, LATIDO_MS);
    } else if (!hayQueContar) {
      this.detenerLatido();
    }
  }

  private detenerLatido(): void {
    if (this.latido !== null) {
      clearInterval(this.latido);
      this.latido = null;
    }
  }
}
