import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ServicioSonido } from './sonido.servicio';

const CLAVE = 'minehunt.sonido';

/**
 * Web Audio de mentira: jsdom no lo trae, y aqui no interesa como suena sino
 * que se pida sonar y que nada reviente cuando no se puede.
 */
class ContextoFalso {
  static creados = 0;
  static osciladores = 0;
  static fuentes = 0;

  readonly sampleRate = 48_000;
  readonly currentTime = 0;
  readonly destination = { nombre: 'destino' } as unknown as AudioDestinationNode;
  state: AudioContextState = 'running';

  constructor() {
    ContextoFalso.creados += 1;
  }

  createOscillator(): unknown {
    ContextoFalso.osciladores += 1;
    return {
      type: 'sine',
      frequency: { setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined },
      connect: (destino: unknown) => destino,
      start: () => undefined,
      stop: () => undefined,
    };
  }

  createBufferSource(): unknown {
    ContextoFalso.fuentes += 1;
    return {
      buffer: null,
      connect: (destino: unknown) => destino,
      start: () => undefined,
      stop: () => undefined,
    };
  }

  createGain(): unknown {
    return {
      gain: { setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined },
      connect: (destino: unknown) => destino,
    };
  }

  createBiquadFilter(): unknown {
    return {
      type: 'lowpass',
      frequency: {
        setValueAtTime: () => undefined,
        exponentialRampToValueAtTime: () => undefined,
      },
      Q: { setValueAtTime: () => undefined },
      connect: (destino: unknown) => destino,
    };
  }

  createBuffer(canales: number, muestras: number): AudioBuffer {
    return {
      getChannelData: () => new Float32Array(muestras),
    } as unknown as AudioBuffer;
  }

  resume(): Promise<void> {
    return Promise.resolve();
  }
}

function crear(): ServicioSonido {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  return TestBed.inject(ServicioSonido);
}

describe('ServicioSonido', () => {
  beforeEach(() => {
    localStorage.clear();
    ContextoFalso.creados = 0;
    ContextoFalso.osciladores = 0;
    ContextoFalso.fuentes = 0;
    (globalThis as { AudioContext?: unknown }).AudioContext = ContextoFalso;
  });

  afterEach(() => {
    delete (globalThis as { AudioContext?: unknown }).AudioContext;
  });

  it('viene encendido: un juego suena', () => {
    expect(crear().activo()).toBe(true);
  });

  it('recuerda que se apago', () => {
    const servicio = crear();

    servicio.alternar();

    expect(servicio.activo()).toBe(false);
    expect(localStorage.getItem(CLAVE)).toBe('no');
    expect(crear().activo()).toBe(false);
  });

  it('vuelve a sonar al encenderlo otra vez', () => {
    const servicio = crear();
    servicio.alternar();
    servicio.alternar();

    expect(servicio.activo()).toBe(true);
    expect(crear().activo()).toBe(true);
  });

  it('suena al despejar una celda', () => {
    crear().reproducirSuceso('CELDA_DESPEJADA');

    expect(ContextoFalso.osciladores).toBe(1);
  });

  /** La mina lleva ruido filtrado ademas del golpe grave. */
  it('la mina suena distinta a un clic normal', () => {
    crear().reproducirSuceso('MINA_ENCONTRADA');

    expect(ContextoFalso.fuentes).toBe(1);
    expect(ContextoFalso.osciladores).toBe(1);
  });

  it('el final suena con tres notas, y distintas segun quien gane', () => {
    const servicio = crear();

    servicio.reproducirFinal(true);

    expect(ContextoFalso.osciladores).toBe(3);
  });

  /** Apagado no es «suena bajito»: no se abre ni el contexto de audio. */
  it('apagado no reproduce nada', () => {
    const servicio = crear();
    servicio.alternar();

    servicio.reproducirSuceso('MINA_ENCONTRADA');
    servicio.reproducirFinal(false);

    expect(ContextoFalso.creados).toBe(0);
    expect(ContextoFalso.osciladores).toBe(0);
  });

  it('reutiliza el mismo contexto de audio', () => {
    const servicio = crear();

    servicio.reproducirSuceso('CELDA_DESPEJADA');
    servicio.reproducirSuceso('ONDA_EXPANSIVA');

    expect(ContextoFalso.creados).toBe(1);
  });

  /** Sin Web Audio el juego sigue: el sonido nunca es imprescindible. */
  it('no revienta si el navegador no trae Web Audio', () => {
    delete (globalThis as { AudioContext?: unknown }).AudioContext;
    const servicio = crear();

    expect(() => {
      servicio.reproducirSuceso('MINA_ENCONTRADA');
      servicio.reproducirFinal(true);
    }).not.toThrow();
  });
});
