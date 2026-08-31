import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ServicioPartida, type ConfiguracionPartida } from './partida.servicio';

/** Configuracion base: todo humanos, para que nada se mueva solo. */
function configuracion(cambios: Partial<ConfiguracionPartida> = {}): ConfiguracionPartida {
  return {
    ancho: 5,
    alto: 5,
    minas: 4,
    numJugadores: 2,
    numHumanos: 2,
    nivelIA: 3,
    retardoBotsMs: 0,
    ...cambios,
  };
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
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    servicio = TestBed.inject(ServicioPartida);
  });

  afterEach(() => {
    servicio.abandonar();
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

    vi.runOnlyPendingTimers();

    expect(servicio.estado()?.turnoDe).toBe(0);
    expect(servicio.esTurnoDeBot()).toBe(false);
    expect(servicio.ultimoSuceso()?.jugador).toBe(1);
  });

  it('sin humanos la partida se juega sola hasta el final', () => {
    servicio.iniciar(configuracion({ numJugadores: 2, numHumanos: 0, retardoBotsMs: 10 }));

    // Cada turno programa el siguiente, asi que basta con dejar correr el reloj.
    vi.advanceTimersByTime(60_000);

    expect(servicio.estado()?.terminada).toBe(true);
  });

  it('con humanos en la mesa el bot no espera', () => {
    servicio.iniciar(
      configuracion({ numJugadores: 2, numHumanos: 1, retardoBotsMs: 5000 }),
    );
    servicio.clicEnCelda(2, 2);

    // El retardo configurado se ignora si juega alguien: el temporizador es de 0.
    vi.advanceTimersByTime(0);

    expect(servicio.estado()?.turnoDe).toBe(0);
  });

  it('el bot solo juega cuando le toca', () => {
    servicio.iniciar(configuracion({ numJugadores: 2, numHumanos: 1 }));

    // Turno del humano: pedir la jugada del bot no hace nada.
    expect(servicio.jugarTurnoDeBot()).toBe(false);
    expect(servicio.estado()?.turnoDe).toBe(0);
  });

  it('abandonar corta el turno pendiente del bot', () => {
    servicio.iniciar(configuracion({ numJugadores: 2, numHumanos: 0, retardoBotsMs: 100 }));

    servicio.abandonar();
    vi.advanceTimersByTime(10_000);

    expect(servicio.estado()).toBeNull();
  });
});
