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
 */
const configuracion: CapacitorConfig = {
  appId: 'com.minehunt.app',
  appName: 'MineHunt',
  webDir: 'dist/web/browser',
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
