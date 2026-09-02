import { describe, expect, it } from 'vitest';

import { MotorJuego } from '../motor.js';
import { MAX_JUGADORES, MIN_JUGADORES } from '../tipos.js';
import { NIVELES_HISTORIA, TOTAL_NIVELES, TOTAL_ZONAS, obtenerNivel } from './niveles.js';

describe('Niveles del Modo Historia', () => {
  it('hay cincuenta niveles numerados del 1 al 50', () => {
    expect(NIVELES_HISTORIA).toHaveLength(TOTAL_NIVELES);
    expect(TOTAL_NIVELES).toBe(50);
    expect(NIVELES_HISTORIA.map((nivel) => nivel.numero)).toEqual(
      Array.from({ length: TOTAL_NIVELES }, (_valor, indice) => indice + 1),
    );
  });

  it('obtenerNivel devuelve el nivel pedido y null fuera de rango', () => {
    expect(obtenerNivel(1)?.numero).toBe(1);
    expect(obtenerNivel(TOTAL_NIVELES)?.numero).toBe(TOTAL_NIVELES);
    expect(obtenerNivel(0)).toBeNull();
    expect(obtenerNivel(TOTAL_NIVELES + 1)).toBeNull();
  });

  /**
   * Lo importante de una tabla generada: que ningun nivel salga imposible de
   * jugar. Se comprueba creando la partida de verdad, que es quien manda.
   */
  it('todos los niveles crean una partida valida', () => {
    for (const nivel of NIVELES_HISTORIA) {
      const jugadores = nivel.rivales.length + 1;
      expect(jugadores).toBeGreaterThanOrEqual(MIN_JUGADORES);
      expect(jugadores).toBeLessThanOrEqual(MAX_JUGADORES);
      expect(nivel.minas).toBeLessThanOrEqual(nivel.ancho * nivel.alto - 1);

      expect(() =>
        MotorJuego.crearPartida(nivel.ancho, nivel.alto, nivel.minas, jugadores, {
          recargaOndaSegundos: nivel.recargaOndaSegundos,
          tiempoPorTurnoSegundos: nivel.tiempoPorTurnoSegundos,
        }),
      ).not.toThrow();
    }
  });

  it('los rivales juegan a niveles de IA que existen', () => {
    for (const nivel of NIVELES_HISTORIA) {
      for (const rival of nivel.rivales) {
        expect(rival).toBeGreaterThanOrEqual(1);
        expect(rival).toBeLessThanOrEqual(5);
      }
      // El primer rival es el mas fuerte de la mesa.
      const ordenados = [...nivel.rivales].sort((a, b) => b - a);
      expect(nivel.rivales).toEqual(ordenados);
    }
  });

  it('reparte los niveles en cinco zonas de diez', () => {
    for (const nivel of NIVELES_HISTORIA) {
      expect(nivel.zona).toBe(Math.floor((nivel.numero - 1) / 10) + 1);
      expect(nivel.zona).toBeGreaterThanOrEqual(1);
      expect(nivel.zona).toBeLessThanOrEqual(TOTAL_ZONAS);
    }
    expect(TOTAL_ZONAS).toBe(5);
  });

  it('la dificultad nunca retrocede de un nivel al siguiente', () => {
    for (let indice = 1; indice < NIVELES_HISTORIA.length; indice += 1) {
      const anterior = NIVELES_HISTORIA[indice - 1] as (typeof NIVELES_HISTORIA)[number];
      const actual = NIVELES_HISTORIA[indice] as (typeof NIVELES_HISTORIA)[number];

      expect(actual.ancho).toBeGreaterThanOrEqual(anterior.ancho);
      expect(actual.alto).toBeGreaterThanOrEqual(anterior.alto);
      expect(actual.ancho * actual.alto).toBeGreaterThanOrEqual(anterior.ancho * anterior.alto);
      expect(actual.minas).toBeGreaterThanOrEqual(anterior.minas);
      // La onda tarda cada vez mas en volver.
      expect(actual.recargaOndaSegundos).toBeGreaterThanOrEqual(anterior.recargaOndaSegundos);
      expect(actual.rivales.length).toBeGreaterThanOrEqual(anterior.rivales.length);
      expect(actual.rivales[0] ?? 0).toBeGreaterThanOrEqual(anterior.rivales[0] ?? 0);
    }
  });

  it('empieza sin reloj y acaba con el reloj apretado', () => {
    const primeros = NIVELES_HISTORIA.slice(0, 5);
    expect(primeros.every((nivel) => nivel.tiempoPorTurnoSegundos === 0)).toBe(true);

    const conReloj = NIVELES_HISTORIA.slice(5);
    expect(conReloj.every((nivel) => nivel.tiempoPorTurnoSegundos > 0)).toBe(true);

    // A partir del sexto, el tiempo por turno solo puede bajar.
    for (let indice = 6; indice < NIVELES_HISTORIA.length; indice += 1) {
      const anterior = NIVELES_HISTORIA[indice - 1] as (typeof NIVELES_HISTORIA)[number];
      const actual = NIVELES_HISTORIA[indice] as (typeof NIVELES_HISTORIA)[number];
      expect(actual.tiempoPorTurnoSegundos).toBeLessThanOrEqual(
        anterior.tiempoPorTurnoSegundos,
      );
    }

    const ultimo = NIVELES_HISTORIA[TOTAL_NIVELES - 1] as (typeof NIVELES_HISTORIA)[number];
    expect(ultimo.tiempoPorTurnoSegundos).toBeLessThanOrEqual(10);
  });

  it('el primer nivel es asequible y el ultimo no', () => {
    const primero = NIVELES_HISTORIA[0] as (typeof NIVELES_HISTORIA)[number];
    const ultimo = NIVELES_HISTORIA[TOTAL_NIVELES - 1] as (typeof NIVELES_HISTORIA)[number];

    expect(primero.rivales).toEqual([1]); // un rival, y del nivel mas tonto
    expect(primero.tiempoPorTurnoSegundos).toBe(0);

    expect(ultimo.rivales).toHaveLength(3); // mesa de cuatro
    expect(ultimo.rivales[0]).toBe(5);
    expect(ultimo.ancho * ultimo.alto).toBeGreaterThan(primero.ancho * primero.alto * 4);
  });
});
