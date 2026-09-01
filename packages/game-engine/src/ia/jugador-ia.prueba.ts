import { describe, expect, it } from 'vitest';

import { MotorJuego } from '../motor.js';
import { clave } from './analisis.js';
import { tableroDe } from './estado-de-prueba.ayuda.js';
import { JugadorIA, NIVELES_IA } from './jugador-ia.js';

const PRIMERA = (): number => 0;

describe('JugadorIA: nivel 1 (azar puro)', () => {
  it('reparte sus jugadas por todas las ocultas, sin deducir nada', () => {
    // Reparto real: minas en (0,0), (1,0) y (2,0). Un bot que dedujera algo
    // iria siempre a las mismas; el de azar las toca todas.
    const estado = tableroDe(['###', '232', '000'], 3);
    const bot = new JugadorIA(1);
    const elegidas = new Set<string>();

    for (let intento = 0; intento < 300; intento += 1) {
      elegidas.add(clave(bot.elegirJugada(estado).celda));
    }

    expect(elegidas.size).toBe(3);
  });
});

describe('JugadorIA: nivel 2 (deduccion basica)', () => {
  it('detecta el caso trivial y va directo a una mina segura', () => {
    const estado = tableroDe(['###', '232', '000'], 3);
    const bot = new JugadorIA(2, { aleatorio: PRIMERA });

    const decision = bot.elegirJugada(estado);

    expect(decision.motivo).toBe('MINA_SEGURA');
    expect(decision.probabilidad).toBe(1);
    expect(decision.celda.y).toBe(0);
  });

  it('encadena deducciones descontando lo que ya sabe', () => {
    // Los ceros liberan tres celdas y eso deja al 1 de (2,1) con una sola
    // oculta: la mina tiene que estar en (3,0).
    const estado = tableroDe(['####', '0011', '0000'], 1);
    const bot = new JugadorIA(2, { aleatorio: PRIMERA });

    const decision = bot.elegirJugada(estado);

    expect(decision.motivo).toBe('MINA_SEGURA');
    expect(decision.celda).toEqual({ x: 3, y: 0 });
  });
});

describe('JugadorIA: nivel 3 (deduccion combinada)', () => {
  it('resuelve el 1-2-2-1 que el nivel 2 no sabe desenredar', () => {
    const estado = tableroDe(['####', '1221', '0000'], 2);

    const nivel2 = new JugadorIA(2, { aleatorio: PRIMERA }).elegirJugada(estado);
    const nivel3 = new JugadorIA(3, { aleatorio: PRIMERA }).elegirJugada(estado);

    expect(nivel2.motivo).not.toBe('MINA_SEGURA');
    expect(nivel3.motivo).toBe('MINA_SEGURA');
    expect(nivel3.celda).toEqual({ x: 2, y: 0 });
  });
});

