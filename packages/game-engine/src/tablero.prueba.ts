import { describe, expect, it } from 'vitest';

import { Tablero } from './tablero.js';
import type { Coordenada } from './tipos.js';

/** Cuenta las minas realmente colocadas recorriendo el tablero entero. */
function contarMinas(tablero: Tablero): number {
  let total = 0;
  for (let y = 0; y < tablero.alto; y += 1) {
    for (let x = 0; x < tablero.ancho; x += 1) {
      if (tablero.tieneMina(x, y)) {
        total += 1;
      }
    }
  }
  return total;
}

describe('Tablero: colocacion de minas', () => {
  it('coloca exactamente el numero de minas pedido', () => {
    for (const minas of [1, 5, 10, 35]) {
      const tablero = new Tablero(6, 6, minas);
      tablero.colocarMinas({ x: 0, y: 0 }, Math.random);

      expect(contarMinas(tablero)).toBe(minas);
    }
  });

  it('nunca pone mina en la celda excluida, ni con el tablero saturado', () => {
    // 8 minas en 9 celdas: la unica libre tiene que ser la excluida.
    for (let intento = 0; intento < 200; intento += 1) {
      const tablero = new Tablero(3, 3, 8);
      const x = intento % 3;
      const y = Math.floor(intento / 3) % 3;
      tablero.colocarMinas({ x, y }, Math.random);

      expect(tablero.tieneMina(x, y)).toBe(false);
      expect(contarMinas(tablero)).toBe(8);
    }
  });

  it('reparte las minas por todo el tablero y no siempre en el mismo sitio', () => {
    const vecesConMina = new Map<string, number>();
    const repeticiones = 300;

    for (let intento = 0; intento < repeticiones; intento += 1) {
      const tablero = new Tablero(4, 4, 4);
      tablero.colocarMinas({ x: 0, y: 0 }, Math.random);
      for (let y = 0; y < 4; y += 1) {
        for (let x = 0; x < 4; x += 1) {
          if (tablero.tieneMina(x, y)) {
            const clave = `${x},${y}`;
            vecesConMina.set(clave, (vecesConMina.get(clave) ?? 0) + 1);
          }
        }
      }
    }

    // Las 15 celdas no excluidas deberian haber tenido mina alguna vez.
    expect(vecesConMina.size).toBe(15);
    // Y ninguna deberia acaparar: con 4 minas en 15 huecos, ~80 de 300.
    for (const veces of vecesConMina.values()) {
      expect(veces).toBeGreaterThan(20);
      expect(veces).toBeLessThan(200);
    }
  });

  it('ignora una segunda colocacion para no rehacer el tablero a mitad de partida', () => {
    const tablero = new Tablero(4, 4, 3);
    tablero.colocarMinas({ x: 0, y: 0 }, Math.random);
    const antes = contarMinas(tablero);

    tablero.colocarMinas({ x: 3, y: 3 }, Math.random);

    expect(contarMinas(tablero)).toBe(antes);
  });
});

describe('Tablero: numeros de minas adyacentes', () => {
  it('cuenta las ocho vecinas, tambien en esquinas y bordes', () => {
    // Con aleatorio constante a 0 y (2,2) excluida, las minas van a (0,0) y (1,0):
    //   M M .
    //   . . .
    //   . . .
    const tablero = new Tablero(3, 3, 2);
    tablero.colocarMinas({ x: 2, y: 2 }, () => 0);
    const numeros = tablero.despejarEnCascada(2, 2);
    expect(numeros.length).toBeGreaterThan(0);

    const visible = tablero.aVisible();
    // (0,1) toca las dos minas; (1,1) tambien; (2,1) solo la de (1,0).
    expect(visible[1]?.[0]?.minasAdyacentes).toBe(2);
    expect(visible[1]?.[1]?.minasAdyacentes).toBe(2);
    expect(visible[1]?.[2]?.minasAdyacentes).toBe(1);
    // La esquina opuesta no toca ninguna.
    expect(visible[2]?.[2]?.minasAdyacentes).toBe(0);
  });
});

describe('Tablero: cascada', () => {
  it('no propaga desde una celda con minas alrededor', () => {
    const tablero = new Tablero(3, 3, 2);
    tablero.colocarMinas({ x: 2, y: 2 }, () => 0);

    // (2,0) tiene un 1: se revela ella sola.
    expect(tablero.despejarEnCascada(2, 0)).toEqual([{ x: 2, y: 0 }]);
  });

  it('despeja el tablero entero cuando no hay ninguna mina alrededor', () => {
    // Una sola mina en la esquina deja el resto del tablero conectado.
    const tablero = new Tablero(5, 5, 1);
    tablero.colocarMinas({ x: 4, y: 4 }, () => 0);
    const reveladas = tablero.despejarEnCascada(4, 4);

    // Las 24 celdas sin mina quedan visibles.
    expect(reveladas).toHaveLength(24);
    expect(tablero.estadoDe(0, 0)).toBe('oculta');
  });

  it('no revela dos veces la misma celda', () => {
    const tablero = new Tablero(5, 5, 1);
    tablero.colocarMinas({ x: 4, y: 4 }, () => 0);
    const reveladas = tablero.despejarEnCascada(4, 4);
    const claves = new Set(reveladas.map((celda: Coordenada) => `${String(celda.x)},${String(celda.y)}`));

    expect(claves.size).toBe(reveladas.length);
  });
});
