import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ServicioPartida } from './partida.servicio';

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
    servicio.iniciar({ ancho: 5, alto: 5, minas: 4, numJugadores: 3 });

    const estado = servicio.estado();
    expect(servicio.hayPartida()).toBe(true);
    expect(estado?.ancho).toBe(5);
    expect(estado?.minasRestantes).toBe(4);
    expect(estado?.jugadores).toHaveLength(3);
    expect(estado?.turnoDe).toBe(0);
  });

  it('refresca el estado y guarda el suceso tras un clic valido', () => {
    servicio.iniciar({ ancho: 5, alto: 5, minas: 4, numJugadores: 2 });

    expect(servicio.clicEnCelda(0, 0)).toBe(true);
    expect(servicio.estado()?.turnoDe).toBe(1);
    expect(servicio.ultimoSuceso()?.jugador).toBe(0);
    expect(servicio.ultimoError()).toBeNull();
  });

  it('deja el codigo de error y no cambia de turno si el clic es invalido', () => {
    servicio.iniciar({ ancho: 5, alto: 5, minas: 4, numJugadores: 2 });
    servicio.clicEnCelda(0, 0);
    const turnoAntes = servicio.estado()?.turnoDe;

    expect(servicio.clicEnCelda(0, 0)).toBe(false);
    expect(servicio.ultimoError()).toBe('CELDA_YA_REVELADA');
    expect(servicio.estado()?.turnoDe).toBe(turnoAntes);
  });

  it('guarda el suceso como codigo, sin texto ya traducido', () => {
    servicio.iniciar({ ancho: 5, alto: 5, minas: 4, numJugadores: 2 });
    servicio.clicEnCelda(2, 2);

    expect(servicio.ultimoSuceso()?.codigo).toBe('CELDA_DESPEJADA');
  });

  it('la revancha reparte un tablero nuevo con los mismos ajustes', () => {
    servicio.iniciar({ ancho: 6, alto: 4, minas: 5, numJugadores: 2 });
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
    servicio.iniciar({ ancho: 5, alto: 5, minas: 4, numJugadores: 2 });

    servicio.abandonar();

    expect(servicio.hayPartida()).toBe(false);
    expect(servicio.estado()).toBeNull();
  });
});
