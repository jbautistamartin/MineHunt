package com.minehunt.app;

import android.content.pm.ApplicationInfo;
import android.os.Bundle;
import android.webkit.WebSettings;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * La unica actividad de la app: dentro va el WebView con la misma web de
 * siempre. Lo que hace de mas es registrar los dos plugins del proyecto —el de
 * vibracion y el de las radios del Multijugador Local—, esconder las barras
 * del sistema —la de arriba y la de abajo: el juego se queda con la pantalla
 * entera, y la de navegacion ademas esta justo donde se clica— y, solo en
 * depuracion, dejar hablar con un servidor por http.
 */
public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle estadoGuardado) {
        // El registro va **antes** de super.onCreate: es ahi donde Capacitor
        // levanta el puente y carga los plugins, y uno registrado despues no
        // llega a existir para la web.
        registerPlugin(VibracionPlugin.class);
        registerPlugin(CercanosPlugin.class);

        super.onCreate(estadoGuardado);
        ocultarBarrasDelSistema();
        permitirServidorEnClaroEnDepuracion();
    }

    /**
     * Deja que la web hable con un servidor por http, solo en depuracion.
     *
     * Capacitor sirve la aplicacion desde **https://localhost**, asi que una
     * peticion a http://<ip-del-pc>:3000 es contenido mixto y Chromium la corta
     * antes de que salga del telefono. El permiso de trafico en claro del
     * manifest no llega: aquel es el permiso de Android, y esto es la regla del
     * navegador. Sin las dos cosas, el Multijugador Online contra el PC no
     * conecta y no se ve ni un error de red, porque no hay red que fallar.
     *
     * Va atado a que la aplicacion sea depurable, que es justo lo que distingue
     * al APK de pruebas del que se publica: en produccion el servidor ira por
     * https y esto no debe relajarse jamas.
     */
    private void permitirServidorEnClaroEnDepuracion() {
        boolean esDepuracion =
            (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        if (!esDepuracion || getBridge() == null || getBridge().getWebView() == null) {
            return;
        }

        getBridge()
            .getWebView()
            .getSettings()
            .setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
    }

    /**
     * Las barras vuelven solas cada vez que la app recupera el foco (al volver
     * de otra aplicacion, o de apagar la pantalla), asi que hay que esconderlas
     * otra vez y no solo al arrancar.
     */
    @Override
    public void onWindowFocusChanged(boolean tieneElFoco) {
        super.onWindowFocusChanged(tieneElFoco);
        if (tieneElFoco) {
            ocultarBarrasDelSistema();
        }
    }

    private void ocultarBarrasDelSistema() {
        // El WebView pasa a pintar de borde a borde; el hueco de la muesca y el
        // de las barras lo deja el documento con env(safe-area-inset-*), que ya
        // esta puesto en styles.css.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        WindowInsetsControllerCompat controlador = WindowCompat.getInsetsController(
            getWindow(),
            getWindow().getDecorView()
        );

        // Deslizando desde el borde vuelven un momento y se esconden solas.
        // Fuera del modo quiosco Android no deja quitarlas del todo, y tampoco
        // interesa: la de navegacion es por donde se sale de la app.
        controlador.setSystemBarsBehavior(
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        );

        // Las dos: la de navegacion de abajo y la de estado de arriba (hora y
        // bateria). El juego se queda con toda la pantalla.
        controlador.hide(WindowInsetsCompat.Type.systemBars());
    }
}
