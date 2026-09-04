import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ServicioPartida, type ConfiguracionPartida } from './partida.servicio';

/** Configuracion base: todo humanos y sin reloj, para que nada se mueva solo. */
function configuracion(cambios: Partial<ConfiguracionPartida> = {}): ConfiguracionPartida {
  return {
    ancho: 5,
    alto: 5,
    minas: 4,
    numJugadores: 2,
    numHumanos: 2,
    nivelesIA: [3, 3, 3, 3],
    recargaOndaSegundos: 20,
    tiempoPorTurnoSegundos: 0,
    ...cambios,
  };
}

/**
 * Clica celdas ocultas hasta que le vuelva a tocar a ese jugador.
 *
 * Hace falta porque las minas se reparten al azar y ahora quien acierta
 * conserva el turno: no se puede dar por hecho que el turno alterne.
 */
function devolverElTurnoA(servicio: ServicioPartida, jugador: number): void {
  for (let intento = 0; intento < 50; intento += 1) {
    const estado = servicio.estado();
    if (estado === null || estado.terminada || estado.turnoDe === jugador) {
      return;
    }
    const oculta = estado.celdas.flat().find((celda) => celda.estado === 'oculta');
    if (oculta === undefined) {
      return;
    }
    servicio.clicEnCelda(oculta.x, oculta.y);
  }
}

describe('ServicioPartida', () => {
  let servicio: ServicioPartida;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    servicio = TestBed.inject(ServicioPartida);
  });

  it('no tiene partida hasta que se inicia una', () => {
    expect(servicio.hayPartida()).toBe(false);
    expect(servicio.estado()).toBeNull();
  });

  it('publica el estado inicial al iniciar la partida', () => {
    servicio.iniciar(configuracion({ numJugadores: 3, numHumanos: 3 }));

    const estado = servicio.estado();
    expect(servicio.hayPartida()).toBe(true);
    expect(estado?.ancho).toBe(5);
    expect(estado?.minasRestantes).toBe(4);
    expect(estado?.jugadores).toHaveLength(3);
    expect(estado?.turnoDe).toBe(0);
  });

  it('refresca el estado y guarda el suceso tras un clic valido', () => {
    servicio.iniciar(configuracion());

    expect(servicio.clicEnCelda(0, 0)).toBe(true);
    expect(servicio.estado()?.turnoDe).toBe(1);
    expect(servicio.ultimoSuceso()?.jugador).toBe(0);
    expect(servicio.ultimoError()).toBeNull();
  });

  it('deja el codigo de error y no cambia de turno si el clic es invalido', () => {
    servicio.iniciar(configuracion());
    servicio.clicEnCelda(0, 0);
    const turnoAntes = servicio.estado()?.turnoDe;

    expect(servicio.clicEnCelda(0, 0)).toBe(false);
    expect(servicio.ultimoError()).toBe('CELDA_YA_REVELADA');
    expect(servicio.estado()?.turnoDe).toBe(turnoAntes);
  });

  it('guarda el suceso como codigo, sin texto ya traducido', () => {
    servicio.iniciar(configuracion());
    servicio.clicEnCelda(2, 2);

    expect(servicio.ultimoSuceso()?.codigo).toBe('CELDA_DESPEJADA');
  });

  it('la revancha reparte un tablero nuevo con los mismos ajustes', () => {
    servicio.iniciar(configuracion({ ancho: 6, alto: 4, minas: 5 }));
    servicio.clicEnCelda(0, 0);

    servicio.revancha();

    const estado = servicio.estado();
    expect(estado?.ancho).toBe(6);
    expect(estado?.alto).toBe(4);
    expect(estado?.minasRestantes).toBe(5);
    expect(estado?.turnoDe).toBe(0);
    expect(estado?.celdas.flat().every((celda) => celda.estado === 'oculta')).toBe(true);
  });

  it('abandonar descarta la partida', () => {
    servicio.iniciar(configuracion());

    servicio.abandonar();

    expect(servicio.hayPartida()).toBe(false);
    expect(servicio.estado()).toBeNull();
  });
});

