import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';

import { Acerca } from './acerca';
import { routes } from '../../app.routes';
import { URL_DONATIVO } from '../../nucleo/donativo';
import { ServicioIntro } from '../../nucleo/intro.servicio';
import { URL_PROYECTO } from '../../nucleo/proyecto';
import { VERSION_APP } from '../../nucleo/version';

/** Textos de uno de los dos idiomas que se sirven en /assets/i18n/. */
function traducciones(idioma: 'es' | 'en'): Record<string, unknown> {
  const ruta = resolve(process.cwd(), 'public/assets/i18n', `${idioma}.json`);
  return JSON.parse(readFileSync(ruta, 'utf8')) as Record<string, unknown>;
}

describe('Acerca de', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter(routes),
        provideTranslateService({}),
      ],
    });
  });

  it('ensena la version del juego', () => {
    const fixture = TestBed.createComponent(Acerca);
    fixture.detectChanges();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(texto).toContain(VERSION_APP);
  });

  /**
   * Esta pantalla la lee quien va a jugar, no quien lo programa: sin nombres de
   * bibliotecas, sin piezas internas y con un solo numero de version.
   */
  it('no cuenta nada tecnico', () => {
    const fixture = TestBed.createComponent(Acerca);
    fixture.detectChanges();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';

    for (const tecnicismo of ['Angular', 'NestJS', 'Capacitor', 'Socket', 'TypeScript']) {
      expect(texto, tecnicismo).not.toContain(tecnicismo);
    }
  });

  it('deja salir a la ayuda y al menu', () => {
    const fixture = TestBed.createComponent(Acerca);
    fixture.detectChanges();
    const destinos = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('.salidas a'),
    ].map((enlace) => enlace.getAttribute('href'));

    expect(destinos).toEqual(['/ayuda', '/']);
  });

  /**
   * La pagina del juego se abre fuera del juego, igual que el donativo, y por lo
   * mismo no es una salida: de esta pantalla se sale a la ayuda y al menu.
   */
  it('lleva a la pagina del juego sin convertirla en una salida', () => {
    const fixture = TestBed.createComponent(Acerca);
    fixture.detectChanges();
    const elemento = fixture.nativeElement as HTMLElement;
    const enlace = elemento.querySelector('.proyecto');

    expect(enlace?.getAttribute('href')).toBe(URL_PROYECTO);
    expect(enlace?.getAttribute('target')).toBe('_blank');
    expect(elemento.querySelectorAll('.salidas a')).toHaveLength(2);
  });

  /**
   * El donativo se ofrece aqui y en ningun otro sitio, y se abre fuera del
   * juego. No es una salida mas: las salidas siguen siendo dos.
   */
  it('ofrece el donativo sin convertirlo en una salida', () => {
    const fixture = TestBed.createComponent(Acerca);
    fixture.detectChanges();
    const elemento = fixture.nativeElement as HTMLElement;
    const enlace = elemento.querySelector('.donativo');

    expect(enlace?.getAttribute('href')).toBe(URL_DONATIVO);
    expect(enlace?.getAttribute('target')).toBe('_blank');
    expect(elemento.querySelectorAll('.salidas a')).toHaveLength(2);
  });

  /**
   * Aqui la presentacion no es el peaje de llegar al juego: es la mitad de lo
   * que se vino a ver, asi que sale cada vez que se entra.
   */
  it('se abre con la presentacion del arranque', () => {
    const fixture = TestBed.createComponent(Acerca);
    fixture.detectChanges();
    const elemento = fixture.nativeElement as HTMLElement;

    expect(elemento.querySelector('mh-intro')).not.toBeNull();
    // Tapa, no sustituye: la ficha esta debajo desde el principio.
    expect(elemento.querySelector('.ficha')).not.toBeNull();
  });

  /**
   * Y no gasta el turno del menu: quien recargue estando aqui tiene que ver la
   * presentacion igual al volver al menu principal.
   */
  it('verla aqui no cuenta como haberla visto en el menu', () => {
    const intro = TestBed.inject(ServicioIntro);
    const fixture = TestBed.createComponent(Acerca);
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement).querySelector('mh-intro')?.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    fixture.detectChanges();

    expect(fixture.componentInstance.mostrandoIntro()).toBe(false);
    expect(intro.pendiente()).toBe(true);
  });

  it('firma el juego y tiene sus textos en los dos idiomas', () => {
    for (const idioma of ['es', 'en'] as const) {
      const textos = traducciones(idioma);
      const acerca = textos['acerca'] as Record<string, unknown> | undefined;
      const inicio = textos['inicio'] as Record<string, unknown> | undefined;

      expect(acerca?.['que_es'], idioma).toBeTruthy();
      expect(acerca?.['version'], idioma).toBeTruthy();
      expect(acerca?.['modos'], idioma).toBeTruthy();
      // La firma lleva a la empresa que lo publica y a quien lo desarrolla.
      const autoria = acerca?.['autoria'] as Record<string, string> | undefined;
      expect(autoria?.['texto'], idioma).toContain('Capicua');
      expect(autoria?.['texto'], idioma).toContain('José Luis Bautista');
      expect(autoria?.['derechos'], idioma).toContain('Capicua');
      // El donativo se ofrece en los dos idiomas, o en uno saldria la clave cruda.
      const donativo = acerca?.['donativo'] as Record<string, string> | undefined;
      expect(donativo?.['titulo'], idioma).toBeTruthy();
      expect(donativo?.['texto'], idioma).toBeTruthy();
      expect(donativo?.['boton'], idioma).toBeTruthy();
      // La pagina del juego, con su rotulo en los dos idiomas.
      const proyecto = acerca?.['proyecto'] as Record<string, string> | undefined;
      expect(proyecto?.['titulo'], idioma).toBeTruthy();
      expect(proyecto?.['texto'], idioma).toBeTruthy();
      expect(proyecto?.['enlace'], idioma).toBeTruthy();
      // Y la entrada del menu que lleva hasta aqui.
      expect((inicio?.['acerca'] as Record<string, string>)?.['titulo'], idioma).toBeTruthy();
    }
  });
});
