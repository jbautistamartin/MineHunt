import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MAX_JUGADORES, MIN_JUGADORES } from '@minehunt/game-engine';
import { TranslatePipe } from '@ngx-translate/core';

import { SelectorIdioma } from '../../componentes/selector-idioma/selector-idioma';
import { ServicioPartida } from '../../nucleo/partida.servicio';

/** Limites del tablero, para que la partida sea jugable en un movil. */
const LADO_MINIMO = 3;
const LADO_MAXIMO = 30;

/** Proporcion de minas con la que se propone un tablero nuevo. */
const DENSIDAD_SUGERIDA = 0.18;

/**
 * Pantalla de configuracion del Modo Entrenamiento.
 *
 * Fase 1: solo jugadores humanos en el mismo dispositivo. Los bots y su nivel
 * de inteligencia se anaden aqui mismo en la Fase 2.
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

  readonly ancho = signal(9);
  readonly alto = signal(9);
  readonly minas = signal(15);
  readonly numJugadores = signal(2);

  /** Opciones del selector de jugadores: 2, 3 y 4. */
  readonly opcionesJugadores = Array.from(
    { length: MAX_JUGADORES - MIN_JUGADORES + 1 },
    (_valor, indice) => MIN_JUGADORES + indice,
  );

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

  cambiarJugadores(valor: number): void {
    this.numJugadores.set(valor);
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
