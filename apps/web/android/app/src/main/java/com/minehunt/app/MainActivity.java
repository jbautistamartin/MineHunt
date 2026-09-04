package com.minehunt.app;

import android.os.Bundle;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * La unica actividad de la app: dentro va el WebView con la misma web de
 * siempre. Lo unico que hace de mas es esconder las barras del sistema, la de
 * arriba y la de abajo: el juego se queda con la pantalla entera, y la de
 * navegacion ademas esta justo donde se clica.
 */
public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle estadoGuardado) {
        super.onCreate(estadoGuardado);
        ocultarBarrasDelSistema();
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
