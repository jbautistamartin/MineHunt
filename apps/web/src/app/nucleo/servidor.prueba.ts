import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import {
  SERVIDOR_DE_DESARROLLO,
  ServicioServidor,
  esUrlValida,
  servidorPorDefecto,
} from './servidor';

/**
 * Aqui no hay telefono ninguno, asi que el plugin se finge: lo que decide el
 * valor por defecto es justo si se esta dentro del WebView de Android.
 */
const nativo = vi.hoisted(() => ({ esNativo: false }));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: (): boolean => nativo.esNativo },
}));

const CLAVE = 'minehunt.servidor';

function crear(): ServicioServidor {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  return TestBed.inject(ServicioServidor);
}

describe('ServicioServidor', () => {
  beforeEach(() => {
    localStorage.clear();
    nativo.esNativo = false;
  });

  it('arranca en el servidor por defecto', () => {
    expect(crear().url()).toBe(servidorPorDefecto());
  });

  it('guarda la direccion que se le pone y la recuerda', () => {
    const servicio = crear();

    expect(servicio.cambiar('http://192.168.1.20:3000')).toBe(true);

    expect(servicio.url()).toBe('http://192.168.1.20:3000');
    // Al abrir otra vez la aplicacion sigue apuntando ahi.
    expect(crear().url()).toBe('http://192.168.1.20:3000');
  });

  it('quita la barra del final, que si no se duplica en la ruta', () => {
    const servicio = crear();

    servicio.cambiar('http://localhost:3000/');

    expect(servicio.url()).toBe('http://localhost:3000');
  });

  it('rechaza lo que no es una direccion a la que conectarse', () => {
    const servicio = crear();

    for (const mala of ['', 'localhost:3000', 'ftp://ahi', 'no es una url']) {
      expect(servicio.cambiar(mala), mala).toBe(false);
    }
    expect(servicio.url()).toBe(servidorPorDefecto());
  });

  /**
   * Ese texto lo puede haber escrito cualquiera y ademas sobrevive a los
   * cambios de version, asi que se valida antes de usarlo.
   */
  it('descarta lo guardado si no vale', () => {
    localStorage.setItem(CLAVE, 'esto no es una direccion');

    expect(crear().url()).toBe(servidorPorDefecto());
  });

  it('restablecer vuelve al de por defecto y olvida lo guardado', () => {
    const servicio = crear();
    servicio.cambiar('http://192.168.1.20:3000');

    servicio.restablecer();

    expect(servicio.url()).toBe(servidorPorDefecto());
    expect(localStorage.getItem(CLAVE)).toBeNull();
  });

  /**
   * Dentro del APK la web se sirve desde `localhost`, que ahi es el propio
   * telefono: sin esto la aplicacion se conectaria a si misma.
   */
  it('en Android apunta al PC de desarrollo, no a su propio origen', () => {
    nativo.esNativo = true;

    expect(servidorPorDefecto()).toBe(SERVIDOR_DE_DESARROLLO);
  });

  /** Provisional, pero tiene que ser una direccion de la red local. */
  it('el PC de desarrollo es una direccion valida y no localhost', () => {
    expect(esUrlValida(SERVIDOR_DE_DESARROLLO)).toBe(true);
    expect(SERVIDOR_DE_DESARROLLO).not.toContain('localhost');
  });

  /** Lo fijado no es una jaula: lo guardado a mano manda sobre ello. */
  it('lo guardado gana al PC de desarrollo tambien en Android', () => {
    nativo.esNativo = true;
    const servicio = crear();

    servicio.cambiar('http://10.0.0.5:3000');

    expect(crear().url()).toBe('http://10.0.0.5:3000');
  });

  it('solo acepta http y https', () => {
    expect(esUrlValida('http://localhost:3000')).toBe(true);
    expect(esUrlValida('https://minehunt.example')).toBe(true);
    expect(esUrlValida('ws://localhost:3000')).toBe(false);
  });
});
