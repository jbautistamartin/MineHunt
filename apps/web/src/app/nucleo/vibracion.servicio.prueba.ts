import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { VIBRADOR, type Vibrador } from './vibracion.plugin';
import { golpeDelSuceso, ServicioVibracion } from './vibracion.servicio';

/**
 * Un aparato de mentira: los tres caminos por los que se puede vibrar.
 *
 * Es la unica forma de probar aqui **el orden de los intentos**, que es justo
 * lo que no se puede comprobar con el telefono en la mano: desde fuera los tres
 * se parecen en que no vibran.
 */
function aparato(ajustes: Partial<Vibrador> = {}) {
  const doble = {
    esAndroid: true,
    conElPlugin: vi.fn().mockResolvedValue({ hayVibrador: true, via: 'efecto' }),
    conHaptics: vi.fn().mockResolvedValue(undefined),
    conElNavegador: vi.fn().mockReturnValue(true),
    ...ajustes,
  };
  return doble;
}

const CLAVE = 'minehunt.vibracion';

function crear(vibrador?: Vibrador): ServicioVibracion {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      // Sin aparato, el del navegador: ni Android ni nada que vibrar.
      { provide: VIBRADOR, useValue: vibrador ?? aparato({ esAndroid: false }) },
    ],
  });
  return TestBed.inject(ServicioVibracion);
}

describe('ServicioVibracion', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('viene encendida: un telefono que no responde al dedo parece roto', () => {
    expect(crear().activa()).toBe(true);
  });

  it('recuerda que se apago', () => {
    const servicio = crear();

    servicio.alternar();

    expect(servicio.activa()).toBe(false);
    expect(localStorage.getItem(CLAVE)).toBe('no');
    expect(crear().activa()).toBe(false);
  });

  it('vuelve a vibrar al encenderla otra vez', () => {
    const servicio = crear();
    servicio.alternar();
    servicio.alternar();

    expect(servicio.activa()).toBe(true);
    expect(crear().activa()).toBe(true);
  });

  /**
   * Las pruebas corren en jsdom, que no es la aplicacion de Android: aqui no
   * hay nada que vibrar y el interruptor no se ofrece. Es tambien lo que
   * garantiza que pedir un golpe desde el navegador no reviente.
   */
  it('en el navegador no hay vibracion que ofrecer', () => {
    const aparatoDePrueba = aparato({ esAndroid: false });
    const servicio = crear(aparatoDePrueba);

    expect(servicio.disponibleEnElAparato).toBe(false);
    expect(() => {
      servicio.vibrarSuceso('MINA_ENCONTRADA');
      servicio.vibrarFinal(true);
    }).not.toThrow();
    expect(aparatoDePrueba.conElPlugin).not.toHaveBeenCalled();
  });

  /**
   * El del proyecto y no @capacitor/haptics: aquel llama al vibrador sin
   * declarar atributos y Android se traga esas vibraciones con el telefono en
   * silencio, que es por donde se perdia el golpe sin dejar rastro.
   */
  it('en Android vibra con el plugin del proyecto, no con haptics', async () => {
    const aparatoDePrueba = aparato();
    const servicio = crear(aparatoDePrueba);

    servicio.vibrarSuceso('MINA_ENCONTRADA');

    await vi.waitFor(() => {
      expect(servicio.ultimoInforme()).toContain('plugin del proyecto');
    });
    expect(aparatoDePrueba.conElPlugin).toHaveBeenCalledWith(
      golpeDelSuceso('MINA_ENCONTRADA'),
    );
    expect(aparatoDePrueba.conHaptics).not.toHaveBeenCalled();
  });

  /** Un APK viejo puede no traer el plugin registrado: que vibre igual. */
  it('cae en haptics si el plugin del proyecto no responde', async () => {
    const aparatoDePrueba = aparato({
      conElPlugin: vi.fn().mockRejectedValue(new Error('no implementado')),
    });
    const servicio = crear(aparatoDePrueba);

    servicio.vibrarSuceso('MINA_ENCONTRADA');

    await vi.waitFor(() => {
      expect(servicio.ultimoInforme()).toContain('haptics');
    });
    expect(aparatoDePrueba.conHaptics).toHaveBeenCalledWith(
      golpeDelSuceso('MINA_ENCONTRADA'),
    );
  });

  /**
   * Un telefono sin vibrador es un caso legitimo, no un fallo, y hasta ahora
   * era indistinguible de que el juego no pidiera vibrar.
   */
  it('apunta que el aparato no tiene vibrador en vez de callarse', async () => {
    const servicio = crear(
      aparato({
        conElPlugin: vi.fn().mockResolvedValue({ hayVibrador: false, via: 'sin-vibrador' }),
      }),
    );

    servicio.vibrarSuceso('MINA_ENCONTRADA');

    await vi.waitFor(() => {
      expect(servicio.ultimoInforme()).toContain('no tiene vibrador');
    });
  });

  /** Nada de esto puede tumbar una partida: los tres caminos pueden fallar. */
  it('aguanta que fallen los tres caminos', async () => {
    const servicio = crear(
      aparato({
        conElPlugin: vi.fn().mockRejectedValue(new Error('no implementado')),
        conHaptics: vi.fn().mockRejectedValue(new Error('tampoco')),
        conElNavegador: vi.fn(() => {
          throw new Error('ni eso');
        }),
      }),
    );

    expect(() => {
      servicio.vibrarSuceso('MINA_ENCONTRADA');
    }).not.toThrow();
    await vi.waitFor(() => {
      expect(servicio.ultimoInforme()).not.toBeNull();
    });
  });
});

