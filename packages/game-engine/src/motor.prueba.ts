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
    expect(estado.jugadores.map((jugador) => jugador.minasEncontradas)).toEqual([0, 0, 0]);
    // Todos empiezan con la onda expansiva lista.
    expect(estado.jugadores.every((jugador) => jugador.onda.estado === 'disponible')).toBe(
      true,
    );
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

describe('MotorJuego: el clic normal solo destapa una celda', () => {
  it('no arrastra nada aunque la celda no tenga minas alrededor', () => {
    // Con SIN_AZAR y primer clic en (2,2), las minas caen en (0,0) y (1,0):
    //   M M .
    //   . . .
    //   . . C
    // (2,2) no tiene ninguna mina alrededor, pero sin la onda no propaga.
    const partida = MotorJuego.crearPartida(3, 3, 2, 2, { aleatorio: SIN_AZAR });
    const resultado = partida.clicCelda(2, 2);

    expect(resultado.codigo).toBe('CELDA_DESPEJADA');
    expect(resultado.celdasReveladas).toEqual([{ x: 2, y: 2 }]);
    expect(resultado.ondaUsada).toBe(false);

    const estado = partida.obtenerEstado();
    expect(estado.celdas[2]?.[2]?.minasAdyacentes).toBe(0);
    // Las vecinas siguen tapadas.
    expect(estado.celdas[1]?.[1]?.estado).toBe('oculta');
    expect(estado.celdas[2]?.[1]?.estado).toBe('oculta');
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
  it('cede el turno al fallar y lo conserva al encontrar mina', () => {
    const partida = MotorJuego.crearPartida(3, 3, 2, 2, { aleatorio: SIN_AZAR });

    expect(partida.obtenerEstado().turnoDe).toBe(0);

    // Celda sin mina: J0 cede el turno.
    const fallo = partida.clicCelda(2, 2);
    expect(fallo.turnoDe).toBe(1);
    expect(fallo.repite).toBe(false);

    // Mina: J1 sigue jugando.
    const acierto = partida.clicCelda(0, 0);
    expect(acierto.turnoDe).toBe(1);
    expect(acierto.repite).toBe(true);
  });

  it('encadena tantos turnos como minas seguidas encuentre', () => {
    // 4x1 con SIN_AZAR y primer clic en (3,0): minas en (0,0) y (1,0).
    const partida = MotorJuego.crearPartida(4, 1, 2, 2, { aleatorio: SIN_AZAR });

    partida.clicCelda(3, 0); // J0 falla y cede
    partida.clicCelda(0, 0); // J1 acierta y repite
    const segunda = partida.clicCelda(1, 0); // J1 vuelve a acertar

    expect(segunda.jugador).toBe(1);
    expect(partida.obtenerEstado().jugadores[1]?.minasEncontradas).toBe(2);
    expect(partida.obtenerEstado().jugadores[0]?.minasEncontradas).toBe(0);
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

    partida.clicCelda(3, 0); // J0, sin mina: cede el turno
    partida.clicCelda(0, 0); // J1, mina: repite
    expect(partida.estaTerminada()).toBe(false);
    partida.clicCelda(1, 0); // J1 otra vez, mina: se agotan las minas

    expect(partida.estaTerminada()).toBe(true);
    expect(partida.obtenerEstado().minasRestantes).toBe(0);
    expect(partida.obtenerGanador()).toBe(1);
    expect(partida.obtenerEstado().empate).toBe(false);
  });

  it('no termina aunque el lider saque una ventaja imposible de remontar', () => {
    // 3x2 con SIN_AZAR y primer clic en (2,1): minas en toda la fila superior.
    //   M M M
    //   . . C
    const partida = MotorJuego.crearPartida(3, 2, 3, 2, { aleatorio: SIN_AZAR });

    partida.clicCelda(2, 1); // J0, sin mina: cede
    partida.clicCelda(1, 1); // J1, sin mina: cede
    partida.clicCelda(0, 0); // J0, mina -> J0 = 1, y repite
    const penultimo = partida.clicCelda(1, 0); // J0, mina -> J0 = 2

    // A J1 ya no le da tiempo a alcanzarle, pero queda una mina y eso manda:
    // la partida no se corta sola. Quien quiera salir antes, que se rinda.
    expect(penultimo.terminada).toBe(false);
    expect(partida.obtenerEstado().minasRestantes).toBe(1);
    expect(partida.obtenerGanador()).toBeNull();

    const ultimo = partida.clicCelda(2, 0); // J0 se lleva tambien la ultima
    expect(ultimo.terminada).toBe(true);
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
    partida.clicCelda(1, 0);

    expect(
      partida.obtenerClasificacion().map(({ id, minasEncontradas }) => ({
        id,
        minasEncontradas,
      })),
    ).toEqual([
      { id: 0, minasEncontradas: 2 },
      { id: 1, minasEncontradas: 0 },
    ]);
  });
});

describe('MotorJuego: rendicion', () => {
  it('a quien se rinde deja de llegarle el turno', () => {
    // 3x2 con tres jugadores; la fila de abajo no tiene minas.
    const partida = MotorJuego.crearPartida(3, 2, 3, 3, { aleatorio: SIN_AZAR });

    partida.clicCelda(2, 1); // J0 falla y cede a J1
    expect(partida.obtenerEstado().turnoDe).toBe(1);

    partida.rendirse(1); // se rinde justo cuando le tocaba
    expect(partida.obtenerEstado().turnoDe).toBe(2);

    partida.clicCelda(1, 1); // J2 falla: el turno se salta a J1 y vuelve a J0
    expect(partida.obtenerEstado().turnoDe).toBe(0);
  });

  it('rendirse cuando no es tu turno no se lo quita a nadie', () => {
    const partida = MotorJuego.crearPartida(3, 2, 3, 3, { aleatorio: SIN_AZAR });

    partida.rendirse(2); // le toca a J0
    expect(partida.obtenerEstado().turnoDe).toBe(0);

    partida.clicCelda(2, 1); // J0 falla
    expect(partida.obtenerEstado().turnoDe).toBe(1);
    partida.clicCelda(1, 1); // J1 falla: J2 esta fuera, vuelve a J0
    expect(partida.obtenerEstado().turnoDe).toBe(0);
  });

  it('quedarse solo uno en pie termina la partida y ese gana', () => {
    // 4x1 con SIN_AZAR y primer clic en (3,0): minas en (0,0) y (1,0).
    const partida = MotorJuego.crearPartida(4, 1, 2, 2, { aleatorio: SIN_AZAR });

    partida.clicCelda(3, 0); // J0 falla y cede
    partida.clicCelda(0, 0); // J1 encuentra mina: va ganando 1 a 0

    partida.rendirse(1);

    // Gana el que se queda, aunque fuera perdiendo y queden minas sin destapar.
    expect(partida.estaTerminada()).toBe(true);
    expect(partida.obtenerGanador()).toBe(0);
    expect(partida.obtenerEstado().empate).toBe(false);
    expect(partida.obtenerEstado().minasRestantes).toBe(1);
    expect(partida.obtenerEstado().jugadores[1]?.minasEncontradas).toBe(1);
    expect(partida.obtenerEstado().jugadores[0]?.minasEncontradas).toBe(0);
  });

  it('quien se rindio no gana aunque acabe con mas minas que nadie', () => {
    // Tres jugadores: J0 se lleva una mina y se va; J1 y J2 siguen.
    const partida = MotorJuego.crearPartida(4, 1, 2, 3, { aleatorio: SIN_AZAR });

    partida.clicCelda(3, 0); // J0 falla y cede
    partida.clicCelda(0, 0); // J1 mina -> J1 = 1, repite
    partida.rendirse(1); // se va lider

    expect(partida.estaTerminada()).toBe(false); // aun quedan J0 y J2
    partida.clicCelda(1, 0); // el turno es de J2, que se lleva la ultima

    expect(partida.estaTerminada()).toBe(true);
    expect(partida.obtenerEstado().jugadores[1]?.minasEncontradas).toBe(1);
    expect(partida.obtenerEstado().jugadores[2]?.minasEncontradas).toBe(1);
    // J1 empataria a una mina, pero esta fuera: gana J2.
    expect(partida.obtenerGanador()).toBe(2);
  });

  it('el estado dice quien se rindio', () => {
    const partida = MotorJuego.crearPartida(3, 2, 3, 3, { aleatorio: SIN_AZAR });

    partida.rendirse(2);

    const jugadores = partida.obtenerEstado().jugadores;
    expect(jugadores.map((jugador) => jugador.rendido)).toEqual([false, false, true]);
    expect(partida.jugadoresActivos()).toEqual([0, 1]);
    expect(partida.estaRendido(2)).toBe(true);
  });

  it('al rendirse suelta la onda que tuviera armada', () => {
    const partida = MotorJuego.crearPartida(3, 2, 3, 3, { aleatorio: SIN_AZAR });

    partida.activarOnda(); // la arma J0, que es quien tiene el turno
    expect(partida.estadoDeLaOnda(0).estado).toBe('activo');

    partida.rendirse(0);

    expect(partida.estadoDeLaOnda(0).estado).toBe('disponible');
  });

  it('no se puede rendir dos veces, ni un jugador que no existe', () => {
    const partida = MotorJuego.crearPartida(3, 2, 3, 3, { aleatorio: SIN_AZAR });

    partida.rendirse(2);

    expect(() => partida.rendirse(2)).toThrowError(ErrorPartida);
    expect(() => partida.rendirse(7)).toThrowError(ErrorPartida);
  });

  it('no se puede rendir con la partida ya terminada', () => {
    const partida = MotorJuego.crearPartida(4, 1, 2, 2, { aleatorio: SIN_AZAR });
    partida.clicCelda(3, 0);
    partida.clicCelda(0, 0);
    partida.clicCelda(1, 0);

    expect(partida.estaTerminada()).toBe(true);
    expect(() => partida.rendirse(0)).toThrowError(ErrorPartida);
  });
});

describe('MotorJuego: reloj de turno', () => {
  /** Reloj falso: el motor nunca llama a Date.now(), asi que esto lo gobierna. */
  const relojFalso = (): { ahora: () => number; avanzar: (ms: number) => void } => {
    let instante = 1_000;
    return {
      ahora: () => instante,
      avanzar: (ms: number) => {
        instante += ms;
      },
    };
  };

  it('sin limite de tiempo no hay cuenta atras que valga', () => {
    const reloj = relojFalso();
    const partida = MotorJuego.crearPartida(3, 3, 2, 2, { ahora: reloj.ahora });

    expect(partida.obtenerEstado().tiempoPorTurnoMs).toBe(0);
    expect(partida.obtenerEstado().tiempoRestanteMs).toBeNull();

    reloj.avanzar(60 * 60 * 1000);
    expect(partida.comprobarTiempoDeTurno()).toBe(false);
    expect(partida.obtenerEstado().turnoDe).toBe(0);
  });

  it('descuenta el tiempo del turno en curso', () => {
    const reloj = relojFalso();
    const partida = MotorJuego.crearPartida(3, 3, 2, 2, {
      ahora: reloj.ahora,
      tiempoPorTurnoSegundos: 10,
    });

    expect(partida.obtenerEstado().tiempoRestanteMs).toBe(10_000);
    reloj.avanzar(4_000);
    expect(partida.obtenerEstado().tiempoRestanteMs).toBe(6_000);
  });

  it('quien se queda pensando de mas pierde el turno sin jugar', () => {
    const reloj = relojFalso();
    const partida = MotorJuego.crearPartida(3, 3, 2, 2, {
      ahora: reloj.ahora,
      aleatorio: SIN_AZAR,
      tiempoPorTurnoSegundos: 10,
    });

    reloj.avanzar(9_999);
    expect(partida.comprobarTiempoDeTurno()).toBe(false);
    expect(partida.obtenerEstado().turnoDe).toBe(0);

    reloj.avanzar(1);
    expect(partida.comprobarTiempoDeTurno()).toBe(true);
    expect(partida.obtenerEstado().turnoDe).toBe(1);
    // El turno nuevo arranca con el reloj entero y el tablero sigue intacto.
    expect(partida.obtenerEstado().tiempoRestanteMs).toBe(10_000);
    expect(
      partida.obtenerEstado().celdas.flat().every((celda) => celda.estado === 'oculta'),
    ).toBe(true);
  });

  it('cada clic reinicia el reloj, tambien cuando el jugador repite', () => {
    const reloj = relojFalso();
    const partida = MotorJuego.crearPartida(4, 1, 2, 2, {
      ahora: reloj.ahora,
      aleatorio: SIN_AZAR,
      tiempoPorTurnoSegundos: 10,
    });

    reloj.avanzar(7_000);
    partida.clicCelda(3, 0); // J0 falla y cede el turno
    expect(partida.obtenerEstado().tiempoRestanteMs).toBe(10_000);

    reloj.avanzar(7_000);
    partida.clicCelda(0, 0); // J1 acierta y conserva el turno
    expect(partida.obtenerEstado().turnoDe).toBe(1);
    expect(partida.obtenerEstado().tiempoRestanteMs).toBe(10_000);
  });

  it('la onda armada sobrevive a perder el turno por tiempo', () => {
    const reloj = relojFalso();
    const partida = MotorJuego.crearPartida(3, 3, 2, 2, {
      ahora: reloj.ahora,
      tiempoPorTurnoSegundos: 10,
    });

    partida.activarOnda(); // la arma J0
    reloj.avanzar(10_000);
    expect(partida.comprobarTiempoDeTurno()).toBe(true);

    // No llego a gastarla, asi que le sigue esperando en su proximo turno.
    expect(partida.obtenerEstado().jugadores[0]?.onda.estado).toBe('activo');
    expect(partida.obtenerEstado().jugadores[1]?.onda.estado).toBe('disponible');
  });

  it('deja de contar cuando la partida ha terminado', () => {
    const reloj = relojFalso();
    const partida = MotorJuego.crearPartida(4, 1, 2, 2, {
      ahora: reloj.ahora,
      aleatorio: SIN_AZAR,
      tiempoPorTurnoSegundos: 10,
    });

    partida.clicCelda(3, 0);
    partida.clicCelda(0, 0);
    partida.clicCelda(1, 0);

    expect(partida.estaTerminada()).toBe(true);
    expect(partida.obtenerEstado().tiempoRestanteMs).toBeNull();
    reloj.avanzar(60_000);
    expect(partida.comprobarTiempoDeTurno()).toBe(false);
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
describe('MotorJuego: revelado final', () => {
  it('al terminar destapa el tablero entero', () => {
    // 4x1 con SIN_AZAR y primer clic en (3,0): minas en (0,0) y (1,0).
    const partida = MotorJuego.crearPartida(4, 1, 2, 2, { aleatorio: SIN_AZAR });

    partida.clicCelda(3, 0); // J0, sin mina: cede
    // Con la partida en marcha, lo que no se ha tocado sigue tapado.
    expect(partida.obtenerEstado().celdas[0]?.[2]?.estado).toBe('oculta');

    partida.clicCelda(0, 0); // J1, mina: repite
    partida.clicCelda(1, 0); // J1, ultima mina: se acaba

    const celdas = partida.obtenerEstado().celdas.flat();
    expect(celdas.some((celda) => celda.estado === 'oculta')).toBe(false);

    // La celda que nadie llego a tocar se ve con su numero.
    const nuncaTocada = partida.obtenerEstado().celdas[0]?.[2];
    expect(nuncaTocada?.estado).toBe('despejada');
    expect(nuncaTocada?.minasAdyacentes).toBe(1);
  });

  it('ensena sin duenno las minas que no encontro nadie', () => {
    // Se acaba por quedarse uno solo, asi que queda una mina sin destapar.
    const partida = MotorJuego.crearPartida(4, 1, 2, 2, { aleatorio: SIN_AZAR });

    partida.clicCelda(3, 0); // J0, sin mina: cede
    partida.clicCelda(0, 0); // J1, mina
    partida.rendirse(1);

    expect(partida.estaTerminada()).toBe(true);

    const encontrada = partida.obtenerEstado().celdas[0]?.[0];
    expect(encontrada?.estado).toBe('mina-encontrada');
    expect(encontrada?.encontradaPor).toBe(1);

    const huerfana = partida.obtenerEstado().celdas[0]?.[1];
    expect(huerfana?.estado).toBe('mina-sin-encontrar');
    expect(huerfana?.encontradaPor).toBeNull();
    expect(huerfana?.minasAdyacentes).toBeNull();
  });
});
