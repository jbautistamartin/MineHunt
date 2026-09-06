package com.minehunt.app;

import android.content.Context;
import android.media.AudioAttributes;
import android.os.Build;
import android.os.VibrationAttributes;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * El vibrador del telefono, con los atributos puestos y diciendo que hizo.
 *
 * Existe porque @capacitor/haptics **no los pone**: llama a
 * `vibrator.vibrate(VibrationEffect)` a secas, y una vibracion sin atributos
 * sale con `USAGE_UNKNOWN`. Android trata ese caso como lo mas prescindible que
 * hay —lo mete en el mismo saco que la respuesta al tacto— y se la traga entera
 * cuando el timbre esta en silencio o cuando la respuesta tactil del sistema
 * esta apagada, cosa que en muchos telefonos viene apagada de fabrica. Desde
 * fuera es indistinguible de que el juego no llame a vibrar: el plugin resuelve
 * su promesa como si hubiera vibrado.
 *
 * Aqui se declara `VibrationAttributes.USAGE_MEDIA`, y **cual** se declara
 * importa tanto como declarar alguno. Lo primero que se probo fue
 * `AudioAttributes.USAGE_ASSISTANCE_SONIFICATION`, que parecia lo suyo para un
 * aviso que acompana a una accion; pero Android traduce ese a
 * `VibrationAttributes.USAGE_TOUCH`, y `USAGE_TOUCH` es justo lo que apaga el
 * ajuste **«respuesta tactil»** del sistema, que en el telefono de pruebas
 * venia apagado (`haptic_feedback_enabled = 0`) con todo lo demas encendido. El
 * resultado era el peor posible: el vibrador aceptaba la orden sin rechistar y
 * no se movia nada.
 *
 * `USAGE_MEDIA` no lo apaga ese ajuste ni el modo silencio, y es lo que esto es
 * de verdad: un aviso que forma parte del juego, no la respuesta del sistema a
 * un toque en la pantalla. Quien no lo quiera tiene el interruptor del juego,
 * que es donde lo va a buscar.
 *
 * Ademas **se devuelve un informe**: si el aparato tiene vibrador siquiera y
 * por que camino se fue. Sin eso, un «no vibra» no se puede diagnosticar sin el
 * telefono en la mano.
 *
 * Se registra en {@link MainActivity}, que es codigo del proyecto y `cap sync`
 * no pisa. @capacitor/haptics se queda de reserva y es de donde sale todavia el
 * permiso VIBRATE fusionado, aunque el manifest lo declara ya por su cuenta.
 */
@CapacitorPlugin(name = "Vibracion")
public class VibracionPlugin extends Plugin {

    private static final String ETIQUETA = "MineHuntVibracion";

    /** Lo que se le pide desde la web: vibrar tantos milisegundos. */
    @PluginMethod
    public void vibrar(PluginCall llamada) {
        int duracion = llamada.getInt("duracionMs", 200);
        if (duracion <= 0) {
            llamada.reject("La duracion tiene que ser mayor que cero.");
            return;
        }

        Vibrator vibrador = obtenerVibrador();
        JSObject informe = new JSObject();

        if (vibrador == null || !vibrador.hasVibrator()) {
            informe.put("hayVibrador", false);
            informe.put("via", "sin-vibrador");
            Log.w(ETIQUETA, "El aparato dice que no tiene vibrador.");
            llamada.resolve(informe);
            return;
        }

        informe.put("hayVibrador", true);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                vibrador.vibrate(unGolpe(duracion), atributosDeMedios());
                informe.put("via", "medios");
                informe.put("amplitudControlable", vibrador.hasAmplitudeControl());
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                // Antes de Android 13 no hay USAGE_MEDIA y hay que pasar por
                // AudioAttributes. De los que se pueden expresar asi, el de
                // notificacion es el unico que ni lo apaga la respuesta tactil
                // ni obliga a disfrazar el aviso de alarma.
                vibrador.vibrate(unGolpe(duracion), atributosDeAviso());
                informe.put("via", "aviso");
                informe.put("amplitudControlable", vibrador.hasAmplitudeControl());
            } else {
                vibrarAntesDe26(vibrador, duracion, atributosDeAviso());
                informe.put("via", "legado");
                informe.put("amplitudControlable", false);
            }
        } catch (Exception fallo) {
            Log.e(ETIQUETA, "El vibrador rechazo la llamada.", fallo);
            llamada.reject("El vibrador rechazo la llamada: " + fallo.getMessage(), fallo);
            return;
        }

        Log.i(ETIQUETA, "Vibrado " + duracion + " ms por " + informe.getString("via") + ".");
        llamada.resolve(informe);
    }

    private VibrationEffect unGolpe(int duracion) {
        return VibrationEffect.createOneShot(duracion, VibrationEffect.DEFAULT_AMPLITUDE);
    }

    private VibrationAttributes atributosDeMedios() {
        return new VibrationAttributes.Builder().setUsage(VibrationAttributes.USAGE_MEDIA).build();
    }

    private AudioAttributes atributosDeAviso() {
        return new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
    }

    @SuppressWarnings("deprecation")
    private void vibrarAntesDe26(Vibrator vibrador, int duracion, AudioAttributes atributos) {
        vibrador.vibrate(duracion, atributos);
    }

    private Vibrator obtenerVibrador() {
        Context contexto = getContext();
        if (contexto == null) {
            return null;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager gestor = (VibratorManager) contexto.getSystemService(
                Context.VIBRATOR_MANAGER_SERVICE
            );
            return gestor == null ? null : gestor.getDefaultVibrator();
        }

        return obtenerVibradorAntesDe31(contexto);
    }

    @SuppressWarnings("deprecation")
    private Vibrator obtenerVibradorAntesDe31(Context contexto) {
        return (Vibrator) contexto.getSystemService(Context.VIBRATOR_SERVICE);
    }
}
