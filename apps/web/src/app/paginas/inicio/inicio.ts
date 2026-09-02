import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { SelectorIdioma } from '../../componentes/selector-idioma/selector-idioma';
import { ServicioHistoria } from '../../nucleo/historia.servicio';
import { VERSION_APP } from '../../nucleo/version';

/**
 * Menu principal: la primera pantalla del juego.
 *
 * Es lo unico que decide el jugador antes de nada — a que quiere jugar — asi
 * que ensena los modos y nada mas. La configuracion del Entrenamiento, que
 * antes ocupaba esta ruta, cuelga ahora de su propia entrada del menu; el
 * Multijugador Online se ensena apagado hasta la Fase 7, para que se vea que
 * el modo existe y esta por llegar.
 */
@Component({
  selector: 'mh-inicio',
  imports: [TranslatePipe, RouterLink, SelectorIdioma],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Inicio {
  private readonly historia = inject(ServicioHistoria);

  /** Progreso del Modo Historia, que se resume bajo su entrada del menu. */
  readonly nivelesSuperados = this.historia.totalSuperados;
  readonly totalNiveles = this.historia.totalNiveles;

  readonly version = VERSION_APP;
}
