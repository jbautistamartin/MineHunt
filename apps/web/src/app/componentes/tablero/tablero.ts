import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { CeldaVisible, Coordenada, EstadoPartida } from '@minehunt/game-engine';

/**
 * Rejilla de juego.
 *
 * Solo pinta: no conoce las reglas ni toca el motor. Avisa hacia arriba de la
 * celda pulsada y la pantalla decide que hacer, para poder reutilizarlo tal
 * cual en el Modo Historia y en el multijugador online (Fase 7).
 */
@Component({
  selector: 'mh-tablero',
  imports: [NgClass],
  templateUrl: './tablero.html',
  styleUrl: './tablero.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Tablero {
  readonly estado = input.required<EstadoPartida>();
  /** Bloquea el tablero cuando la partida termina. */
  readonly bloqueado = input(false);

  readonly celdaPulsada = output<Coordenada>();

  readonly filas = computed(() => this.estado().celdas);

  /** Una columna por celda de ancho, todas del mismo lado. */
  readonly columnas = computed(
    () => `repeat(${String(this.estado().ancho)}, var(--lado-celda))`,
  );

  pulsar(celda: CeldaVisible): void {
    if (this.bloqueado() || celda.estado !== 'oculta') {
      return;
    }
    this.celdaPulsada.emit({ x: celda.x, y: celda.y });
  }

  /**
   * Clases de una celda: su estado, el color del numero y, si esconde una mina
   * ya encontrada, el color del jugador que se la apunto.
   */
  clasesDe(celda: CeldaVisible): Record<string, boolean> {
    return {
      oculta: celda.estado === 'oculta',
      despejada: celda.estado === 'despejada',
      mina: celda.estado === 'mina-encontrada',
      [`n${String(celda.minasAdyacentes ?? 0)}`]:
        celda.estado === 'despejada' && (celda.minasAdyacentes ?? 0) > 0,
      [`jugador-${String(celda.encontradaPor ?? 0)}`]: celda.encontradaPor !== null,
    };
  }

  /** Texto de la celda: el numero de minas alrededor, o nada si es 0. */
  textoDe(celda: CeldaVisible): string {
    if (celda.estado !== 'despejada') {
      return '';
    }
    return celda.minasAdyacentes !== null && celda.minasAdyacentes > 0
      ? String(celda.minasAdyacentes)
      : '';
  }

  /** Identidad estable de cada celda para que Angular no rehaga la rejilla entera. */
  clave(_indice: number, celda: CeldaVisible): string {
    return `${String(celda.x)},${String(celda.y)}`;
  }
}
