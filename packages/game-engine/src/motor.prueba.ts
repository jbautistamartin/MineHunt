import { describe, expect, it } from 'vitest';

import { MotorJuego } from './motor.js';
import { ErrorPartida } from './tipos.js';

/**
 * Generador determinista: con 0 constante, el barajado de Fisher-Yates deja
 * las minas en los indices mas bajos disponibles, asi que se sabe exactamente
 * donde caen y las pruebas pueden razonar sobre el tablero.
 */
const SIN_AZAR = (): number => 0;

describe('MotorJuego: creacion de partida', () => {
  it('rechaza dimensiones invalidas', () => {
    expect(() => MotorJuego.crearPartida(0, 5, 3, 2)).toThrowError(ErrorPartida);
    expect(() => MotorJuego.crearPartida(5, 5.5, 3, 2)).toThrowError(ErrorPartida);
  });

  it('rechaza que no quede ninguna celda libre para el primer clic', () => {
    // Un 3x3 admite como mucho 8 minas: la novena celda es la del primer clic.
    expect(() => MotorJuego.crearPartida(3, 3, 9, 2)).toThrowError(ErrorPartida);
    expect(() => MotorJuego.crearPartida(3, 3, 8, 2)).not.toThrow();
  });

  it('admite de 2 a 4 jugadores y nada mas', () => {
    expect(() => MotorJuego.crearPartida(5, 5, 5, 1)).toThrowError(ErrorPartida);
    expect(() => MotorJuego.crearPartida(5, 5, 5, 5)).toThrowError(ErrorPartida);
    expect(() => MotorJuego.crearPartida(5, 5, 5, 4)).not.toThrow();
  });

  it('empieza con el tablero oculto, el marcador a cero y el turno del jugador 0', () => {
    const partida = MotorJuego.crearPartida(4, 3, 5, 3);
    const estado = partida.obtenerEstado();

    expect(estado.turnoDe).toBe(0);
    expect(estado.terminada).toBe(false);
    expect(estado.minasRestantes).toBe(5);
    expect(estado.jugadores).toEqual([
      { id: 0, minasEncontradas: 0 },
      { id: 1, minasEncontradas: 0 },
      { id: 2, minasEncontradas: 0 },
    ]);
    expect(estado.celdas.flat().every((celda) => celda.estado === 'oculta')).toBe(true);
  });
});

describe('MotorJuego: generacion de minas', () => {
  it('nunca coloca una mina en la primera celda clicada', () => {
    // Tablero saturado: 8 de 9 celdas tienen mina, asi que si la exclusion
    // fallara, el primer clic encontraria mina casi siempre.
    for (let intento = 0; intento < 200; intento += 1) {
      const partida = MotorJuego.crearPartida(3, 3, 8, 2);
      const x = intento % 3;
      const y = Math.floor(intento / 3) % 3;

      expect(partida.clicCelda(x, y).codigo).toBe('CELDA_DESPEJADA');
    }
  });

  it('mantiene el cuadre entre minas encontradas y restantes', () => {
    const partida = MotorJuego.crearPartida(6, 6, 10, 2);
    partida.clicCelda(0, 0);

    while (!partida.estaTerminada()) {
      const oculta = partida
        .obtenerEstado()
        .celdas.flat()
        .find((celda) => celda.estado === 'oculta');
      if (oculta === undefined) {
        break;
      }
      partida.clicCelda(oculta.x, oculta.y);

      const estado = partida.obtenerEstado();
      const sumaDelMarcador = estado.jugadores.reduce(
        (total, jugador) => total + jugador.minasEncontradas,
        0,
      );
      expect(sumaDelMarcador).toBe(estado.minasEncontradas);
      expect(estado.minasEncontradas + estado.minasRestantes).toBe(10);
    }
  });
});