describe('ServicioPartida: bots', () => {
  let servicio: ServicioPartida;

  beforeEach(() => {
    vi.useFakeTimers();
    // Con Math.random fijo a 0 el retardo del bot es 0 y no hay que andar
    // adivinando cuanto avanzar el reloj en cada prueba.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    servicio = TestBed.inject(ServicioPartida);
  });

  afterEach(() => {
    servicio.abandonar();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('los ultimos puestos son los que lleva la IA', () => {
    servicio.iniciar(configuracion({ numJugadores: 4, numHumanos: 2 }));

    expect(servicio.esBot(0)).toBe(false);
    expect(servicio.esBot(1)).toBe(false);
    expect(servicio.esBot(2)).toBe(true);
    expect(servicio.esBot(3)).toBe(true);
  });

  it('avisa de que el tablero esta en manos de un bot', () => {
    servicio.iniciar(configuracion({ numJugadores: 2, numHumanos: 1 }));

    // Turno 0: humano.
    expect(servicio.esTurnoDeBot()).toBe(false);
    servicio.clicEnCelda(2, 2);

    // Ha pasado al bot, que aun no ha jugado porque el reloj esta parado.
    expect(servicio.estado()?.turnoDe).toBe(1);
    expect(servicio.esTurnoDeBot()).toBe(true);
  });

  it('el bot juega su turno y devuelve el control al humano', () => {
    servicio.iniciar(configuracion({ numJugadores: 2, numHumanos: 1 }));
    servicio.clicEnCelda(2, 2);

    // El bot encadena turnos mientras acierte, asi que se le deja jugar hasta
    // que falle: lo que se comprueba es que el control acaba volviendo.
    vi.advanceTimersByTime(1000);

    expect(servicio.ultimoSuceso()?.jugador).toBe(1);
    expect(servicio.esTurnoDeBot()).toBe(false);
  });

  it('sin humanos la partida se juega sola hasta el final', () => {
    servicio.iniciar(configuracion({ numJugadores: 2, numHumanos: 0 }));

    // Cada turno programa el siguiente, asi que basta con dejar correr el reloj.
    vi.advanceTimersByTime(60_000);

    expect(servicio.estado()?.terminada).toBe(true);
  });

  it('el bot se hace esperar antes de jugar, no responde al instante', () => {
    // 0.5 sobre el rango de 0 a 2000 ms: el bot tarda un segundo justo.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    servicio.iniciar(configuracion({ numJugadores: 2, numHumanos: 1 }));
    servicio.clicEnCelda(2, 2);

    vi.advanceTimersByTime(999);
    expect(servicio.ultimoSuceso()?.jugador).toBe(0); // sigue siendo el clic del humano

    vi.advanceTimersByTime(1);
    expect(servicio.ultimoSuceso()?.jugador).toBe(1);
  });

  it('la espera del bot nunca pasa de dos segundos', () => {
    // 0.999...: el peor caso posible del rango.
    vi.spyOn(Math, 'random').mockReturnValue(0.999999);
    servicio.iniciar(configuracion({ numJugadores: 2, numHumanos: 1 }));
    servicio.clicEnCelda(2, 2);

    vi.advanceTimersByTime(2000);

    expect(servicio.ultimoSuceso()?.jugador).toBe(1);
  });

  it('el bot solo juega cuando le toca', () => {
    servicio.iniciar(configuracion({ numJugadores: 2, numHumanos: 1 }));

    // Turno del humano: pedir la jugada del bot no hace nada.
    expect(servicio.jugarTurnoDeBot()).toBe(false);
    expect(servicio.estado()?.turnoDe).toBe(0);
  });

  it('cada bot puede jugar a un nivel distinto', () => {
    servicio.iniciar(
      configuracion({ numJugadores: 4, numHumanos: 1, nivelesIA: [1, 3, 5, 5] }),
    );

    expect(servicio.nivelDeBot(0)).toBeNull(); // el puesto humano
    expect(servicio.nivelDeBot(1)).toBe(1);
    expect(servicio.nivelDeBot(2)).toBe(3);
    expect(servicio.nivelDeBot(3)).toBe(5);
  });

  it('sin humanos reparte los niveles desde el primer puesto', () => {
    servicio.iniciar(
      configuracion({ numJugadores: 3, numHumanos: 0, nivelesIA: [2, 4, 5] }),
    );

    expect(servicio.nivelDeBot(0)).toBe(2);
    expect(servicio.nivelDeBot(1)).toBe(4);
    expect(servicio.nivelDeBot(2)).toBe(5);
  });

  it('abandonar corta el turno pendiente del bot', () => {
    servicio.iniciar(configuracion({ numJugadores: 2, numHumanos: 0 }));

    servicio.abandonar();
    vi.advanceTimersByTime(10_000);

    expect(servicio.estado()).toBeNull();
  });
});

describe('ServicioPartida: turnos', () => {
  let servicio: ServicioPartida;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    servicio = TestBed.inject(ServicioPartida);
  });

  afterEach(() => {
    servicio.abandonar();
  });

  it('quien encuentra mina conserva el turno y quien falla lo cede', () => {
    // Tablero saturado: tras el primer clic, casi cualquier celda es mina.
    servicio.iniciar(configuracion({ ancho: 5, alto: 5, minas: 20 }));
    servicio.clicEnCelda(0, 0); // el primer clic nunca es mina

    let huboMina = false;
    for (const celda of servicio.estado()?.celdas.flat() ?? []) {
      const estado = servicio.estado();
      if (celda.estado !== 'oculta' || estado === null || estado.terminada) {
        continue;
      }

      const antes = estado.turnoDe;
      servicio.clicEnCelda(celda.x, celda.y);

      if (servicio.ultimoSuceso()?.codigo === 'MINA_ENCONTRADA') {
        expect(servicio.estado()?.turnoDe).toBe(antes);
        huboMina = true;
        break;
      }
      expect(servicio.estado()?.turnoDe).not.toBe(antes);
    }

    expect(huboMina).toBe(true);
  });
});

