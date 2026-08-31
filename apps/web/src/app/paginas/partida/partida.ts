import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { Coordenada } from '@minehunt/game-engine';
import { TranslatePipe } from '@ngx-translate/core';

import { Tablero } from '../../componentes/tablero/tablero';
import { ServicioPartida } from '../../nucleo/partida.servicio';

/**
 * Pantalla de juego del Modo Entrenamiento.
 *
 * Todos los jugadores comparten dispositivo y el turno va rotando (hotseat).
 * El tablero se reutilizara tal cual en el Modo Historia y en el multijugador.
 */
@Component({
  selector: 'mh-partida',
  imports: [TranslatePipe, Tablero],
  templateUrl: './partida.html',
  styleUrl: './partida.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Partida {
  private readonly servicio = inject(ServicioPartida);
  private readonly router = inject(Router);

  readonly estado = this.servicio.estado;
  readonly ultimoSuceso = this.servicio.ultimoSuceso;
  readonly ultimoError = this.servicio.ultimoError;

  readonly terminada = computed(() => this.estado()?.terminada ?? false);

  /** Clasificacion ordenada para el marcador de fin de partida. */
  readonly clasificacion = computed(() =>
    [...(this.estado()?.jugadores ?? [])].sort(
      (a, b) => b.minasEncontradas - a.minasEncontradas,
    ),
  );

  constructor() {
    // Si se entra a /partida sin partida en curso (recarga o enlace directo),
    // se vuelve a la configuracion en lugar de mostrar una pantalla vacia.
    effect(() => {
      if (!this.servicio.hayPartida()) {
        void this.router.navigate(['/']);
      }
    });
  }

  jugar(coordenada: Coordenada): void {
    this.servicio.clicEnCelda(coordenada.x, coordenada.y);
  }

  revancha(): void {
    this.servicio.revancha();
  }

  abandonar(): void {
    this.servicio.abandonar();
    void this.router.navigate(['/']);
  }

  /** Los jugadores se numeran desde 1 de cara al jugador. */
  numeroDe(idJugador: number): number {
    return idJugador + 1;
  }
}
