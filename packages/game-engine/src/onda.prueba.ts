import { describe, expect, it } from 'vitest';

import { MotorJuego } from './motor.js';
import { ErrorPartida } from './tipos.js';

const SIN_AZAR = (): number => 0;

/** Reloj manejable a mano, para no depender del tiempo real. */
function relojFalso(): { ahora: () => number; avanzar: (ms: number) => void } {
  let instante = 1_000_000;
  return {
    ahora: () => instante,
    avanzar: (ms: number) => {
      instante += ms;
    },
  };
}

describe('Onda expansiva: activacion', () => {
  it('todos empiezan con la onda disponible', () => {
    const partida = MotorJuego.crearPartida(5, 5, 4, 2);

    expect(partida.estadoDeLaOnda(0).estado).toBe('disponible');
    expect(partida.estadoDeLaOnda(1).estado).toBe('disponible');
  });

  it('activarlo no despeja nada por si solo: espera al clic', () => {
    const partida = MotorJuego.crearPartida(5, 5, 4, 2, { aleatorio: SIN_AZAR });

    partida.activarOnda();

    expect(partida.estadoDeLaOnda(0).estado).toBe('activo');
    expect(
      partida.obtenerEstado().celdas.flat().every((celda) => celda.estado === 'oculta'),
    ).toBe(true);
  });

  it('se puede desactivar sin gastarlo', () => {
    const partida = MotorJuego.crearPartida(5, 5, 4, 2);

    partida.activarOnda();
    partida.desactivarOnda();

    expect(partida.estadoDeLaOnda(0).estado).toBe('disponible');
  });

  it('no se puede activar dos veces ni estando en recarga', () => {
    const reloj = relojFalso();
    const partida = MotorJuego.crearPartida(4, 4, 3, 2, {
      aleatorio: SIN_AZAR,
      ahora: reloj.ahora,
      recargaOndaSegundos: 30,
    });

    partida.activarOnda();
    // Ya esta activo.
    expect(() => partida.activarOnda()).toThrowError(ErrorPartida);

    partida.clicCelda(3, 3); // lo gasta, turno para J1
    // (3,0) es la unica celda sin mina que la cascada no alcanza.
    partida.clicCelda(3, 0); // J1 juega, vuelve el turno a J0

    // J0 lo tiene en recarga.
    expect(partida.estadoDeLaOnda(0).estado).toBe('recargando');
    expect(() => partida.activarOnda()).toThrowError(ErrorPartida);
  });
});

describe('Onda expansiva: efecto', () => {
  it('arrastra las celdas vacias conectadas y su borde numerado', () => {
    // Con SIN_AZAR y primer clic en (2,2), las minas caen en (0,0) y (1,0):
    //   M M .
    //   . . .
    //   . . C
    const partida = MotorJuego.crearPartida(3, 3, 2, 2, { aleatorio: SIN_AZAR });

    partida.activarOnda();
    const resultado = partida.clicCelda(2, 2);

    expect(resultado.codigo).toBe('ONDA_EXPANSIVA');
    expect(resultado.ondaUsada).toBe(true);
    // Las tres celdas de la fila inferior y las tres de la de enmedio.
    expect(resultado.celdasReveladas).toHaveLength(6);

    const estado = partida.obtenerEstado();
    // (2,0) tiene un 1 y no toca ninguna celda vacia: la cascada no llega.
    expect(estado.celdas[0]?.[2]?.estado).toBe('oculta');
    // El borde numerado si se revela, con su numero visible.
    expect(estado.celdas[1]?.[0]?.minasAdyacentes).toBe(2);
    expect(estado.celdas[1]?.[1]?.minasAdyacentes).toBe(2);
  });

  it('gastado en una celda numerada solo la revela a ella: es el riesgo', () => {
    const partida = MotorJuego.crearPartida(3, 3, 2, 2, { aleatorio: SIN_AZAR });
    partida.clicCelda(2, 2); // J0 abre una celda cualquiera
    partida.clicCelda(1, 1); // J1, celda con un 2 alrededor

    partida.activarOnda(); // J0 gasta la onda...
    const resultado = partida.clicCelda(2, 0); // ...en una celda con un 1

    expect(resultado.codigo).toBe('ONDA_EXPANSIVA');
    expect(resultado.celdasReveladas).toEqual([{ x: 2, y: 0 }]);
    expect(partida.estadoDeLaOnda(0).estado).toBe('recargando');
  });

  it('sobre una mina la suma al marcador y gasta la onda igualmente', () => {
    const partida = MotorJuego.crearPartida(3, 3, 2, 2, { aleatorio: SIN_AZAR });
    // El primer clic nunca es mina, asi que hay que gastar un turno antes de
    // poder probar el caso: con (2,2) de salida, las minas van a (0,0) y (1,0).
    partida.clicCelda(2, 2); // J0
    partida.clicCelda(2, 1); // J1

    partida.activarOnda(); // J0 otra vez
    const resultado = partida.clicCelda(0, 0); // (0,0) esconde mina

    expect(resultado.codigo).toBe('MINA_ENCONTRADA');
    expect(resultado.ondaUsada).toBe(true);
    expect(resultado.minasEncontradasPorElJugador).toBe(1);
    expect(partida.estadoDeLaOnda(0).estado).toBe('recargando');
  });

  it('solo afecta al jugador que lo activo', () => {
    const partida = MotorJuego.crearPartida(4, 4, 3, 2, { aleatorio: SIN_AZAR });

    partida.activarOnda(); // J0
    partida.clicCelda(3, 3); // J0 lo gasta

    // A J1 le sigue tocando su onda intacto, y su clic no arrastra nada.
    expect(partida.estadoDeLaOnda(1).estado).toBe('disponible');
    const deJ1 = partida.clicCelda(3, 0);
    expect(deJ1.codigo).toBe('CELDA_DESPEJADA');
    expect(deJ1.ondaUsada).toBe(false);
  });
});