describe('ServicioPartida: rendicion', () => {
  let servicio: ServicioPartida;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    servicio = TestBed.inject(ServicioPartida);
  });

  afterEach(() => {
    servicio.abandonar();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('rendirse saca del juego a quien tiene el turno', () => {
    servicio.iniciar(configuracion({ numJugadores: 3, numHumanos: 3 }));

    expect(servicio.rendirse()).toBe(true);

    expect(servicio.estado()?.jugadores[0]?.rendido).toBe(true);
    expect(servicio.jugadoresActivos().map((jugador) => jugador.id)).toEqual([1, 2]);
    expect(servicio.estado()?.turnoDe).toBe(1);
    expect(servicio.ultimoSuceso()?.codigo).toBe('JUGADOR_RENDIDO');
    expect(servicio.ultimoSuceso()?.jugador).toBe(0);
  });

  it('a quien se rindio no vuelve a llegarle el turno', () => {
    servicio.iniciar(configuracion({ numJugadores: 3, numHumanos: 3, minas: 1 }));
    servicio.clicEnCelda(0, 0); // J0 falla y cede a J1
    servicio.rendirse(); // se rinde J1

    expect(servicio.estado()?.turnoDe).toBe(2);
    servicio.clicEnCelda(4, 4); // J2 falla: se salta a J1 y vuelve a J0
    expect(servicio.estado()?.turnoDe).toBe(0);
  });

  it('quedarse solo uno termina la partida y ese gana', () => {
    servicio.iniciar(configuracion({ numJugadores: 2, numHumanos: 2 }));

    servicio.rendirse(); // se rinde J0

    expect(servicio.estado()?.terminada).toBe(true);
    expect(servicio.estado()?.ganador).toBe(1);
    expect(servicio.estado()?.empate).toBe(false);
  });

  it('si el humano se rinde y quedan bots, se queda de espectador', () => {
    servicio.iniciar(configuracion({ numJugadores: 3, numHumanos: 1 }));

    expect(servicio.soloMiran()).toBe(false);
    servicio.rendirse();

    // La partida sigue entre los dos bots y el humano ya no puede tocar nada.
    expect(servicio.estado()?.terminada).toBe(false);
    expect(servicio.soloMiran()).toBe(true);
    expect(servicio.esTurnoDeBot()).toBe(true);
  });

  it('con un solo humano se puede rendir mientras piensa el bot', () => {
    servicio.iniciar(configuracion({ numJugadores: 3, numHumanos: 1 }));
    servicio.clicEnCelda(0, 0); // el primer clic nunca es mina: cede al bot

    expect(servicio.esTurnoDeBot()).toBe(true);
    expect(servicio.humanoQuePuedeRendirse()).toBe(0);
    expect(servicio.rendirse()).toBe(true);
    expect(servicio.estado()?.jugadores[0]?.rendido).toBe(true);
    expect(servicio.ultimoSuceso()?.jugador).toBe(0);
  });

  it('con varios humanos no se rinde a nadie en el turno de un bot', () => {
    servicio.iniciar(configuracion({ numJugadores: 3, numHumanos: 2 }));
    // Con Math.random a 0 las minas caen todas en la primera fila, asi que
    // clicar por la ultima no acierta ninguna: los dos humanos ceden el turno
    // uno detras de otro y acaba tocandole al bot.
    servicio.clicEnCelda(4, 4);
    servicio.clicEnCelda(3, 4);

    expect(servicio.esTurnoDeBot()).toBe(true);
    expect(servicio.humanoQuePuedeRendirse()).toBeNull();
    expect(servicio.rendirse()).toBe(false);
    expect(servicio.estado()?.jugadores.some((jugador) => jugador.rendido)).toBe(false);
  });

  it('sin humanos en la mesa no hay a quien rendir', () => {
    servicio.iniciar(configuracion({ numJugadores: 2, numHumanos: 0 }));

    expect(servicio.humanoQuePuedeRendirse()).toBeNull();
    expect(servicio.rendirse()).toBe(false);
  });

  it('con el id explicito se rinde ese puesto, aunque no sea el suyo', () => {
    servicio.iniciar(configuracion({ numJugadores: 3, numHumanos: 3 }));

    expect(servicio.rendirse(2)).toBe(true);
    expect(servicio.estado()?.jugadores[2]?.rendido).toBe(true);
    expect(servicio.estado()?.turnoDe).toBe(0);
  });

  it('no se puede rendir con la partida terminada', () => {
    servicio.iniciar(configuracion({ numJugadores: 2, numHumanos: 2 }));
    servicio.rendirse(); // termina la partida

    expect(servicio.rendirse()).toBe(false);
    expect(servicio.ultimoError()).toBe('PARTIDA_TERMINADA');
  });
});

