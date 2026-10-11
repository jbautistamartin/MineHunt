import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';

import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter(routes),
        provideTranslateService(),
      ],
    }).compileComponents();
  });

  it('crea el componente raiz', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  /*
   * Que cada pantalla empiece por arriba (`withInMemoryScrolling` en `app.config.ts`) **no
   * tiene prueba, y no por olvido**: el `RouterScroller` que lo hace solo se engancha al
   * arrancar la aplicacion de verdad, no cuando TestBed monta un inyector, asi que aqui no
   * llega a existir. Lo que se podria escribir comprobaria el espia, no el comportamiento.
   * Se verifica en el telefono, bajando en el menu y entrando en «Acerca de».
   */
});