describe('Onda expansiva: recarga', () => {
  it('vuelve a estar disponible cuando pasa el tiempo de recarga', () => {
    const reloj = relojFalso();
    const partida = MotorJuego.crearPartida(4, 4, 3, 2, {
      aleatorio: SIN_AZAR,
      ahora: reloj.ahora,
      recargaOndaSegundos: 30,
    });

    partida.activarOnda();
    partida.clicCelda(3, 3);

    expect(partida.estadoDeLaOnda(0).estado).toBe('recargando');
    expect(partida.estadoDeLaOnda(0).recargaRestanteMs).toBe(30_000);

    reloj.avanzar(29_000);
    expect(partida.estadoDeLaOnda(0).estado).toBe('recargando');
    expect(partida.estadoDeLaOnda(0).recargaRestanteMs).toBe(1000);

    reloj.avanzar(1000);
    expect(partida.estadoDeLaOnda(0).estado).toBe('disponible');
    expect(partida.estadoDeLaOnda(0).recargaRestanteMs).toBe(0);
  });

  it('la recarga se puede configurar en segundos', () => {
    const reloj = relojFalso();
    const partida = MotorJuego.crearPartida(4, 4, 3, 2, {
      aleatorio: SIN_AZAR,
      ahora: reloj.ahora,
      recargaOndaSegundos: 5,
    });

    partida.activarOnda();
    partida.clicCelda(3, 3);

    expect(partida.estadoDeLaOnda(0).recargaRestanteMs).toBe(5000);
    reloj.avanzar(5000);
    expect(partida.estadoDeLaOnda(0).estado).toBe('disponible');
  });

  it('el estado de la onda viaja en el marcador que ve la interfaz', () => {
    const reloj = relojFalso();
    const partida = MotorJuego.crearPartida(4, 4, 3, 2, {
      aleatorio: SIN_AZAR,
      ahora: reloj.ahora,
      recargaOndaSegundos: 10,
    });

    partida.activarOnda();
    partida.clicCelda(3, 3);

    const jugadores = partida.obtenerEstado().jugadores;
    expect(jugadores[0]?.onda).toEqual({ estado: 'recargando', recargaRestanteMs: 10_000 });
    expect(jugadores[1]?.onda).toEqual({ estado: 'disponible', recargaRestanteMs: 0 });
  });

  it('no se puede activar con la partida terminada', () => {
    const partida = MotorJuego.crearPartida(4, 1, 2, 2, { aleatorio: SIN_AZAR });
    partida.clicCelda(3, 0);
    partida.clicCelda(0, 0);
    partida.clicCelda(1, 0);

    expect(partida.estaTerminada()).toBe(true);
    expect(() => partida.activarOnda()).toThrowError(ErrorPartida);
  });
});
