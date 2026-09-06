import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Jugador } from '@minehunt/game-engine';
import { TranslatePipe } from '@ngx-translate/core';

/** Una fila del resumen: un jugador con lo que hizo. */
export interface FilaResumen {
  readonly id: number;
  readonly nombre: string;
  readonly minas: number;
  readonly rendido: boolean;
  readonly ganador: boolean;
  readonly turnosPerdidos: number;
  /** Minas por cada cien clics, o null si no llego a clicar nada. */
  readonly punteria: number | null;
}

/**
 * Como fue la partida, jugador a jugador.
 *
 * Sale al terminar, debajo del resultado, en el Entrenamiento, en Historia y
 * en el Online: las tres leen las mismas estadisticas, que viajan dentro de
 * `EstadoPartida` y las calcula el motor. **Solo pinta**: quien lo usa le pasa
 * los jugadores y sus nombres ya resueltos, porque cada modo los nombra a su
 * manera —«Jugador 2» y «Bot 1» en local, el nombre que se puso cada uno en el
 * Online—.
 *
 * **Un jugador, una linea**: el nombre, cuantas minas y con que punteria. El
 * motor cuenta ademas clics, celdas, ondas y mejor racha, y aqui no salen a
 * proposito: son el detalle de como se llego al resultado, no el resultado, y
 * pintarlos obligaba a una rejilla debajo de cada nombre que se comia la
 * pantalla del telefono para decir menos. Los turnos perdidos son la
 * excepcion, porque no cuentan como se jugo sino como se dejo de jugar, y solo
 * salen si hubo alguno.
 *
 * La punteria es la cuenta que resume el juego entero: de cada cien clics,
 * cuantos dieron mina. No se calcula en el motor porque no es estado, es una
 * division.
 */
@Component({
  selector: 'mh-resumen-final',
  imports: [TranslatePipe],
  templateUrl: './resumen-final.html',
  styleUrl: './resumen-final.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResumenFinal {
  readonly jugadores = input.required<readonly Jugador[]>();
  /** Nombre de cada jugador, en orden de puesto y ya traducido. */
  readonly nombres = input.required<readonly string[]>();
  readonly ganador = input<number | null>(null);

  /** De mas a menos minas, que es el orden en el que se mira una tabla. */
  readonly filas = computed<readonly FilaResumen[]>(() => {
    const nombres = this.nombres();
    const ganador = this.ganador();

    return [...this.jugadores()]
      .map((jugador): FilaResumen => {
        // Las estadisticas podrian no venir: el estado de una partida online lo
        // manda el servidor, y el resumen es lo ultimo que puede permitirse
        // tumbar la pantalla justo cuando termina la partida.
        const { clics = 0, turnosPerdidos = 0 } = jugador.estadisticas ?? {};

        return {
          id: jugador.id,
          nombre: nombres[jugador.id] ?? '',
          minas: jugador.minasEncontradas,
          rendido: jugador.rendido,
          ganador: jugador.id === ganador,
          turnosPerdidos,
          punteria: clics === 0 ? null : Math.round((jugador.minasEncontradas / clics) * 100),
        };
      })
      .sort((a, b) => b.minas - a.minas);
  });
}
