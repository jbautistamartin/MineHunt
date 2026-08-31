import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { saludar } from '@minehunt/game-engine';

/**
 * Componente raiz del cliente de MineHunt.
 *
 * Fase 0: solo el esqueleto. Las pantallas de configuracion y el tablero
 * llegan en la Fase 1, junto con la traduccion mediante ngx-translate.
 */
@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly titulo = signal('MineHunt');

  /** Saludo del motor de juego: comprueba que el enlace del monorepo funciona. */
  readonly saludoMotor = signal(saludar());
}
