package com.minehunt.app;

import android.content.pm.ApplicationInfo;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebSettings;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * La unica actividad de la app: dentro va el WebView con la misma web de
 * siempre. Lo que hace de mas es registrar los dos plugins del proyecto —el de
 * vibracion y el de las radios del Multijugador Local—, esconder las barras
 * del sistema —la de arriba y la de abajo: el juego se queda con la pantalla
 * entera, y la de navegacion ademas esta justo donde se clica—, dejar la web
 * dentro de la pantalla segura para que la muesca no le tape nada y, solo en
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
        dejarLaWebDentroDeLaPantallaSegura();
        permitirServidorEnClaroEnDepuracion();
    }

    /**
     * Encoge el WebView hasta la parte de la pantalla donde no hay muesca.
     *
     * El juego pinta de borde a borde, y en un telefono con muesca eso incluye
     * la franja donde esta el agujero de la camara: lo que caiga ahi se ve
     * tapado y, peor, **no se puede pulsar**, porque la muesca se come el
     * toque. Con las barras del sistema escondidas no hay nada que reserve esa
     * franja, asi que la reservamos nosotros.
     *
     * Se hace **sobre la vista y no con CSS** a proposito. El documento ya trae
     * su `padding` con `env(safe-area-inset-*)` en `styles.css`, pero eso solo
     * protege al contenido que no se mueve: en una pantalla con scroll el
     * relleno del `body` se va hacia arriba con el resto, y lo que sube pasa
     * por debajo de la muesca igualmente; lo mismo con cualquier capa
     * `position: fixed`. Encogiendo el WebView se encoge **el area visible
     * entera**, asi que no hay forma de pintar ahi.
     *
     * Los huecos se descuentan aqui y **se ponen a cero antes de que lleguen a
     * la web**, o el documento los descontaria otra vez con
     * `env(safe-area-inset-*)` y el hueco saldria doble. No se devuelve
     * `WindowInsetsCompat.CONSUMED` porque entonces el WebView deja de
     * recalcular su area segura cuando algo cambia.
     *
     * El teclado entra en la cuenta: sin el, al escribir el nombre en el
     * Multijugador la caja de texto se queda debajo de las teclas (la ventana
     * no se encoge sola cuando se pinta de borde a borde).
     */
    private void dejarLaWebDentroDeLaPantallaSegura() {
        if (getBridge() == null || getBridge().getWebView() == null) {
            return;
        }

        // El oyente va en el contenedor del WebView, que es donde lo pone
        // Capacitor, y no en el WebView mismo.
        //
        // Ojo: ese contenedor lo infla **Capacitor** desde su propio layout y
        // no trae fondo, asi que la franja que queda libre la pinta el fondo
        // de la ventana. De ahi el `android:windowBackground` de
        // `AppTheme.NoActionBar` en `styles.xml`: sin el sale una banda blanca,
        // que es el fondo del tema claro del sistema. El `activity_main.xml`
        // del proyecto no pinta nada, que no lo usa nadie desde Capacitor 7.
        View contenedor = (View) getBridge().getWebView().getParent();
        if (contenedor == null) {
            return;
        }

        ViewCompat.setOnApplyWindowInsetsListener(contenedor, (vista, huecos) -> {
            Insets seguro = huecos.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            Insets teclado = huecos.getInsets(WindowInsetsCompat.Type.ime());

            vista.setPadding(
                seguro.left,
                seguro.top,
                seguro.right,
                Math.max(seguro.bottom, teclado.bottom)
            );

            return new WindowInsetsCompat.Builder(huecos)
                .setInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout(),
                    Insets.NONE
                )
                .build();
        });

        contenedor.requestApplyInsets();
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
