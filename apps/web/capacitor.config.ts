import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Configuracion de Capacitor para empaquetar la web como app de Android.
 *
 * `webDir` apunta a lo que deja `ng build`: Angular 22 separa el bundle del
 * navegador en `dist/web/browser`, y es esa carpeta la que se copia dentro del
 * APK. Hay una prueba que lo comprueba, porque si la ruta deja de coincidir la
 * app se instala con la pantalla en blanco y no falla nada antes.
 *
 * El color de fondo es el de la paleta (`--mh-fondo`), para que ni el arranque
 * ni los rebotes del scroll ensenen el blanco del WebView.
 *
 * **Ojo con `androidScheme`**: cambiarlo cambia el origen del WebView, y con el
 * origen se va lo guardado en `localStorage` de quien ya tuviera la aplicacion
 * instalada (idioma, ajustes y progreso del Modo Historia).
 */
const configuracion: CapacitorConfig = {
  appId: 'com.minehunt.app',
  appName: 'MineHunt',
  webDir: 'dist/web/browser',
  server: {
    /**
     * Con que esquema se sirve la web dentro del WebView.
     *
     * Capacitor usa `https` por defecto, y eso rompia el Multijugador Online:
     * la pagina quedaba en `https://localhost` y hablar con un servidor por
     * `http://` (o `ws://`) es contenido mixto, que Chromium corta **dentro
     * del telefono**, sin que salga un paquete ni se vea un error de red.
     *
     * Con `http` no hay contenido mixto que valga: la pagina y el servidor van
     * por el mismo esquema en desarrollo, y contra un servidor `https` de
     * produccion tampoco hay problema, porque lo que se prohibe es lo inseguro
     * desde lo seguro y no al reves. `http://localhost` sigue siendo un origen
     * de confianza para el navegador, asi que no se pierde nada por el camino.
     */
    androidScheme: 'http',
  },
  android: {
    backgroundColor: '#0d1730',
  },
  plugins: {
    SplashScreen: {
      backgroundColor: '#0d1730',
      launchShowDuration: 1200,
      launchAutoHide: true,
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
};

export default configuracion;