describe('ServicioPartida: reloj de turno', () => {
  let servicio: ServicioPartida;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    servicio = TestBed.inject(ServicioPartida);
  });

  afterEach(() => {
    servicio.abandonar();
    vi.useRealTimers();
  });

  it('publica la cuenta atras del turno', () => {
    servicio.iniciar(configuracion({ tiempoPorTurnoSegundos: 10 }));

    expect(servicio.segundosDeTurno()).toBe(10);
    expect(servicio.fraccionDeTurno()).toBe(1);

    vi.advanceTimersByTime(4000);

    expect(servicio.segundosDeTurno()).toBe(6);
    expect(servicio.fraccionDeTurno()).toBeCloseTo(0.6, 2);
  });

  it('al agotarse el tiempo pierde el turno sin jugar', () => {
    servicio.iniciar(configuracion({ tiempoPorTurnoSegundos: 5 }));

    vi.advanceTimersByTime(5000);

    expect(servicio.estado()?.turnoDe).toBe(1);
    expect(servicio.ultimoSuceso()?.codigo).toBe('TURNO_PERDIDO');
    expect(servicio.ultimoSuceso()?.jugador).toBe(0);
    // Nadie ha jugado: el tablero sigue entero.
    expect(
      servicio.estado()?.celdas.flat().every((celda) => celda.estado === 'oculta'),
    ).toBe(true);
  });

  it('sin reloj el turno no se pierde por mucho que se tarde', () => {
    servicio.iniciar(configuracion({ tiempoPorTurnoSegundos: 0 }));

    vi.advanceTimersByTime(120_000);

    expect(servicio.segundosDeTurno()).toBeNull();
    expect(servicio.fraccionDeTurno()).toBeNull();
    expect(servicio.estado()?.turnoDe).toBe(0);
  });

  it('cada jugada devuelve el reloj entero al que juega', () => {
    servicio.iniciar(configuracion({ tiempoPorTurnoSegundos: 10 }));

    vi.advanceTimersByTime(6000);
    servicio.clicEnCelda(2, 2);

    expect(servicio.segundosDeTurno()).toBe(10);
  });
});

