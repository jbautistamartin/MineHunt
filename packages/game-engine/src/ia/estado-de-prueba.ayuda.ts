import type {
  CeldaVisible,
  EstadisticasJugador,
  EstadoPartida,
  OndaJugador,
} from '../tipos.js';

/** Onda lista para usarse, que es como arrancan todos los jugadores. */
const ONDA_DISPONIBLE: OndaJugador = { estado: 'disponible', recargaRestanteMs: 0 };

/** Nadie ha jugado todavia: al bot le da igual, pero el tipo las pide. */
const SIN_ESTADISTICAS: EstadisticasJugador = {
  clics: 0,
  celdasReveladas: 0,
  ondasUsadas: 0,
  mejorRacha: 0,
  turnosPerdidos: 0,
};

/**
 * Ayudante de pruebas: construye un EstadoPartida a partir de un dibujo del
 * tablero visible.
 *
 * Que se pueda montar a mano es en si mismo la demostracion de que
 * EstadoPartida no contiene informacion oculta: aqui no hay forma de decir
 * donde estan las minas que siguen tapadas, porque el tipo no lo permite.
 *
 *   '#'      celda oculta
 *   '*'      mina ya encontrada
 *   '0'-'8'  celda despejada con ese numero de minas alrededor
 *
 * Los dibujos de las pruebas son consistentes: existe un reparto real de
 * minas que produce exactamente esos numeros.
 */
export function tableroDe(
  dibujo: readonly string[],
  minasRestantes: number,
  onda: OndaJugador = ONDA_DISPONIBLE,
): EstadoPartida {
  const celdas: CeldaVisible[][] = dibujo.map((fila, y) =>
    [...fila].map((simbolo, x): CeldaVisible => {
      if (simbolo === '#') {
        return { x, y, estado: 'oculta', minasAdyacentes: null, encontradaPor: null };
      }
      if (simbolo === '*') {
        return { x, y, estado: 'mina-encontrada', minasAdyacentes: null, encontradaPor: 0 };
      }
      return {
        x,
        y,
        estado: 'despejada',
        minasAdyacentes: Number(simbolo),
        encontradaPor: null,
      };
    }),
  );

  return {
    ancho: celdas[0]?.length ?? 0,
    alto: celdas.length,
    totalMinas: minasRestantes,
    minasEncontradas: 0,
    minasRestantes,
    celdas,
    jugadores: [
      { id: 0, minasEncontradas: 0, onda, rendido: false, estadisticas: SIN_ESTADISTICAS },
      { id: 1, minasEncontradas: 0, onda, rendido: false, estadisticas: SIN_ESTADISTICAS },
    ],
    turnoDe: 0,
    tiempoPorTurnoMs: 0,
    tiempoRestanteMs: null,
    terminada: false,
    ganador: null,
    empate: false,
  };
}
