import { Injectable, computed, signal } from '@angular/core';
import {
  ErrorPartida,
  MotorJuego,
  type CodigoError,
  type CodigoResultadoClic,
  type EstadoPartida,
} from '@minehunt/game-engine';

/** Ajustes con los que se crea una partida de entrenamiento. */
export interface ConfiguracionPartida {
  readonly ancho: number;
  readonly alto: number;
  readonly minas: number;
  readonly numJugadores: number;
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
 * mecanismo servira para los eventos que llegue del servidor en la Fase 7.
 */
@Injectable({ providedIn: 'root' })
export class ServicioPartida {
  private motor: MotorJuego | null = null;

  private readonly estadoInterno = signal<EstadoPartida | null>(null);
  private readonly configuracionInterna = signal<ConfiguracionPartida | null>(null);
  private readonly sucesoInterno = signal<UltimoSuceso | null>(null);
  private readonly errorInterno = signal<CodigoError | null>(null);

  readonly estado = this.estadoInterno.asReadonly();
  readonly configuracion = this.configuracionInterna.asReadonly();
  readonly ultimoSuceso = this.sucesoInterno.asReadonly();
  readonly ultimoError = this.errorInterno.asReadonly();

  readonly hayPartida = computed(() => this.estadoInterno() !== null);

  /** Crea una partida nueva con la configuracion dada. */
  iniciar(configuracion: ConfiguracionPartida): void {
    this.motor = MotorJuego.crearPartida(
      configuracion.ancho,
      configuracion.alto,
      configuracion.minas,
      configuracion.numJugadores,
    );
    this.configuracionInterna.set(configuracion);
    this.sucesoInterno.set(null);
    this.errorInterno.set(null);
    this.refrescar();
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
    this.motor = null;
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

  private refrescar(): void {
    this.estadoInterno.set(this.motor?.obtenerEstado() ?? null);
  }
}
