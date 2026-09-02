import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NIVELES_HISTORIA, TOTAL_NIVELES, obtenerNivel } from '@minehunt/game-engine';

import { ServicioHistoria } from './historia.servicio';
import { ServicioPartida } from './partida.servicio';

const CLAVE = 'minehunt.historia';

/** Primer nivel, que es el unico abierto al empezar. */
const NIVEL_1 = NIVELES_HISTORIA[0]!;

describe('ServicioHistoria', () => {
  let historia: ServicioHistoria;
  let partida: ServicioPartida;

  /**
   * Monta el servicio desde cero, leyendo lo que haya en localStorage.
   * Hace falta porque el progreso se carga en el constructor.
   */
  function crear(): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    historia = TestBed.inject(ServicioHistoria);
    partida = TestBed.inject(ServicioPartida);
  }

  beforeEach(() => {
    localStorage.clear();
    // Los bots juegan con setTimeout: con relojes falsos no se mueve nadie
    // salvo que la prueba lo pida, y cada jugada queda donde se espera.
    vi.useFakeTimers();
    crear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Gana el nivel en curso rindiendo al rival.
   *
   * El primer clic de la partida nunca es mina (las minas se reparten
   * excluyendo esa celda), asi que despues de clicar una vez el turno esta
   * siempre en manos del bot y se le puede rendir. Al quedar un solo jugador
   * en pie la partida termina y gana el humano.
   */
  function ganarElNivel(): void {
    partida.clicEnCelda(0, 0);
    expect(partida.esTurnoDeBot()).toBe(true);
    partida.rendirse();
    TestBed.tick();
  }

  /** Pierde el nivel: se rinde el humano y gana el bot, que queda solo. */
  function perderElNivel(): void {
    partida.rendirse();
    TestBed.tick();
  }

  it('empieza con el primer nivel abierto y nada superado', () => {
    expect(historia.progreso()).toEqual({ desbloqueado: 1, superados: [] });
    expect(historia.estaDesbloqueado(1)).toBe(true);
    expect(historia.estaDesbloqueado(2)).toBe(false);
    expect(historia.totalSuperados()).toBe(0);
    expect(historia.completada()).toBe(false);
    expect(historia.nivelEnCurso()).toBeNull();
  });

  it('monta la partida con los ajustes del nivel', () => {
    expect(historia.jugar(NIVEL_1)).toBe(true);

    expect(historia.nivelEnCurso()).toEqual(NIVEL_1);
    expect(partida.configuracion()).toEqual({
      ancho: NIVEL_1.ancho,
      alto: NIVEL_1.alto,
      minas: NIVEL_1.minas,
      numJugadores: NIVEL_1.rivales.length + 1,
      numHumanos: 1,
      nivelesIA: NIVEL_1.rivales,
      recargaOndaSegundos: NIVEL_1.recargaOndaSegundos,
      tiempoPorTurnoSegundos: NIVEL_1.tiempoPorTurnoSegundos,
    });
    // El jugador se sienta siempre en el puesto 0 y los rivales detras.
    expect(partida.esBot(0)).toBe(false);
    expect(partida.esBot(1)).toBe(true);
  });

  it('no deja entrar a un nivel que sigue bloqueado', () => {
    const nivel2 = obtenerNivel(2);

    expect(nivel2).not.toBeNull();
    expect(historia.jugar(nivel2!)).toBe(false);
    expect(partida.hayPartida()).toBe(false);
    expect(historia.nivelEnCurso()).toBeNull();
  });

  it('ganar un nivel lo apunta y abre el siguiente', () => {
    historia.jugar(NIVEL_1);

    ganarElNivel();

    expect(partida.estado()?.ganador).toBe(0);
    expect(historia.progreso()).toEqual({ desbloqueado: 2, superados: [1] });
    expect(historia.estaSuperado(1)).toBe(true);
    expect(historia.estaDesbloqueado(2)).toBe(true);
  });

  it('perder no mueve el progreso', () => {
    historia.jugar(NIVEL_1);

    perderElNivel();

    expect(partida.estado()?.terminada).toBe(true);
    expect(partida.estado()?.ganador).not.toBe(0);
    expect(historia.progreso()).toEqual({ desbloqueado: 1, superados: [] });
  });

  it('lo ganado sigue ahi en la siguiente sesion', () => {
    historia.jugar(NIVEL_1);
    ganarElNivel();

    crear();

    expect(historia.progreso()).toEqual({ desbloqueado: 2, superados: [1] });
  });

  it('no apunta dos veces el mismo final de partida', () => {
    historia.jugar(NIVEL_1);
    ganarElNivel();
    TestBed.tick();
    TestBed.tick();

    expect(historia.progreso().superados).toEqual([1]);
  });

  it('una revancha del nivel se vuelve a apuntar', () => {
    historia.jugar(NIVEL_1);
    perderElNivel();
    expect(historia.progreso().superados).toEqual([]);

    partida.revancha();
    TestBed.tick();
    ganarElNivel();

    expect(historia.progreso()).toEqual({ desbloqueado: 2, superados: [1] });
  });

  it('no apunta nada si la partida no es de Historia', () => {
    partida.iniciar({
      ancho: 5,
      alto: 5,
      minas: 4,
      numJugadores: 2,
      numHumanos: 1,
      nivelesIA: [1],
      recargaOndaSegundos: 20,
      tiempoPorTurnoSegundos: 0,
    });

    perderElNivel();

    expect(historia.progreso()).toEqual({ desbloqueado: 1, superados: [] });
  });

  it('salir deja el modo en reposo', () => {
    historia.jugar(NIVEL_1);

    historia.salir();

    expect(historia.nivelEnCurso()).toBeNull();
    expect(partida.hayPartida()).toBe(false);
  });

  it('siguienteDe encadena los niveles y se para en el ultimo', () => {
    expect(historia.siguienteDe(1)?.numero).toBe(2);
    expect(historia.siguienteDe(TOTAL_NIVELES)).toBeNull();
  });

  it('borrar el progreso vuelve a dejar solo el primer nivel', () => {
    historia.jugar(NIVEL_1);
    ganarElNivel();

    historia.reiniciarProgreso();

    expect(historia.progreso()).toEqual({ desbloqueado: 1, superados: [] });
    expect(localStorage.getItem(CLAVE)).toBeNull();
  });

  it('descarta un progreso guardado que no sea ni JSON', () => {
    localStorage.setItem(CLAVE, 'esto no es json');

    crear();

    expect(historia.progreso()).toEqual({ desbloqueado: 1, superados: [] });
  });

  /**
   * Un progreso inventado desbloquearia niveles sin jugarlos, asi que si algo
   * no cuadra se descarta el lote entero y se empieza de cero.
   */
  it('descarta un progreso imposible', () => {
    const imposibles: unknown[] = [
      { desbloqueado: 0, superados: [] },
      { desbloqueado: TOTAL_NIVELES + 1, superados: [] },
      { desbloqueado: 2.5, superados: [] },
      { desbloqueado: 3, superados: [1, 1] },
      { desbloqueado: 3, superados: [1, 99] },
      { desbloqueado: 2, superados: [1, 5] }, // superado un nivel aun cerrado
      { desbloqueado: 3 },
      { superados: [1] },
      [1, 2, 3],
      'progreso',
    ];

    for (const guardado of imposibles) {
      localStorage.setItem(CLAVE, JSON.stringify(guardado));
      crear();
      expect(historia.progreso(), JSON.stringify(guardado)).toEqual({
        desbloqueado: 1,
        superados: [],
      });
    }
  });

  it('aguanta que el navegador bloquee el almacenamiento', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });

    crear();
    historia.jugar(NIVEL_1);

    expect(() => {
      ganarElNivel();
    }).not.toThrow();
    // Sin almacenamiento el progreso vale, pero solo para esta sesion.
    expect(historia.progreso()).toEqual({ desbloqueado: 2, superados: [1] });

    vi.restoreAllMocks();
  });
});
