import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { ServicioIntro } from '../../nucleo/intro.servicio';

/**
 * Lo que dura la presentacion antes de apartarse sola.
 *
 * En el telefono se quedaba corta: entre la pantalla de arranque nativa y lo
 * que tarda el WebView en pintar, apenas daba tiempo a verla. Tres segundos y
 * medio se ven sin que lleguen a hacerse largos, y quien tenga prisa la salta
 * tocando la pantalla.
 */
const DURACION_MS = 3400;

/**
 * La presentacion del arranque: el icono, el nombre y a jugar.
 *
 * En el menu sale una sola vez por sesion, la primera que se abre, y se aparta
 * sola. **Se puede saltar tocando la pantalla**, que es lo que hace la
 * diferencia entre una presentacion y un estorbo: quien abre el juego por
 * decima vez no quiere verla entera.
 *
 * El «Acerca de» la ensena **cada vez que se entra**: alli no es el peaje de
 * llegar al juego sino la mitad de lo que se va a ver, que es justo lo que se
 * fue a buscar. Por eso lleva `anotaLaSesion` a false y no gasta el turno del
 * menu.
 *
 * En Android va detras de la pantalla de arranque nativa de Capacitor, que
 * tapa el hueco hasta que el WebView tiene algo que pintar; esta es la que da
 * continuidad entre aquella y el menu.
 *
 * No suena: los navegadores no dejan reproducir audio antes de que el jugador
 * toque nada, y esto ocurre justo antes de ese primer toque.
 */
@Component({
  selector: 'mh-intro',
  imports: [TranslatePipe],
  templateUrl: './intro.html',
  styleUrl: './intro.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(click)': 'terminar()',
    '(keydown)': 'terminar()',
  },
})
export class Intro {
  private readonly intro = inject(ServicioIntro);

  /**
   * Si verla aqui cuenta como haberla visto en esta sesion.
   *
   * El menu la ensena una sola vez y necesita apuntarlo. El «Acerca de» la
   * ensena siempre —es su carta de presentacion, y es a lo que se entra a
   * mirar— y por eso no debe gastar el turno del menu: quien recargue estando
   * en esa pantalla tiene que ver la presentacion igual al volver al menu.
   */
  readonly anotaLaSesion = input(true);

  /** Avisa de que ya se puede ver el menu. */
  readonly terminada = output<void>();

  constructor() {
    setTimeout(() => {
      this.terminar();
    }, DURACION_MS);
  }

  terminar(): void {
    if (this.anotaLaSesion()) {
      this.intro.marcarVista();
    }
    this.terminada.emit();
  }
}
