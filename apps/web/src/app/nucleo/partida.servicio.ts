import { Injectable, computed, signal } from '@angular/core';
import {
  ErrorPartida,
  JugadorIA,
  MotorJuego,
  type CodigoError,
  type CodigoResultadoClic,
  type EstadoPartida,
  type NivelIA,
} from '@minehunt/game-engine';

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
  readonly nivelIA: NivelIA;
  /** Pausa entre turnos de bots, solo se aplica si no juega ningun humano. */
  readonly retardoBotsMs: number;
}

/** Ultimo suceso de la partida, en forma de codigo mas datos sin traducir. */
export interface UltimoSuceso {
  readonly codigo: CodigoResultadoClic;
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
 * JugadorIA y la aplica sola.
 */
@Injectable({ providedIn: 'root' })
export class ServicioPartida {
  private motor: MotorJuego | null = null;
  private bot: JugadorIA | null = null;
  private temporizador: ReturnType<typeof setTimeout> | null = null;

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

  /** Crea una partida nueva con la configuracion dada. */
  iniciar(configuracion: ConfiguracionPartida): void {
    this.cancelarTurnoDeBot();
    this.motor = MotorJuego.crearPartida(
      configuracion.ancho,
      configuracion.alto,
      configuracion.minas,
      configuracion.numJugadores,
    );
    this.bot =
      configuracion.numHumanos < configuracion.numJugadores
        ? new JugadorIA(configuracion.nivelIA)
        : null;
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

  /** Descarta la partida en curso. */
  abandonar(): void {
    this.cancelarTurnoDeBot();
    this.motor = null;
    this.bot = null;
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

  /**
   * Juega el turno del bot ahora mismo, sin esperar al temporizador.
   * Es lo que usan las pruebas para no depender de relojes.
   */
  jugarTurnoDeBot(): boolean {
    const estado = this.estadoInterno();
    if (estado === null || estado.terminada || this.bot === null || !this.esBot(estado.turnoDe)) {
      return false;
    }

    const decision = this.bot.elegirJugada(estado);
    return this.aplicarClic(decision.celda.x, decision.celda.y);
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
   * Encadena el turno del bot. Solo se hace esperar cuando no juega ningun
   * humano; con alguien mirando la partida ya tiene su propio ritmo.
   */
  private programarTurnoDeBot(): void {
    this.cancelarTurnoDeBot();
    if (!this.esTurnoDeBot()) {
      return;
    }

    const configuracion = this.configuracionInterna();
    const retardo = configuracion !== null && configuracion.numHumanos === 0
      ? configuracion.retardoBotsMs
      : 0;

    this.temporizador = setTimeout(() => {
      this.temporizador = null;
      if (this.jugarTurnoDeBot()) {
        this.programarTurnoDeBot();
      }
    }, retardo);
  }

  private cancelarTurnoDeBot(): void {
    if (this.temporizador !== null) {
      clearTimeout(this.temporizador);
      this.temporizador = null;
    }
  }

  private refrescar(): void {
    this.estadoInterno.set(this.motor?.obtenerEstado() ?? null);
  }
}