/**
 * El reparto de golpes se prueba solo, que no necesita telefono.
 *
 * Son milisegundos y no una tabla de estilos del plugin a proposito: `impact`
 * y `notification` estan pensados para el motor tactil de iOS, y en Android se
 * traducen a ondas de 21 a 35 ms que con el dedo en la pantalla no se notan.
 */
describe('golpeDelSuceso', () => {
  /** La mina es lo unico que puntua: se tiene que notar distinta. */
  it('la mina se nota mucho mas que un clic normal', () => {
    const mina = golpeDelSuceso('MINA_ENCONTRADA') ?? 0;
    const clic = golpeDelSuceso('CELDA_DESPEJADA') ?? 0;

    expect(mina).toBeGreaterThan(clic * 2);
  });

  it('la onda y la rendicion se notan mas que un clic', () => {
    const clic = golpeDelSuceso('CELDA_DESPEJADA') ?? 0;

    expect(golpeDelSuceso('ONDA_EXPANSIVA') ?? 0).toBeGreaterThan(clic);
    expect(golpeDelSuceso('JUGADOR_RENDIDO') ?? 0).toBeGreaterThan(clic);
  });

  it('perder el turno avisa, que es lo que hay que notar sin mirar', () => {
    expect(golpeDelSuceso('TURNO_PERDIDO') ?? 0).toBeGreaterThan(
      golpeDelSuceso('CELDA_DESPEJADA') ?? 0,
    );
  });

  /**
   * Por debajo de unos 20 ms no se distingue nada con el dedo apoyado, y por
   * encima de medio segundo cansa en un juego que es todo clics.
   */
  it('todos los golpes estan en la escala que se nota sin cansar', () => {
    const sucesos = [
      'MINA_ENCONTRADA',
      'CELDA_DESPEJADA',
      'ONDA_EXPANSIVA',
      'TURNO_PERDIDO',
      'JUGADOR_RENDIDO',
    ] as const;

    for (const suceso of sucesos) {
      const golpe = golpeDelSuceso(suceso);
      expect(golpe, suceso).not.toBeNull();
      expect(golpe ?? 0, suceso).toBeGreaterThanOrEqual(20);
      expect(golpe ?? 0, suceso).toBeLessThanOrEqual(500);
    }
  });
});
