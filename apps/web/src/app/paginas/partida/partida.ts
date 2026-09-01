import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { Coordenada } from '@minehunt/game-engine';
import { TranslatePipe } from '@ngx-translate/core';

import { Tablero } from '../../componentes/tablero/tablero';
import { ServicioPartida } from '../../nucleo/partida.servicio';

/** A partir de aqui la cuenta atras del turno se pinta en rojo. */
const SEGUNDOS_DE_AVISO = 5;

/**
 * Pantalla de juego del Modo Entrenamiento.
 *
 * Los humanos comparten dispositivo y el turno va rotando (hotseat); los
 * puestos que lleva la IA juegan solos. El tablero se reutilizara tal cual en
 * el Modo Historia y en el multijugador.
 */
@Component({
  selector: 'mh-partida',
  imports: [TranslatePipe, Tablero, RouterLink],
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
  readonly esTurnoDeBot = this.servicio.esTurnoDeBot;
  readonly ondaDelTurno = this.servicio.ondaDelTurno;
  readonly segundosDeRecarga = this.servicio.segundosDeRecarga;
  readonly segundosDeTurno = this.servicio.segundosDeTurno;
  readonly fraccionDeTurno = this.servicio.fraccionDeTurno;
  readonly soloMiran = this.servicio.soloMiran;

  /** Rendirse es irreversible, asi que se pide confirmacion. */
  readonly confirmandoRendicion = signal(false);

  /** Ultimos segundos del turno: la barra avisa cambiando de color. */
  readonly relojApurado = computed(() => {
    const segundos = this.segundosDeTurno();
    return segundos !== null && segundos <= SEGUNDOS_DE_AVISO;
  });

  /** Ancho de la barra del reloj, en porcentaje. */
  readonly porcentajeDeTurno = computed(() =>
    Math.round((this.fraccionDeTurno() ?? 0) * 100),
  );

  /** El boton de la onda solo tiene sentido en el turno de un humano. */
  readonly puedeManejarOnda = computed(
    () => !this.terminada() && !this.esTurnoDeBot() && this.ondaDelTurno() !== null,
  );

  /** Solo se puede rendir quien tiene el turno, y solo si es humano. */
  readonly puedeRendirse = computed(() => !this.terminada() && !this.esTurnoDeBot());

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

  /** Boton derecho: la onda expansiva se lanza sobre esa celda directamente. */
  jugarConOnda(coordenada: Coordenada): void {
    this.servicio.clicConOnda(coordenada.x, coordenada.y);
  }

  /** Primer paso: enseña la confirmacion en lugar de rendirse de golpe. */
  pedirRendicion(): void {
    this.confirmandoRendicion.set(true);
  }

  cancelarRendicion(): void {
    this.confirmandoRendicion.set(false);
  }

  confirmarRendicion(): void {
    this.confirmandoRendicion.set(false);
    this.servicio.rendirse();
  }

  /** Arma o desarma la onda expansiva antes de clicar. */
  alternarOnda(): void {
    if (this.ondaDelTurno()?.estado === 'activo') {
      this.servicio.desactivarOnda();
    } else {
      this.servicio.activarOnda();
    }
  }

  revancha(): void {
    this.confirmandoRendicion.set(false);
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

  esBot(idJugador: number): boolean {
    return this.servicio.esBot(idJugador);
  }

  /** Nivel del bot que ocupa ese puesto, o null si es humano. */
  nivelDeBot(idJugador: number): number | null {
    return this.servicio.nivelDeBot(idJugador);
  }

  /**
   * Segundos que le faltan a ese jugador para recuperar su onda.
   * Se muestra en el marcador para poder vigilar tambien la de los rivales.
   */
  segundosDeRecargaDe(recargaRestanteMs: number): number {
    return Math.ceil(recargaRestanteMs / 1000);
  }

  /**
   * Clave de traduccion del nombre de un jugador.
   * Los puestos de la IA se llaman "Bot" para distinguirlos de un vistazo.
   */
  claveNombre(idJugador: number): string {
    return this.servicio.esBot(idJugador) ? 'partida.bot' : 'partida.jugador';
  }
}
