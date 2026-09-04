import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import configuracion from '../../../capacitor.config';

/**
 * Carpeta que deja `ng build` segun angular.json.
 *
 * Angular 22 separa el bundle del navegador en `<salida>/browser`, y sin
 * `outputPath` explicito la salida es `dist/<proyecto>`.
 */
function carpetaDelBundle(): string {
  const angular = JSON.parse(
    readFileSync(resolve(process.cwd(), 'angular.json'), 'utf8'),
  ) as {
    projects: Record<
      string,
      { architect: { build: { options: { outputPath?: string | { base: string } } } } }
    >;
  };

  const salida = angular.projects['web']?.architect.build.options.outputPath ?? 'dist/web';
  return `${typeof salida === 'string' ? salida : salida.base}/browser`;
}

/**
 * Capacitor mete dentro del APK lo que diga `webDir`. Si esa ruta deja de
 * coincidir con la que genera Angular, la app se instala igual y arranca en
 * blanco, sin que falle nada antes: de ahi esta prueba.
 */
describe('empaquetado con Capacitor', () => {
  it('mete en el APK la carpeta que genera ng build', () => {
    expect(configuracion.webDir).toBe(carpetaDelBundle());
  });

  it('usa el fondo de la paleta en el arranque y en el WebView', () => {
    const estilos = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const fondo = /--mh-fondo:\s*(#[0-9a-f]{6})/i.exec(estilos)?.[1];

    expect(fondo).toBeDefined();
    expect(configuracion.android?.backgroundColor).toBe(fondo);
    expect(configuracion.plugins?.['SplashScreen']?.['backgroundColor']).toBe(fondo);
  });

  /** El identificador es el que firma la app: cambiarlo es publicar otra distinta. */
  it('conserva el identificador y el nombre de la aplicacion', () => {
    expect(configuracion.appId).toBe('com.minehunt.app');
    expect(configuracion.appName).toBe('MineHunt');
  });
});

/**
 * El manifest y `MainActivity` son fuente del proyecto nativo: `cap sync` no
 * los reescribe, pero tampoco avisa si alguien los devuelve a como los dejo
 * `cap add android`. Son ajustes que solo se notan con el telefono en la mano,
 * asi que mejor que fallen aqui.
 */
describe('ajustes nativos de Android', () => {
  function leerNativo(ruta: string): string {
    return readFileSync(resolve(process.cwd(), 'android/app/src/main', ruta), 'utf8');
  }

  it('deja la pantalla bloqueada en vertical', () => {
    expect(leerNativo('AndroidManifest.xml')).toContain(
      'android:screenOrientation="portrait"',
    );
  });

  it('esconde las dos barras del sistema', () => {
    const actividad = leerNativo('java/com/minehunt/app/MainActivity.java');

    // systemBars() son las dos; con navigationBars() se quedaria la de arriba.
    expect(actividad).toContain('WindowInsetsCompat.Type.systemBars()');
    // Vuelven solas al recuperar el foco: sin esto saldrian en cuanto el
    // jugador cambia de aplicacion y no se irian mas.
    expect(actividad).toContain('onWindowFocusChanged');
  });
});
