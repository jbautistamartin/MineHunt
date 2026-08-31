import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MAX_JUGADORES, MIN_JUGADORES, NIVELES_IA, type NivelIA } from '@minehunt/game-engine';
import { TranslatePipe } from '@ngx-translate/core';

import { SelectorIdioma } from '../../componentes/selector-idioma/selector-idioma';
import { ServicioPartida } from '../../nucleo/partida.servicio';

/** Limites del tablero, para que la partida sea jugable en un movil. */
const LADO_MINIMO = 3;
const LADO_MAXIMO = 30;

/** Proporcion de minas con la que se propone un tablero nuevo. */
const DENSIDAD_SUGERIDA = 0.18;

/** Pausa por defecto entre turnos de bots cuando no juega ningun humano. */
const RETARDO_BOTS_POR_DEFECTO_MS = 600;
const RETARDO_MINIMO_MS = 0;
const RETARDO_MAXIMO_MS = 3000;

/**
 * Pantalla de configuracion del Modo Entrenamiento.
 *
 * De 2 a 4 jugadores, de los cuales 0 a 4 pueden ser humanos; el resto los
 * lleva la IA con el nivel que se elija. Con 0 humanos la partida se juega
 * sola y se puede espaciar con un retardo entre turnos.
 */
@Component({
  selector: 'mh-configuracion',
  imports: [TranslatePipe, SelectorIdioma],
  templateUrl: './configuracion.html',
  styleUrl: './configuracion.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Configuracion {
  private readonly partida = inject(ServicioPartida);
  private readonly router = inject(Router);

  readonly ladoMinimo = LADO_MINIMO;
  readonly ladoMaximo = LADO_MAXIMO;
  readonly minJugadores = MIN_JUGADORES;
  readonly maxJugadores = MAX_JUGADORES;

  readonly niveles = NIVELES_IA;
  readonly retardoMinimo = RETARDO_MINIMO_MS;
  readonly retardoMaximo = RETARDO_MAXIMO_MS;

  readonly ancho = signal(9);
  readonly alto = signal(9);
  readonly minas = signal(15);
  readonly numJugadores = signal(2);
  readonly numHumanos = signal(1);
  readonly nivelIA = signal<NivelIA>(3);
  readonly retardoBotsMs = signal(RETARDO_BOTS_POR_DEFECTO_MS);

  /** Opciones del selector de jugadores: 2, 3 y 4. */
  readonly opcionesJugadores = Array.from(
    { length: MAX_JUGADORES - MIN_JUGADORES + 1 },
    (_valor, indice) => MIN_JUGADORES + indice,
  );

  /** Opciones de humanos: de 0 al total de jugadores de la partida. */
  readonly opcionesHumanos = computed(() =>
    Array.from({ length: this.numJugadores() + 1 }, (_valor, indice) => indice),
  );

  readonly numBots = computed(() => this.numJugadores() - this.numHumanos());
  readonly hayBots = computed(() => this.numBots() > 0);
  /** Sin humanos la partida se juega sola: ahi si tiene sentido el retardo. */
  readonly soloBots = computed(() => this.numHumanos() === 0);

  readonly totalCeldas = computed(() => this.ancho() * this.alto());

  /** Como mucho una mina menos que celdas: la del primer clic queda libre. */
  readonly minasMaximas = computed(() => Math.max(1, this.totalCeldas() - 1));

  readonly densidad = computed(() =>
    Math.round((this.minas() / Math.max(1, this.totalCeldas())) * 100),
  );

  readonly dimensionesValidas = computed(
    () =>
      this.esLadoValido(this.ancho()) &&
      this.esLadoValido(this.alto()) &&
      this.totalCeldas() >= 2,
  );

  readonly minasValidas = computed(
    () =>
      Number.isInteger(this.minas()) &&
      this.minas() >= 1 &&
      this.minas() <= this.minasMaximas(),
  );

  readonly puedeEmpezar = computed(() => this.dimensionesValidas() && this.minasValidas());

  /** Al cambiar el tablero, ajusta las minas para que sigan cabiendo. */
  cambiarAncho(valor: string): void {
    this.ancho.set(this.aEntero(valor, this.ancho()));
    this.ajustarMinas();
  }

  cambiarAlto(valor: string): void {
    this.alto.set(this.aEntero(valor, this.alto()));
    this.ajustarMinas();
  }

  cambiarMinas(valor: string): void {
    this.minas.set(this.aEntero(valor, this.minas()));
  }

  /** Al cambiar el total de jugadores, los humanos no pueden pasarse. */
  cambiarJugadores(valor: number): void {
    this.numJugadores.set(valor);
    this.numHumanos.set(Math.min(this.numHumanos(), valor));
  }

  cambiarHumanos(valor: number): void {
    this.numHumanos.set(valor);
  }

  cambiarNivelIA(valor: NivelIA): void {
    this.nivelIA.set(valor);
  }

  cambiarRetardo(valor: string): void {
    const numero = this.aEntero(valor, this.retardoBotsMs());
    this.retardoBotsMs.set(Math.min(RETARDO_MAXIMO_MS, Math.max(RETARDO_MINIMO_MS, numero)));
  }

  empezar(): void {
    if (!this.puedeEmpezar()) {
      return;
    }
    this.partida.iniciar({
      ancho: this.ancho(),
      alto: this.alto(),
      minas: this.minas(),
      numJugadores: this.numJugadores(),
      numHumanos: this.numHumanos(),
      nivelIA: this.nivelIA(),
      retardoBotsMs: this.retardoBotsMs(),
    });
    void this.router.navigate(['/partida']);
  }

  private esLadoValido(lado: number): boolean {
    return Number.isInteger(lado) && lado >= LADO_MINIMO && lado <= LADO_MAXIMO;
  }

  /**
   * Recorta las minas al maximo que admite el tablero y, si el jugador no las
   * ha tocado, propone una cantidad proporcional al tamano.
   */
  private ajustarMinas(): void {
    if (!this.dimensionesValidas()) {
      return;
    }
    const sugeridas = Math.max(1, Math.round(this.totalCeldas() * DENSIDAD_SUGERIDA));
    this.minas.set(Math.min(sugeridas, this.minasMaximas()));
  }

  private aEntero(valor: string, porDefecto: number): number {
    const numero = Number.parseInt(valor, 10);
    return Number.isNaN(numero) ? porDefecto : numero;
  }
}
