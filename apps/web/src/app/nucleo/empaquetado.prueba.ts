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

  /**
   * Con el esquema `https` por defecto de Capacitor, la pagina queda en
   * https://localhost y hablar con un servidor por http o ws es contenido
   * mixto: Chromium lo corta dentro del telefono y el Online no conecta sin
   * que se vea ningun error de red.
   */
  it('sirve el WebView por http, o el Online no conecta', () => {
    expect(configuracion.server?.androidScheme).toBe('http');
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

  /**
   * La muesca de la camara se come lo que caiga debajo: no solo lo tapa, es
   * que **no deja pulsarlo**. Con las barras escondidas nadie reserva esa
   * franja, asi que la descuenta la actividad encogiendo el WebView.
   *
   * No vale con el `env(safe-area-inset-*)` del documento: ese relleno se va
   * hacia arriba con el scroll y no alcanza a las capas `position: fixed`.
   */
  it('descuenta la muesca encogiendo el WebView', () => {
    const actividad = leerNativo('java/com/minehunt/app/MainActivity.java');

    expect(actividad).toContain('WindowInsetsCompat.Type.displayCutout()');
    expect(actividad).toContain('setPadding');
    // El teclado entra en la cuenta, o al escribir el nombre en el
    // Multijugador la caja de texto se queda debajo de las teclas.
    expect(actividad).toContain('WindowInsetsCompat.Type.ime()');
    // Y lo descontado se pone a cero antes de llegar a la web, o el documento
    // volveria a descontarlo con env(safe-area-inset-*) y saldria doble.
    expect(actividad).toContain('Insets.NONE');
  });

  /**
   * Esa franja no la pinta la web, sino el fondo de la ventana: el contenedor
   * que infla Capacitor no trae fondo propio. Sin decirlo sale el del tema
   * claro del sistema, que es una banda blanca justo donde esta la muesca.
   */
  it('pinta la franja de la muesca con el fondo de la paleta', () => {
    const estilos = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const fondo = /--mh-fondo:\s*(#[0-9a-f]{6})/i.exec(estilos)?.[1];

    expect(leerNativo('res/values/colors.xml')).toContain(
      `<color name="mh_fondo">${fondo}</color>`,
    );
    expect(leerNativo('res/values/styles.xml')).toContain(
      '<item name="android:windowBackground">@color/mh_fondo</item>',
    );
  });

  /**
   * Capacitor sirve la aplicacion desde https://localhost, asi que hablar con
   * un servidor por http es contenido mixto y Chromium lo corta dentro del
   * telefono, sin que se vea ningun error de red. El permiso de trafico en
   * claro del manifest no basta: aquel es el de Android y este el del
   * navegador, y para probar el Online contra el PC hacen falta los dos.
   */
  it('permite hablar con un servidor por http, pero solo en depuracion', () => {
    const actividad = leerNativo('java/com/minehunt/app/MainActivity.java');

    expect(actividad).toContain('MIXED_CONTENT_ALWAYS_ALLOW');
    expect(actividad).toContain('FLAG_DEBUGGABLE');
    expect(leerNativo('../debug/AndroidManifest.xml')).toContain(
      'android:usesCleartextTraffic="true"',
    );
  });

  /**
   * El plugin de vibracion es del proyecto y hay que registrarlo a mano: uno
   * sin registrar no existe para la web, y el servicio se va por el camino de
   * reserva —@capacitor/haptics— que es justo el que no se nota en el telefono.
   *
   * Y va **antes** de `super.onCreate`, que es donde Capacitor levanta el
   * puente: registrado despues, tampoco llega.
   */
  it('registra el plugin de vibracion antes de levantar el puente', () => {
    const actividad = leerNativo('java/com/minehunt/app/MainActivity.java');

    expect(actividad).toContain('registerPlugin(VibracionPlugin.class)');
    expect(actividad.indexOf('registerPlugin(VibracionPlugin.class)')).toBeLessThan(
      actividad.indexOf('super.onCreate(estadoGuardado)'),
    );
  });

  /**
   * Hasta ahora este permiso entraba fusionado desde el manifest de
   * @capacitor/haptics, asi que quitar esa dependencia lo habria dejado caer
   * sin que fallara nada al compilar: la app se instalaria y no vibraria.
   */
  it('pide el permiso de vibrar por su cuenta', () => {
    expect(leerNativo('AndroidManifest.xml')).toContain(
      'android.permission.VIBRATE',
    );
  });

  /**
   * Los atributos son el motivo de que este plugin exista, y **cual** de ellos
   * no es un detalle. Sin declarar ninguno, la vibracion sale como
   * `USAGE_UNKNOWN`; declarando `USAGE_ASSISTANCE_SONIFICATION` sale como
   * `USAGE_TOUCH`, que es lo que apaga el ajuste de respuesta tactil del
   * sistema. Las dos acaban igual: el vibrador acepta la orden y no se mueve
   * nada. `USAGE_MEDIA` es el que no apagan ni ese ajuste ni el silencio.
   */
  it('vibra como aviso del juego y no como respuesta al tacto', () => {
    const plugin = leerNativo('java/com/minehunt/app/VibracionPlugin.java');

    expect(plugin).toContain('VibrationAttributes.USAGE_MEDIA');
    // Los dos descartados salen nombrados en la cabecera, contando por que se
    // descartaron; lo que no puede volver es que alguien los declare.
    expect(plugin).not.toContain('setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)');
    expect(plugin).not.toContain('setUsage(VibrationAttributes.USAGE_TOUCH)');
    // Y el golpe sale siempre con atributos, nunca con el `vibrate()` a secas.
    expect(plugin).not.toMatch(/vibrate\(\s*unGolpe\(duracion\)\s*\)/);
  });
});
