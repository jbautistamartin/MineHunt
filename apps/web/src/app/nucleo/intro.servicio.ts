import { Injectable, signal } from '@angular/core';

/**
 * Si toca enseñar la animacion de arranque.
 *
 * Es un servicio y no una variable dentro del menu porque lo que decide es
 * «cuantas veces por sesion», no «cuantas veces por pantalla»: el jugador
 * vuelve al menu entre partida y partida, y volver a ver la presentacion cada
 * vez seria insoportable. Al ser `providedIn: 'root'` se construye una sola vez
 * por arranque de la aplicacion, que es exactamente la vida que tiene que tener
 * esta decision.
 */
@Injectable({ providedIn: 'root' })
export class ServicioIntro {
  private readonly pendienteInterna = signal(true);

  /** true solo la primera vez que se abre el menu tras arrancar. */
  readonly pendiente = this.pendienteInterna.asReadonly();

  /** La presentacion ya se vio (o se salto): no vuelve en esta sesion. */
  marcarVista(): void {
    this.pendienteInterna.set(false);
  }
}
