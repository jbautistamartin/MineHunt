import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ServicioBotonAtras } from './nucleo/atras.servicio';
import { ServicioIdioma } from './nucleo/idioma.servicio';

/**
 * Componente raiz de MineHunt.
 *
 * Solo aloja el enrutador; cada pantalla se carga de forma diferida. Inyecta
 * el servicio de idioma para que quede activo desde el arranque, y engancha el
 * boton de atras del telefono, que en el navegador no hace nada.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  // Basta con inyectarlo: al construirse fija el idioma detectado o el guardado.
  protected readonly idioma = inject(ServicioIdioma);
  private readonly atras = inject(ServicioBotonAtras);

  constructor() {
    this.atras.escuchar();
  }
}
