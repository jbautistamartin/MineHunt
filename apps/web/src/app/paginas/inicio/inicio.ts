import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { Intro } from '../../componentes/intro/intro';
import { SelectorIdioma } from '../../componentes/selector-idioma/selector-idioma';
import { ServicioHistoria } from '../../nucleo/historia.servicio';
import { ServicioIntro } from '../../nucleo/intro.servicio';
import { ServicioSonido } from '../../nucleo/sonido.servicio';
import { ServicioVibracion } from '../../nucleo/vibracion.servicio';
import { VERSION_APP } from '../../nucleo/version';

/**
 * Menu principal: la primera pantalla del juego.
 *
 * Es lo unico que decide el jugador antes de nada — a que quiere jugar — asi
 * que ensena los modos y nada mas. La configuracion del Entrenamiento, que
 * antes ocupaba esta ruta, cuelga ahora de su propia entrada del menu.
 *
 * Aqui viven tambien las cosas que valen para todo el juego y no para una
 * partida concreta: el idioma y los interruptores del sonido y la vibracion.
 * El de la vibracion solo sale donde hay algo que vibrar —en el escritorio
 * seria un interruptor que no hace nada—. Y es donde se ve la
 * presentacion del arranque, una sola vez por sesion.
 */
@Component({
  selector: 'mh-inicio',
  imports: [TranslatePipe, RouterLink, Intro, SelectorIdioma],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Inicio {
  private readonly historia = inject(ServicioHistoria);
  private readonly sonido = inject(ServicioSonido);
  private readonly vibracion = inject(ServicioVibracion);
  private readonly intro = inject(ServicioIntro);

  /**
   * La presentacion del arranque, solo la primera vez que se abre el menu.
   *
   * Entre partida y partida se vuelve aqui, y verla cada vez seria un peaje.
   */
  readonly mostrandoIntro = signal(this.intro.pendiente());

  /** El sonido se enciende y se apaga aqui, como el idioma. */
  readonly sonidoActivo = this.sonido.activo;

  /** Y la vibracion igual, cuando el aparato tiene con que vibrar. */
  readonly vibracionActiva = this.vibracion.activa;
  readonly hayVibracion = this.vibracion.disponibleEnElAparato;

  /** Progreso del Modo Historia, que se resume bajo su entrada del menu. */
  readonly nivelesSuperados = this.historia.totalSuperados;
  readonly totalNiveles = this.historia.totalNiveles;

  readonly version = VERSION_APP;

  introTerminada(): void {
    this.mostrandoIntro.set(false);
  }

  alternarSonido(): void {
    this.sonido.alternar();
  }

  alternarVibracion(): void {
    this.vibracion.alternar();
  }
}
