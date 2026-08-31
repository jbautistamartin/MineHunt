import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ServicioIdioma } from './nucleo/idioma.servicio';

/**
 * Componente raiz de MineHunt.
 *
 * Solo aloja el enrutador; cada pantalla se carga de forma diferida. Inyecta
 * el servicio de idioma para que quede activo desde el arranque.
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
}