describe('JugadorIA: nivel 4 (probabilidad)', () => {
  it('va a la frontera cuando promete mas que el resto del tablero', () => {
    // El 2 reparte 2 minas entre sus 8 vecinas (0,25), mientras que el resto
    // del tablero se queda en la densidad general (2/14 = 0,14).
    const estado = tableroDe(['#####', '##2##', '#####'], 2);
    const bot = new JugadorIA(4, { aleatorio: PRIMERA });

    const decision = bot.elegirJugada(estado);

    expect(decision.motivo).toBe('MEJOR_PROBABILIDAD');
    expect(decision.probabilidad).toBeCloseTo(2 / 8, 5);
    // Solo las ocho vecinas del 2 alcanzan esa probabilidad.
    expect(Math.abs(decision.celda.x - 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(decision.celda.y - 1)).toBeLessThanOrEqual(1);
  });

  it('sigue prefiriendo la certeza a la probabilidad', () => {
    const estado = tableroDe(['###', '232', '000'], 3);

    expect(new JugadorIA(4).elegirJugada(estado).motivo).toBe('MINA_SEGURA');
  });
});

describe('JugadorIA: nivel 5 (estrategico)', () => {
  it('entre celdas igual de prometedoras se queda con la de menos vecinas', () => {
    // Tablero entero oculto: todas empatan en probabilidad, asi que decide el
    // criterio de esquinas y bordes.
    const estado = tableroDe(['####', '####', '####'], 4);

    const decision = new JugadorIA(5).elegirJugada(estado);

    const esEsquina =
      (decision.celda.x === 0 || decision.celda.x === 3) &&
      (decision.celda.y === 0 || decision.celda.y === 2);
    expect(esEsquina).toBe(true);
  });

  it('no sacrifica una mina segura por una esquina', () => {
    const estado = tableroDe(['####', '0011', '0000'], 1);

    const decision = new JugadorIA(5).elegirJugada(estado);

    expect(decision.motivo).toBe('MINA_SEGURA');
    expect(decision.celda).toEqual({ x: 3, y: 0 });
  });
});

describe('JugadorIA: nunca usa informacion oculta', () => {
  it('solo propone celdas ocultas, en cualquier nivel y partida completa', () => {
    for (const nivel of NIVELES_IA) {
      const partida = MotorJuego.crearPartida(8, 8, 12, 2);
      const bot = new JugadorIA(nivel);
      partida.clicCelda(0, 0);

      while (!partida.estaTerminada()) {
        const estado = partida.obtenerEstado();
        const decision = bot.elegirJugada(estado);
        expect(estado.celdas[decision.celda.y]?.[decision.celda.x]?.estado).toBe('oculta');
        if (decision.usarOnda) {
          partida.activarOnda();
        }
        partida.clicCelda(decision.celda.x, decision.celda.y);
      }
    }
  });

  it('decide lo mismo ante el mismo tablero visible', () => {
    const estado = tableroDe(['#####', '##2##', '#####'], 2);
    const bot = new JugadorIA(5);

    const primera = bot.elegirJugada(estado);
    const segunda = bot.elegirJugada(structuredClone(estado));

    expect(primera.celda).toEqual(segunda.celda);
  });

  it('el nivel 5 falla clics: si viera las minas acertaria siempre', () => {
    let clics = 0;
    let minas = 0;

    for (let ronda = 0; ronda < 15; ronda += 1) {
      const juego = MotorJuego.crearPartida(9, 9, 15, 2);
      const bot = new JugadorIA(5);
      juego.clicCelda(4, 4);

      while (!juego.estaTerminada()) {
        const decision = bot.elegirJugada(juego.obtenerEstado());
        if (decision.usarOnda) {
          juego.activarOnda();
        }
        const resultado = juego.clicCelda(decision.celda.x, decision.celda.y);
        clics += 1;
        if (resultado.codigo === 'MINA_ENCONTRADA') {
          minas += 1;
        }
      }
    }

    expect(clics).toBeGreaterThan(0);
    expect(minas / clics).toBeLessThan(0.95);
  });
});

describe('JugadorIA: los niveles altos juegan mejor', () => {
  it('el nivel 4 le saca ventaja al nivel 1 a lo largo de muchas partidas', () => {
    let listo = 0;
    let torpe = 0;

    for (let ronda = 0; ronda < 40; ronda += 1) {
      const juego = MotorJuego.crearPartida(9, 9, 15, 2);
      // El jugador 0 razona; el jugador 1 va a ciegas.
      const bots = [new JugadorIA(4), new JugadorIA(1)];
      juego.clicCelda(4, 4);

      while (!juego.estaTerminada()) {
        const estado = juego.obtenerEstado();
        const decision = bots[estado.turnoDe]?.elegirJugada(estado);
        if (decision === undefined) {
          break;
        }
        if (decision.usarOnda) {
          juego.activarOnda();
        }
        juego.clicCelda(decision.celda.x, decision.celda.y);
      }

      const final = juego.obtenerEstado();
      listo += final.jugadores[0]?.minasEncontradas ?? 0;
      torpe += final.jugadores[1]?.minasEncontradas ?? 0;
    }

    expect(listo).toBeGreaterThan(torpe);
  });
});

describe('JugadorIA: uso de la onda expansiva', () => {
  const RECARGANDO = { estado: 'recargando' as const, recargaRestanteMs: 5000 };

  it('el nivel 1 lo tira de vez en cuando, sin criterio', () => {
    const estado = tableroDe(['###', '232', '000'], 3);
    let veces = 0;

    for (let intento = 0; intento < 400; intento += 1) {
      if (new JugadorIA(1).elegirJugada(estado).usarOnda) {
        veces += 1;
      }
    }

    // Ni siempre ni nunca: lo usa a ojo, en torno al 20 % de los turnos.
    expect(veces).toBeGreaterThan(20);
    expect(veces).toBeLessThan(200);
  });

  it('los niveles 2 y 3 lo gastan en una celda que saben libre', () => {
    // Reparto real: unica mina en (3,0). Los ceros liberan (0,0), (1,0) y (2,0),
    // pero eso encadena hasta cantar (3,0) como mina, que es mejor jugada.
    // Aqui se corta esa cadena: sin el 1 de (2,1) no hay mina segura.
    const estado = tableroDe(['####', '0000', '0000'], 2);

    for (const nivel of [2, 3] as const) {
      const decision = new JugadorIA(nivel).elegirJugada(estado);
      expect(decision.motivo).toBe('DESPEJE_CON_ONDA');
      expect(decision.usarOnda).toBe(true);
    }
  });

  it('nunca lo gasta si tiene una mina cantada: eso puntua y la onda no', () => {
    const estado = tableroDe(['###', '232', '000'], 3);

    for (const nivel of NIVELES_IA.filter((valor) => valor > 1)) {
      const decision = new JugadorIA(nivel).elegirJugada(estado);
      expect(decision.motivo).toBe('MINA_SEGURA');
      expect(decision.usarOnda).toBe(false);
    }
  });

  it('no lo intenta gastar mientras esta en recarga', () => {
    const estado = tableroDe(['####', '0000', '0000'], 2, RECARGANDO);

    for (const nivel of NIVELES_IA.filter((valor) => valor > 1)) {
      expect(new JugadorIA(nivel).elegirJugada(estado).usarOnda).toBe(false);
    }
  });

  it('el nivel 5 lo gasta donde mas tablero puede abrir', () => {
    // Las celdas libres son toda la fila superior; la de enmedio es la que
    // mas vecinas ocultas tiene y por tanto la que mas cascada promete.
    const estado = tableroDe(['#####', '00000', '#####'], 2);

    const decision = new JugadorIA(5).elegirJugada(estado);

    expect(decision.usarOnda).toBe(true);
    // Ni (0,0) ni (4,0): las esquinas abren menos.
    expect(decision.celda.x).toBeGreaterThan(0);
    expect(decision.celda.x).toBeLessThan(4);
  });
});
