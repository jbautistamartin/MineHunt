import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ServicioActualizacion } from './nucleo/actualizacion.servicio';
import { ServicioBotonAtras } from './nucleo/atras.servicio';
import { ServicioIdioma } from './nucleo/idioma.servicio';
import { ServicioSonido } from './nucleo/sonido.servicio';

/**
 * Componente raiz de MineHunt.
 *
 * Solo aloja el enrutador; cada pantalla se carga de forma diferida. Inyecta
 * el servicio de idioma para que quede activo desde el arranque, y engancha el
 * boton de atras del telefono, que en el navegador no hace nada.
 *
 * Aqui vive tambien el sonido de los botones. Se hace con un solo oyente en la
 * raiz y no boton a boton: son decenas de botones repartidos por seis
 * pantallas, y ponerselo a cada uno se olvidaria en el primero que se anadiera.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(click)': 'sonarSiEsBoton($event)' },
})
export class App {
  // Basta con inyectarlo: al construirse fija el idioma detectado o el guardado.
  protected readonly idioma = inject(ServicioIdioma);
  private readonly atras = inject(ServicioBotonAtras);
  private readonly sonido = inject(ServicioSonido);
  private readonly actualizacion = inject(ServicioActualizacion);

  constructor() {
    this.atras.escuchar();

    // Se pregunta por el ultimo release al arrancar, no al abrir «Acerca de»:
    // quien juega puede no entrar ahi nunca. El servicio se encarga de que sea
    // una vez al dia como mucho, y si no hay red no pasa nada — nadie se queda
    // esperando, porque esto no se espera: cuando conteste, el menu y «Acerca
    // de» ya estaran leyendo su señal.
    void this.actualizacion.comprobar();
  }

  /**
   * Suena el toque de un boton o un enlace del menu.
   *
   * Las celdas del tablero quedan fuera: ya suenan con lo que provoca la
   * jugada, y ese sonido dice ademas si salio mina.
   */
  protected sonarSiEsBoton(evento: Event): void {
    const objetivo = evento.target;
    if (!(objetivo instanceof Element)) {
      return;
    }

    const pulsable = objetivo.closest('button, a[href], [role="button"]');
    if (pulsable !== null && !pulsable.classList.contains('celda')) {
      this.sonido.clicDeInterfaz();
    }
  }
}
