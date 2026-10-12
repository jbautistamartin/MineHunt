import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { Intro } from '../../componentes/intro/intro';
import { ServicioActualizacion } from '../../nucleo/actualizacion.servicio';
import { URL_DONATIVO } from '../../nucleo/donativo';
import { URL_PROYECTO } from '../../nucleo/proyecto';
import { VERSION_APP } from '../../nucleo/version';

/**
 * Acerca de: que es el juego, quien lo firma y que version es.
 *
 * **Aqui no se cuenta nada tecnico.** Esta pantalla la lee quien va a jugar, no
 * quien lo programa: ni con que esta hecho, ni como se llaman sus piezas, ni
 * dos numeros de version distintos. Un solo numero basta, y ademas vale para
 * todo: `VERSION_APP` y la del protocolo van a la par, asi que el numero que se
 * ensena aqui es tambien el que decide contra que servidores se puede jugar.
 *
 * **Se abre con la presentacion del arranque**, y aqui sale cada vez que se
 * entra, no una por sesion como en el menu: alli es lo que separa al jugador
 * de jugar, y aqui es parte de lo que se vino a ver. Se salta tocando la
 * pantalla, igual que la del menu, y no gasta el turno de aquella.
 */
@Component({
  selector: 'mh-acerca',
  imports: [TranslatePipe, RouterLink, Intro],
  templateUrl: './acerca.html',
  styleUrl: './acerca.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Acerca {
  private readonly actualizacion = inject(ServicioActualizacion);

  readonly version = VERSION_APP;

  /**
   * La version publicada, si hay una mas nueva que esta. La pregunta se hace al
   * arrancar el juego, no aqui: esta pantalla solo cuenta lo que ya se sepa.
   */
  readonly novedad = this.actualizacion.novedad;

  /**
   * La pagina del juego: de donde sale lo que hay instalado y donde se cuenta
   * un fallo. Sale aqui porque esta es la pantalla que dice que es esto y
   * quien lo firma, y de ahi cuelga tambien donde vive. Se abre fuera del
   * juego, como el donativo, y tampoco cuenta como una salida de la pantalla.
   */
  readonly urlProyecto = this.actualizacion.pagina;

  /**
   * El donativo. Es la unica pantalla del juego que lo menciona, y a proposito:
   * quien entra aqui viene a ver que es esto y quien lo hace, que es donde cabe
   * ofrecerlo. No sale en el menu, ni al terminar una partida, ni vuelve a
   * aparecer si no se pulsa.
   */
  readonly urlDonativo = URL_DONATIVO;

  /** La presentacion, delante de la pantalla hasta que se aparta o se salta. */
  readonly mostrandoIntro = signal(true);

  introTerminada(): void {
    this.mostrandoIntro.set(false);
  }
}
