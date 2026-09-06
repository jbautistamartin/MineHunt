import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { IDIOMAS_SOPORTADOS, IDIOMA_POR_DEFECTO } from './idioma.servicio';

interface Manifiesto {
  readonly name: string;
  readonly short_name: string;
  readonly description: string;
  readonly lang: string;
  readonly start_url: string;
  readonly display: string;
  readonly background_color: string;
  readonly theme_color: string;
  readonly icons: readonly {
    readonly src: string;
    readonly sizes: string;
    readonly type: string;
    readonly purpose: string;
  }[];
}

function leer(nombre: string): string {
  return readFileSync(resolve(process.cwd(), 'public', nombre), 'utf8');
}

function manifiesto(idioma: string): Manifiesto {
  return JSON.parse(leer(`manifest.${idioma}.json`)) as Manifiesto;
}

/**
 * El manifiesto es lo que lee el navegador para instalar la aplicacion, antes
 * de que arranque nada del juego: ni ngx-translate ni ningun codigo nuestro
 * pueden traducirlo despues. De ahi que haya uno por idioma y que estas
 * comprobaciones miren los ficheros de verdad.
 */
describe('manifiesto de la aplicacion instalable', () => {
  it('hay uno por cada idioma de la interfaz', () => {
    for (const idioma of IDIOMAS_SOPORTADOS) {
      expect(existsSync(resolve(process.cwd(), 'public', `manifest.${idioma}.json`))).toBe(
        true,
      );
    }
  });

  it('cada uno se declara en su idioma y describe el juego en el', () => {
    for (const idioma of IDIOMAS_SOPORTADOS) {
      const leido = manifiesto(idioma);

      expect(leido.lang).toBe(idioma);
      expect(leido.name).toBe('MineHunt');
      expect(leido.description.length).toBeGreaterThan(20);
    }

    // Y no son el mismo texto repetido, que es el fallo facil de cometer.
    expect(manifiesto('es').description).not.toBe(manifiesto('en').description);
  });

  it('todos arrancan en la raiz, en vertical y con el fondo de la paleta', () => {
    const estilos = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const fondo = /--mh-fondo:\s*(#[0-9a-f]{6})/i.exec(estilos)?.[1];

    for (const idioma of IDIOMAS_SOPORTADOS) {
      const leido = manifiesto(idioma);

      expect(leido.start_url).toBe('/');
      expect(leido.display).toBe('standalone');
      expect(leido.background_color).toBe(fondo);
      expect(leido.theme_color).toBe(fondo);
    }
  });

  /**
   * Los PNG los genera `npm run recursos-web` desde el icono maestro. Si se
   * borran o se renombran, la instalacion se queda sin icono y no falla nada.
   */
  it('apunta a iconos que existen, con uno enmascarable', () => {
    const iconos = manifiesto(IDIOMA_POR_DEFECTO).icons;

    for (const icono of iconos) {
      expect(existsSync(resolve(process.cwd(), 'public', icono.src)), icono.src).toBe(true);
    }
    expect(iconos.some((icono) => icono.purpose === 'maskable')).toBe(true);
    expect(iconos.some((icono) => icono.sizes === '512x512')).toBe(true);
  });

  /** El enlace de index.html es el de reserva; el servicio lo cambia luego. */
  it('index.html enlaza el manifiesto del idioma por defecto', () => {
    const index = readFileSync(resolve(process.cwd(), 'src/index.html'), 'utf8');

    expect(index).toContain(`href="manifest.${IDIOMA_POR_DEFECTO}.json"`);
    expect(index).toContain('id="manifiesto"');
  });
});
