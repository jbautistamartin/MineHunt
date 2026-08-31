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
