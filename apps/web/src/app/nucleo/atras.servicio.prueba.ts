import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { ServicioBotonAtras } from './atras.servicio';
import { ServicioPartida, type ConfiguracionPartida } from './partida.servicio';

/** Partida minima, solo para que el servicio vea que hay uno en curso. */
const PARTIDA: ConfiguracionPartida = {
  ancho: 5,
  alto: 5,
  minas: 4,
  numJugadores: 2,
  numHumanos: 2,
  nivelesIA: [],
  recargaOndaSegundos: 20,
  tiempoPorTurnoSegundos: 0,
};

describe('ServicioBotonAtras', () => {
  let atras: ServicioBotonAtras;
  let partida: ServicioPartida;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    });
    atras = TestBed.inject(ServicioBotonAtras);
    partida = TestBed.inject(ServicioPartida);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    partida.abandonar();
  });

  it('desde el menu principal sale de la aplicacion', () => {
    expect(atras.destinoDesde('/')).toBe('salir-de-la-app');
    expect(atras.destinoDesde('')).toBe('salir-de-la-app');
  });

  it('desde las demas pantallas vuelve al menu principal', () => {
    expect(atras.destinoDesde('/historia')).toBe('menu');
    expect(atras.destinoDesde('/entrenamiento')).toBe('menu');
    expect(atras.destinoDesde('/ayuda')).toBe('menu');
  });

  it('desde una partida en curso pide salir en lugar de irse', () => {
    partida.iniciar(PARTIDA);

    expect(atras.destinoDesde('/partida')).toBe('partida');

    atras.pulsar('/partida');
    expect(atras.salidaPedida()).toBe(true);

    // La atiende la pantalla de partida, que es quien sabe si hay que
    // preguntar y a donde volver.
    atras.salidaAtendida();
    expect(atras.salidaPedida()).toBe(false);
  });

  it('en /partida sin partida no pide nada y vuelve al menu', async () => {
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    expect(atras.destinoDesde('/partida')).toBe('menu');

    atras.pulsar('/partida');
    expect(atras.salidaPedida()).toBe(false);
    expect(navegar).toHaveBeenCalledWith(['/']);
  });

  it('vuelve al menu principal desde el mapa de niveles', () => {
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    atras.pulsar('/historia');

    expect(navegar).toHaveBeenCalledWith(['/']);
  });
});