describe('ServicioPartida: onda expansiva', () => {
  let servicio: ServicioPartida;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    servicio = TestBed.inject(ServicioPartida);
  });

  afterEach(() => {
    servicio.abandonar();
  });

  it('arranca con la onda del turno disponible', () => {
    servicio.iniciar(configuracion());

    expect(servicio.ondaDelTurno()?.estado).toBe('disponible');
    expect(servicio.segundosDeRecarga()).toBe(0);
  });

  it('activarlo no destapa nada: espera al clic', () => {
    servicio.iniciar(configuracion());

    expect(servicio.activarOnda()).toBe(true);
    expect(servicio.ondaDelTurno()?.estado).toBe('activo');
    expect(
      servicio.estado()?.celdas.flat().every((celda) => celda.estado === 'oculta'),
    ).toBe(true);
  });

  it('se puede desarmar sin gastarlo', () => {
    servicio.iniciar(configuracion());
    servicio.activarOnda();

    servicio.desactivarOnda();

    expect(servicio.ondaDelTurno()?.estado).toBe('disponible');
  });

  it('sin la onda el clic solo destapa la celda clicada', () => {
    servicio.iniciar(configuracion({ ancho: 8, alto: 8, minas: 5 }));

    servicio.clicEnCelda(4, 4);

    const destapadas = servicio
      .estado()
      ?.celdas.flat()
      .filter((celda) => celda.estado !== 'oculta');
    expect(destapadas).toHaveLength(1);
  });

  it('con la onda el clic arrastra la cascada y lo deja en recarga', () => {
    servicio.iniciar(configuracion({ ancho: 8, alto: 8, minas: 5 }));

    servicio.activarOnda();
    servicio.clicEnCelda(4, 4);

    const estado = servicio.estado();
    const destapadas = estado?.celdas.flat().filter((celda) => celda.estado !== 'oculta');
    // Las minas se reparten al azar, asi que la celda de salida puede tener o
    // no minas alrededor. Con un 0 tiene que arrastrar; con un numero, no hay
    // nada que propagar y la onda se pierde: es el riesgo de gastarlo a ciegas.
    const clicada = estado?.celdas[4]?.[4];
    if (clicada?.minasAdyacentes === 0) {
      expect(destapadas?.length ?? 0).toBeGreaterThan(1);
    } else {
      expect(destapadas).toHaveLength(1);
    }
    // En ambos casos la onda queda gastado.
    expect(servicio.estado()?.jugadores[0]?.onda.estado).toBe('recargando');
  });

  it('el suceso del despeje viaja como codigo propio', () => {
    servicio.iniciar(configuracion({ ancho: 8, alto: 8, minas: 5 }));

    servicio.activarOnda();
    servicio.clicEnCelda(4, 4);

    expect(servicio.ultimoSuceso()?.codigo).toBe('ONDA_EXPANSIVA');
  });

  it('rechaza activarlo mientras recarga y deja el codigo de error', () => {
    servicio.iniciar(configuracion({ ancho: 8, alto: 8, minas: 5, recargaOndaSegundos: 60 }));

    servicio.activarOnda();
    servicio.clicEnCelda(4, 4); // la gasta y cede el turno
    devolverElTurnoA(servicio, 0);

    expect(servicio.activarOnda()).toBe(false);
    expect(servicio.ultimoError()).toBe('ONDA_NO_DISPONIBLE');
  });

  it('el clic con onda la arma y la gasta en la misma celda', () => {
    servicio.iniciar(configuracion({ ancho: 8, alto: 8, minas: 5 }));

    expect(servicio.clicConOnda(4, 4)).toBe(true);

    expect(servicio.ultimoSuceso()?.codigo).toBe('ONDA_EXPANSIVA');
    expect(servicio.estado()?.jugadores[0]?.onda.estado).toBe('recargando');
  });

  it('el clic con onda no clica nada si la onda esta recargando', () => {
    servicio.iniciar(configuracion({ ancho: 8, alto: 8, minas: 5, recargaOndaSegundos: 60 }));
    servicio.clicConOnda(4, 4); // la gasta y cede el turno
    devolverElTurnoA(servicio, 0);

    const destapadasAntes =
      servicio.estado()?.celdas.flat().filter((celda) => celda.estado !== 'oculta').length ?? 0;
    const turnoAntes = servicio.estado()?.turnoDe;

    expect(servicio.clicConOnda(0, 7)).toBe(false);

    // Ni gasta el turno ni destapa: el jugador eligio esa celda para la onda.
    expect(servicio.ultimoError()).toBe('ONDA_NO_DISPONIBLE');
    expect(servicio.estado()?.turnoDe).toBe(turnoAntes);
    expect(
      servicio.estado()?.celdas.flat().filter((celda) => celda.estado !== 'oculta').length,
    ).toBe(destapadasAntes);
  });

  it('el clic con onda aprovecha la que ya estuviera armada', () => {
    servicio.iniciar(configuracion({ ancho: 8, alto: 8, minas: 5 }));
    servicio.activarOnda();

    expect(servicio.clicConOnda(4, 4)).toBe(true);
    expect(servicio.ultimoSuceso()?.codigo).toBe('ONDA_EXPANSIVA');
  });

  it('con recarga a cero vuelve a estar listo de inmediato', () => {
    servicio.iniciar(configuracion({ ancho: 8, alto: 8, minas: 5, recargaOndaSegundos: 0 }));

    servicio.activarOnda();
    servicio.clicEnCelda(4, 4);

    expect(servicio.estado()?.jugadores[0]?.onda.estado).toBe('disponible');
  });
});
