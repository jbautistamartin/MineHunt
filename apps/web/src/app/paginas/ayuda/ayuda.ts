import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { VERSION_APP } from '../../nucleo/version';

/**
 * Secciones de la ayuda, en el orden en que se leen.
 *
 * Cada nombre se traduce en dos claves, `ayuda.<nombre>.titulo` y
 * `ayuda.<nombre>.texto`, en es.json y en.json. **Al cambiar una regla del
 * juego hay que actualizar aqui el texto que la explica**: esta pantalla es lo
 * unico que ve el jugador, y una regla mal contada se nota mas que un fallo.
 */
const SECCIONES = [
  'objetivo',
  'turnos',
  'reloj',
  'onda',
  'rendirse',
  'fin',
  'bots',
  'historia',
] as const;

/**
 * Pantalla de ayuda: las reglas del juego, en el idioma activo.
 *
 * No tiene estado ni habla con el motor. Se llega desde el menu principal y
 * solo desde ahi: nunca desde una partida en curso, porque el reloj del turno
 * sigue corriendo mientras se lee y se perderian turnos.
 */
@Component({
  selector: 'mh-ayuda',
  imports: [TranslatePipe, RouterLink],
  templateUrl: './ayuda.html',
  styleUrl: './ayuda.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Ayuda {
  readonly secciones = SECCIONES;
  readonly version = VERSION_APP;
}
