import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';

import { ServicioIdioma, detectarIdiomaInicial } from './idioma.servicio';

const CLAVE = 'minehunt.idioma';

/** Sustituye navigator.language durante una prueba. */
function fingirIdiomaDelDispositivo(valor: string): void {
  Object.defineProperty(globalThis.navigator, 'language', {
    value: valor,
    configurable: true,
  });
}

describe('deteccion del idioma inicial', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('usa espanol cuando el dispositivo esta en cualquier variante de es', () => {
    for (const variante of ['es', 'es-ES', 'es-MX', 'ES-es']) {
      fingirIdiomaDelDispositivo(variante);
      expect(detectarIdiomaInicial()).toBe('es');
    }
  });

  it('cae en ingles con cualquier otro idioma', () => {
    for (const variante of ['en-US', 'fr-FR', 'de', 'pt-BR', '']) {
      fingirIdiomaDelDispositivo(variante);
      expect(detectarIdiomaInicial()).toBe('en');
    }
  });

  it('la eleccion guardada manda sobre el idioma del dispositivo', () => {
    fingirIdiomaDelDispositivo('en-US');
    localStorage.setItem(CLAVE, 'es');

    expect(detectarIdiomaInicial()).toBe('es');
  });

  it('ignora un valor guardado que no sea un idioma soportado', () => {
    fingirIdiomaDelDispositivo('es-ES');
    localStorage.setItem(CLAVE, 'kl');

    expect(detectarIdiomaInicial()).toBe('es');
  });
});

describe('ServicioIdioma', () => {
  beforeEach(() => {
    localStorage.clear();
    fingirIdiomaDelDispositivo('es-ES');
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideTranslateService()],
    });
  });

  it('arranca con el idioma detectado', () => {
    expect(TestBed.inject(ServicioIdioma).idiomaActual()).toBe('es');
  });

  it('cambia de idioma y lo recuerda para la proxima sesion', () => {
    const servicio = TestBed.inject(ServicioIdioma);

    servicio.cambiarIdioma('en');

    expect(servicio.idiomaActual()).toBe('en');
    expect(localStorage.getItem(CLAVE)).toBe('en');
    expect(detectarIdiomaInicial()).toBe('en');
  });
});

/**
 * El WebView de Android puede arrancar con un idioma distinto al del telefono,
 * asi que el servicio pregunta al sistema con @capacitor/device. Aqui se finge
 * el plugin: en las pruebas no hay dispositivo nativo ninguno.
 */
const nativo = vi.hoisted(() => ({ esNativo: false, idiomaDelSistema: 'en-US' }));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: (): boolean => nativo.esNativo },
}));

vi.mock('@capacitor/device', () => ({
  Device: {
    getLanguageCode: (): Promise<{ value: string }> =>
      Promise.resolve({ value: nativo.idiomaDelSistema }),
  },
}));

describe('ServicioIdioma dentro de Android', () => {
  beforeEach(() => {
    localStorage.clear();
    nativo.esNativo = false;
    nativo.idiomaDelSistema = 'en-US';
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideTranslateService()],
    });
  });

  /** Deja correr las promesas pendientes del repaso del idioma. */
  async function esperarAlPlugin(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
  }

  it('en la web no le pregunta al sistema', async () => {
    fingirIdiomaDelDispositivo('es-ES');
    nativo.idiomaDelSistema = 'en-US';

    const servicio = TestBed.inject(ServicioIdioma);
    await esperarAlPlugin();

    expect(servicio.idiomaActual()).toBe('es');
  });

  it('en Android corrige el idioma con el del telefono', async () => {
    // El WebView dice ingles, pero el telefono esta en espanol.
    fingirIdiomaDelDispositivo('en-US');
    nativo.esNativo = true;
    nativo.idiomaDelSistema = 'es-MX';

    const servicio = TestBed.inject(ServicioIdioma);
    expect(servicio.idiomaActual()).toBe('en');

    await esperarAlPlugin();
    expect(servicio.idiomaActual()).toBe('es');
  });

  it('no pisa el idioma que el jugador eligio a mano', async () => {
    fingirIdiomaDelDispositivo('en-US');
    localStorage.setItem(CLAVE, 'en');
    nativo.esNativo = true;
    nativo.idiomaDelSistema = 'es-ES';

    const servicio = TestBed.inject(ServicioIdioma);
    await esperarAlPlugin();

    expect(servicio.idiomaActual()).toBe('en');
  });
});
