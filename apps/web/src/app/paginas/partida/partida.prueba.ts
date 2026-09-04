import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { claveDeSuceso } from './partida';
import type { UltimoSuceso } from '../../nucleo/partida.servicio';

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
