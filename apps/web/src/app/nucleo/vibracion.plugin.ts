import { InjectionToken } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Haptics } from '@capacitor/haptics';

/** Lo que el aparato cuenta de si mismo cada vez que se le pide un golpe. */
export interface InformeVibracion {
  /** Si el telefono tiene vibrador siquiera. */
  readonly hayVibrador: boolean;
  /** Por donde se fue: `efecto`, `legado` o `sin-vibrador`. */
  readonly via: string;
  readonly amplitudControlable?: boolean;
}

/** El contrato con `VibracionPlugin.java`. */
export interface PluginVibracion {
  vibrar(opciones: { duracionMs: number }): Promise<InformeVibracion>;
}

/**
 * Las tres formas que hay de mover el telefono, y si estamos en uno.
 *
 * Existe para que [ServicioVibracion] no importe el puente de Capacitor por su
 * cuenta: asi las pruebas le ponen un aparato de mentira con TestBed y se puede
 * comprobar **el orden de los intentos**, que es justo lo que no se ve con el
 * telefono en la mano —desde fuera los tres caminos se parecen en que no
 * vibran—. Es el mismo reparto que el reloj y el azar del motor.
 */
export interface Vibrador {
  /** Si esto es la aplicacion de Android y no un navegador. */
  readonly esAndroid: boolean;
  /** El plugin del proyecto, que pone los atributos y devuelve un informe. */
  conElPlugin(duracionMs: number): Promise<InformeVibracion>;
  /** La reserva, por si el plugin del proyecto no llego a registrarse. */
  conHaptics(duracionMs: number): Promise<void>;
  /** La ultima red: la vibracion que implementa el propio WebView. */
  conElNavegador(duracionMs: number): boolean;
}

/**
 * El aparato de verdad.
 *
 * El plugin del proyecto va primero y @capacitor/haptics de reserva, y no al
 * reves: aquel llama al vibrador **sin declarar atributos**, y una vibracion
 * sin declarar sale como `USAGE_UNKNOWN`. Android la considera tan prescindible
 * como la respuesta al tacto y se la traga entera con el telefono en silencio o
 * con la respuesta tactil del sistema apagada, que en muchos aparatos viene
 * apagada de fabrica. Y resuelve su promesa igual, asi que desde la web no
 * habia forma de distinguirlo de un fallo propio. El motivo largo esta en
 * `VibracionPlugin.java`.
 */
export const VIBRADOR = new InjectionToken<Vibrador>('Vibrador', {
  providedIn: 'root',
  factory: () => {
    const nativo = registerPlugin<PluginVibracion>('Vibracion');

    return {
      esAndroid: Capacitor.isNativePlatform(),
      conElPlugin: (duracionMs) => nativo.vibrar({ duracionMs }),
      conHaptics: (duracionMs) => Haptics.vibrate({ duration: duracionMs }),
      conElNavegador: (duracionMs) => navigator.vibrate?.(duracionMs) ?? false,
    };
  },
});
