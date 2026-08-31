import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { ServicioIdioma, type Idioma } from '../../nucleo/idioma.servicio';

/**
 * Selector manual de idioma.
 *
 * Sobreescribe el idioma detectado del dispositivo y la eleccion se recuerda
 * entre sesiones.
 */
@Component({
  selector: 'mh-selector-idioma',
  imports: [TranslatePipe],
  templateUrl: './selector-idioma.html',
  styleUrl: './selector-idioma.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectorIdioma {
  private readonly servicioIdioma = inject(ServicioIdioma);

  readonly idiomas = this.servicioIdioma.idiomasDisponibles;
  readonly idiomaActual = this.servicioIdioma.idiomaActual;

  seleccionar(idioma: Idioma): void {
    this.servicioIdioma.cambiarIdioma(idioma);
  }
}
