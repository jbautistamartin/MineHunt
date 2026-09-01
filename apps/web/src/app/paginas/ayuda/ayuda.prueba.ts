import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';

import { Ayuda } from './ayuda';

/**
 * Lee un fichero de traduccion de los que se sirven en /assets/i18n/.
 *
 * La ruta se resuelve desde el directorio del paquete y no con import.meta.url
 * porque las pruebas se ejecutan sobre el bundle, donde esa url ya no apunta al
 * fichero fuente.
 */
function traducciones(idioma: 'es' | 'en'): Record<string, Record<string, string>> {
  const ruta = resolve(process.cwd(), 'public/assets/i18n', `${idioma}.json`);
  return JSON.parse(readFileSync(ruta, 'utf8')).ayuda;
}

describe('Ayuda', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideTranslateService({}),
      ],
    });
  });

  it('pinta una seccion por cada regla', () => {
    const fixture = TestBed.createComponent(Ayuda);
    fixture.detectChanges();

    const articulos = (fixture.nativeElement as HTMLElement).querySelectorAll('article.regla');
    expect(articulos).toHaveLength(fixture.componentInstance.secciones.length);
  });

  /**
   * La ayuda es lo unico donde el jugador lee las reglas, asi que una seccion
   * sin traducir saldria en pantalla como la clave pelada. Esta prueba es la
   * que avisa cuando se anade una regla y se olvida uno de los dos idiomas.
   */
  it('cada seccion esta escrita en los dos idiomas', () => {
    const fixture = TestBed.createComponent(Ayuda);
    const es = traducciones('es');
    const en = traducciones('en');

    for (const seccion of fixture.componentInstance.secciones) {
      for (const [idioma, textos] of [
        ['es', es],
        ['en', en],
      ] as const) {
        expect(textos[seccion], `${seccion} en ${idioma}`).toBeDefined();
        expect(textos[seccion]?.['titulo']?.length ?? 0).toBeGreaterThan(0);
        expect(textos[seccion]?.['texto']?.length ?? 0).toBeGreaterThan(0);
      }
    }
  });
});
