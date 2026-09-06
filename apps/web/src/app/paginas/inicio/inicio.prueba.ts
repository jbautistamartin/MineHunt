import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';

import { routes } from '../../app.routes';
import { Inicio } from './inicio';

/** Lee un fichero de traduccion de los que se sirven en /assets/i18n/. */
function traducciones(idioma: 'es' | 'en'): Record<string, unknown> {
  const ruta = resolve(process.cwd(), 'public/assets/i18n', `${idioma}.json`);
  return JSON.parse(readFileSync(ruta, 'utf8')).inicio;
}

/** Destinos a los que lleva el menu, en el orden en que se pintan. */
function destinos(elemento: HTMLElement): (string | null)[] {
  return [...elemento.querySelectorAll('a.modo')].map((enlace) => enlace.getAttribute('href'));
}

describe('Inicio', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter(routes),
        provideTranslateService({}),
      ],
    });
  });

  it('lleva a cada modo de juego y a la ayuda', () => {
    const fixture = TestBed.createComponent(Inicio);
    fixture.detectChanges();

    expect(destinos(fixture.nativeElement as HTMLElement)).toEqual([
      '/historia',
      '/entrenamiento',
      '/online',
      '/ayuda',
    ]);
  });

  /**
   * Hasta la Fase 7 el Multijugador Online se ensenaba apagado, porque no habia
   * a donde ir. Ya lo hay, asi que es un enlace mas y no queda nada bloqueado.
   */
  it('el multijugador online ya no esta apagado', () => {
    const fixture = TestBed.createComponent(Inicio);
    fixture.detectChanges();
    const elemento = fixture.nativeElement as HTMLElement;

    expect(elemento.querySelector('.modo.bloqueado')).toBeNull();
  });

  it('resume el progreso del Modo Historia', () => {
    const fixture = TestBed.createComponent(Inicio);
    fixture.detectChanges();

    expect(fixture.componentInstance.nivelesSuperados()).toBe(0);
    expect(fixture.componentInstance.totalNiveles).toBeGreaterThan(0);
    expect((fixture.nativeElement as HTMLElement).querySelector('.modo-progreso')).not.toBeNull();
  });

  /** El menu es la primera pantalla: una clave sin traducir se ve a la primera. */
  it('esta escrito en los dos idiomas', () => {
    const entradas = ['entrenamiento', 'historia', 'online', 'ayuda'] as const;

    for (const [idioma, textos] of [
      ['es', traducciones('es')],
      ['en', traducciones('en')],
    ] as const) {
      for (const entrada of entradas) {
        const bloque = textos[entrada] as Record<string, string> | undefined;
        expect(bloque, `${entrada} en ${idioma}`).toBeDefined();
        expect(bloque?.['titulo']?.length ?? 0).toBeGreaterThan(0);
        expect(bloque?.['texto']?.length ?? 0).toBeGreaterThan(0);
      }
      expect(textos['volver']).toBeTruthy();
      expect((textos['aria'] as Record<string, string>)['menu']).toBeTruthy();
    }
  });
});
