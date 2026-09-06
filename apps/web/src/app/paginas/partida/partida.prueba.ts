import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';

import { Partida, claveDeSuceso } from './partida';
import { ServicioPartida, type UltimoSuceso } from '../../nucleo/partida.servicio';

function suceso(cambios: Partial<UltimoSuceso>): UltimoSuceso {
  return { codigo: 'CELDA_DESPEJADA', jugador: 0, celdas: 3, ...cambios };
}

/** Textos de uno de los dos idiomas que se sirven en /assets/i18n/. */
function traducciones(idioma: 'es' | 'en'): Record<string, Record<string, string>> {
  const ruta = resolve(process.cwd(), 'public/assets/i18n', `${idioma}.json`);
  return JSON.parse(readFileSync(ruta, 'utf8')).partida;
}

/**
 * Un clic normal destapa siempre una sola celda, porque no hay cascada
 * automatica: sin esto, «ha despejado 1 celdas» salia en todas las jugadas.
 */
describe('claveDeSuceso', () => {
  it('pide el singular cuando se destapa una sola celda', () => {
    expect(claveDeSuceso(suceso({ celdas: 1 }))).toBe('partida.evento.CELDA_DESPEJADA_UNA');
    expect(claveDeSuceso(suceso({ codigo: 'ONDA_EXPANSIVA', celdas: 1 }))).toBe(
      'partida.evento.ONDA_EXPANSIVA_UNA',
    );
  });

  it('pide el plural con varias celdas', () => {
    expect(claveDeSuceso(suceso({ celdas: 4 }))).toBe('partida.evento.CELDA_DESPEJADA');
    expect(claveDeSuceso(suceso({ codigo: 'ONDA_EXPANSIVA', celdas: 9 }))).toBe(
      'partida.evento.ONDA_EXPANSIVA',
    );
  });

  /**
   * Encontrar una mina revela una celda, pero su texto no la cuenta: si se le
   * colara el sufijo, el jugador veria la clave pelada en pantalla.
   */
  it('no toca los sucesos que no cuentan celdas', () => {
    expect(claveDeSuceso(suceso({ codigo: 'MINA_ENCONTRADA', celdas: 1 }))).toBe(
      'partida.evento.MINA_ENCONTRADA',
    );
    expect(claveDeSuceso(suceso({ codigo: 'TURNO_PERDIDO', celdas: 0 }))).toBe(
      'partida.evento.TURNO_PERDIDO',
    );
  });

  it('tiene las dos formas escritas en los dos idiomas', () => {
    for (const idioma of ['es', 'en'] as const) {
      const textos = traducciones(idioma);

      for (const codigo of ['CELDA_DESPEJADA', 'ONDA_EXPANSIVA']) {
        expect(textos['evento']?.[codigo], `${idioma}: ${codigo}`).toBeTruthy();
        expect(textos['evento']?.[`${codigo}_UNA`], `${idioma}: ${codigo}_UNA`).toBeTruthy();
      }

      expect(textos['fin']?.['ultimo_en_pie'], idioma).toBeTruthy();
      expect(textos['fin']?.['ultimo_en_pie_una'], idioma).toBeTruthy();
    }
  });
});

describe('Partida: la pantalla', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideTranslateService({}),
      ],
    });
  });

  /** Partida hotseat, sin bots ni reloj: nada se mueve solo. */
  function montarPartida(): { servicio: ServicioPartida; elemento: HTMLElement } {
    const servicio = TestBed.inject(ServicioPartida);
    servicio.iniciar({
      ancho: 5,
      alto: 5,
      minas: 4,
      numJugadores: 2,
      numHumanos: 2,
      nivelesIA: [3, 3, 3, 3],
      recargaOndaSegundos: 20,
      tiempoPorTurnoSegundos: 0,
    });

    const fixture = TestBed.createComponent(Partida);
    fixture.detectChanges();
    return { servicio, elemento: fixture.nativeElement as HTMLElement };
  }

  /**
   * El resumen cuenta como fue la partida: mientras se juega no hay nada que
   * contar, y ademas ocupa mucho justo encima del tablero.
   */
  it('no ensena el resumen mientras se juega', () => {
    const { elemento } = montarPartida();

    expect(elemento.querySelector('mh-tablero')).not.toBeNull();
    expect(elemento.querySelector('mh-resumen-final')).toBeNull();
  });

  it('deja callar el juego sin salir de la partida', () => {
    const { elemento } = montarPartida();

    expect(elemento.querySelector('button.silencio')).not.toBeNull();
  });
});