describe('MotorJuego: revelado en cascada', () => {
  it('arrastra las celdas vacias conectadas y se detiene en el borde numerado', () => {
    // Con SIN_AZAR y primer clic en (2,2), las minas caen en (0,0) y (1,0):
    //   M M .
    //   . . .
    //   . . C
    const partida = MotorJuego.crearPartida(3, 3, 2, 2, { aleatorio: SIN_AZAR });
    const resultado = partida.clicCelda(2, 2);

    expect(resultado.codigo).toBe('CELDA_DESPEJADA');
    // Se revelan las tres celdas de la fila inferior y las tres de la de enmedio.
    expect(resultado.celdasReveladas).toHaveLength(6);

    const estado = partida.obtenerEstado();
    // (2,0) tiene un 1 y no toca ninguna celda vacia: la cascada no llega.
    expect(estado.celdas[0]?.[2]?.estado).toBe('oculta');
    // El borde numerado si se revela, con su numero visible.
    expect(estado.celdas[1]?.[0]?.minasAdyacentes).toBe(2);
    expect(estado.celdas[1]?.[1]?.minasAdyacentes).toBe(2);
    expect(estado.celdas[2]?.[0]?.minasAdyacentes).toBe(0);
  });

  it('al encontrar una mina revela solo esa celda', () => {
    const partida = MotorJuego.crearPartida(3, 3, 2, 2, { aleatorio: SIN_AZAR });
    partida.clicCelda(2, 2);
    const resultado = partida.clicCelda(0, 0);

    expect(resultado.codigo).toBe('MINA_ENCONTRADA');
    expect(resultado.celdasReveladas).toEqual([{ x: 0, y: 0 }]);
  });
});

describe('MotorJuego: turnos', () => {
  it('pasa el turno al siguiente jugador tanto si encuentra mina como si no', () => {
    const partida = MotorJuego.crearPartida(3, 3, 2, 2, { aleatorio: SIN_AZAR });

    expect(partida.obtenerEstado().turnoDe).toBe(0);
    // Celda sin mina.
    expect(partida.clicCelda(2, 2).turnoDe).toBe(1);
    // Mina: el turno pasa igualmente.
    expect(partida.clicCelda(0, 0).turnoDe).toBe(0);
  });

  it('da la vuelta al llegar al ultimo jugador', () => {
    // 3x2 con minas en toda la fila superior: ninguna celda de la fila
    // inferior tiene un 0, asi que no hay cascadas que estorben.
    //   M M M
    //   . . .
    const partida = MotorJuego.crearPartida(3, 2, 3, 3, { aleatorio: SIN_AZAR });

    expect(partida.clicCelda(2, 1).turnoDe).toBe(1);
    expect(partida.clicCelda(1, 1).turnoDe).toBe(2);
    expect(partida.clicCelda(0, 1).turnoDe).toBe(0);
  });

  it('anota la mina en el marcador de quien la encuentra', () => {
    const partida = MotorJuego.crearPartida(3, 3, 2, 2, { aleatorio: SIN_AZAR });
    partida.clicCelda(2, 2);
    const resultado = partida.clicCelda(0, 0);

    expect(resultado.jugador).toBe(1);
    expect(resultado.minasEncontradasPorElJugador).toBe(1);
    expect(partida.obtenerEstado().jugadores[1]?.minasEncontradas).toBe(1);
    expect(partida.obtenerEstado().jugadores[0]?.minasEncontradas).toBe(0);
  });

  it('deja constancia en la celda de quien encontro la mina', () => {
    const partida = MotorJuego.crearPartida(3, 3, 2, 2, { aleatorio: SIN_AZAR });
    partida.clicCelda(2, 2); // J0, sin mina
    partida.clicCelda(0, 0); // J1, mina

    const celda = partida.obtenerEstado().celdas[0]?.[0];
    expect(celda?.estado).toBe('mina-encontrada');
    expect(celda?.encontradaPor).toBe(1);
  });
});

describe('MotorJuego: clics invalidos', () => {
  it('rechaza celdas fuera del tablero', () => {
    const partida = MotorJuego.crearPartida(3, 3, 2, 2);
    expect(() => partida.clicCelda(3, 0)).toThrowError(ErrorPartida);
    expect(() => partida.clicCelda(-1, 0)).toThrowError(ErrorPartida);
  });

  it('rechaza celdas ya reveladas', () => {
    const partida = MotorJuego.crearPartida(3, 3, 2, 2, { aleatorio: SIN_AZAR });
    partida.clicCelda(2, 2);
    expect(() => partida.clicCelda(2, 2)).toThrowError(ErrorPartida);
  });
});

describe('MotorJuego: fin de partida', () => {
  it('termina cuando se encuentran todas las minas', () => {
    // 4x1 con SIN_AZAR y primer clic en (3,0): minas en (0,0) y (1,0).
    const partida = MotorJuego.crearPartida(4, 1, 2, 2, { aleatorio: SIN_AZAR });

    partida.clicCelda(3, 0); // J0, sin mina
    partida.clicCelda(0, 0); // J1, mina
    expect(partida.estaTerminada()).toBe(false);
    partida.clicCelda(1, 0); // J0, mina: se agotan las minas

    expect(partida.estaTerminada()).toBe(true);
    expect(partida.obtenerEstado().minasRestantes).toBe(0);
    // Empate a una mina: no hay ganador.
    expect(partida.obtenerGanador()).toBeNull();
    expect(partida.obtenerEstado().empate).toBe(true);
  });

  it('termina por mayoria matematica aunque queden minas por encontrar', () => {
    // 3x2 con SIN_AZAR y primer clic en (2,1): minas en toda la fila superior.
    //   M M M
    //   . . C
    const partida = MotorJuego.crearPartida(3, 2, 3, 2, { aleatorio: SIN_AZAR });

    partida.clicCelda(2, 1); // J0, sin mina
    partida.clicCelda(1, 1); // J1, sin mina
    partida.clicCelda(0, 0); // J0, mina -> J0 = 1
    partida.clicCelda(0, 1); // J1, sin mina
    const ultimo = partida.clicCelda(1, 0); // J0, mina -> J0 = 2

    // Queda 1 mina: aunque J1 se la lleve se queda en 1, por debajo de 2.
    expect(ultimo.terminada).toBe(true);
    expect(partida.obtenerEstado().minasRestantes).toBe(1);
    expect(partida.obtenerGanador()).toBe(0);
    expect(partida.obtenerEstado().empate).toBe(false);
  });

  it('no acepta mas clics una vez terminada', () => {
    const partida = MotorJuego.crearPartida(4, 1, 2, 2, { aleatorio: SIN_AZAR });
    partida.clicCelda(3, 0);
    partida.clicCelda(0, 0);
    partida.clicCelda(1, 0);

    expect(() => partida.clicCelda(2, 0)).toThrowError(ErrorPartida);
  });

  it('ordena la clasificacion de mas a menos minas', () => {
    const partida = MotorJuego.crearPartida(3, 2, 3, 2, { aleatorio: SIN_AZAR });
    partida.clicCelda(2, 1);
    partida.clicCelda(1, 1);
    partida.clicCelda(0, 0);
    partida.clicCelda(0, 1);
    partida.clicCelda(1, 0);

    expect(partida.obtenerClasificacion()).toEqual([
      { id: 0, minasEncontradas: 2 },
      { id: 1, minasEncontradas: 0 },
    ]);
  });
});

describe('MotorJuego: informacion oculta', () => {
  it('no filtra donde estan las minas que siguen ocultas', () => {
    const partida = MotorJuego.crearPartida(5, 5, 6, 2);
    partida.clicCelda(2, 2);

    for (const celda of partida.obtenerEstado().celdas.flat()) {
      if (celda.estado === 'oculta') {
        // Una celda oculta no revela ni su numero ni si esconde una mina.
        expect(celda.minasAdyacentes).toBeNull();
        expect(celda.encontradaPor).toBeNull();
        expect(Object.keys(celda).sort()).toEqual([
          'encontradaPor',
          'estado',
          'minasAdyacentes',
          'x',
          'y',
        ]);
      }
    }
  });
});
