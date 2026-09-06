import { Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';

/** Donde se recuerda a que servidor se juega. */
const CLAVE_ALMACENAMIENTO = 'minehunt.servidor';

/** Puerto en el que escucha el servidor de partidas. */
const PUERTO_DEL_SERVIDOR = 3000;

/**
 * Puerto del `ng serve`.
 *
 * Ahi no hay servidor de partidas, solo la web en desarrollo, asi que es el
 * unico origen del que hay que desconfiar al elegir el valor por defecto.
 */
const PUERTO_DE_DESARROLLO = '4200';

/**
 * El PC donde corre el servidor mientras se desarrolla.
 *
 * **Provisional**: es la IP fija de la maquina de desarrollo en la red local,
 * y esta aqui para que la aplicacion de Android y el `ng serve` encuentren el
 * servidor sin que haya que escribirla a mano en cada telefono. Cuando haya
 * servidor de verdad (Fase 9) esto pasa a ser su dominio. Que este fijada no
 * quita el ajuste: se sigue pudiendo cambiar desde la pantalla del
 * Multijugador Online, y lo guardado manda sobre esto.
 *
 * `localhost` no vale aqui: dentro del WebView de Android es el propio
 * telefono, no el PC.
 */
export const SERVIDOR_DE_DESARROLLO = `http://192.168.100.101:${String(PUERTO_DEL_SERVIDOR)}`;

/**
 * A que servidor se conecta el Multijugador Online si nadie dice otra cosa.
 *
 * En el navegador, el propio origen: en produccion la misma imagen sirve la web
 * y lleva las partidas (Fase 9), asi que acierta sin configurar nada. En
 * Android no hay origen que valga —la web va dentro del APK y se sirve desde
 * `localhost`, que ahi es el propio telefono—, y con `ng serve` el origen es la
 * web de desarrollo y no el servidor de partidas: en los dos casos se cae al
 * PC de desarrollo.
 */
export function servidorPorDefecto(): string {
  if (Capacitor.isNativePlatform()) {
    return SERVIDOR_DE_DESARROLLO;
  }

  const origen = globalThis.location?.origin ?? '';

  if (/^https?:\/\//.test(origen) && !origen.endsWith(`:${PUERTO_DE_DESARROLLO}`)) {
    return origen;
  }
  return SERVIDOR_DE_DESARROLLO;
}

/** Una direccion a la que tenga sentido conectarse. */
export function esUrlValida(url: string): boolean {
  try {
    const analizada = new URL(url);
    return analizada.protocol === 'http:' || analizada.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Guarda a que servidor se juega online.
 *
 * Hace falta que se pueda cambiar a mano y no solo compilarlo: **para jugar
 * desde el movil hay que apuntar a la IP del PC en la red local**, que cambia
 * sola, y sin este ajuste tocaria recompilar el APK cada vez.
 *
 * Lo que sale de localStorage se valida antes de usarse, como los ajustes del
 * Entrenamiento y el progreso de Historia: ese texto lo puede haber escrito
 * cualquiera y ademas sobrevive a los cambios de version.
 */
@Injectable({ providedIn: 'root' })
export class ServicioServidor {
  private readonly urlInterna = signal(leerGuardada() ?? servidorPorDefecto());

  readonly url = this.urlInterna.asReadonly();

  /** true si la direccion valia y se guardo. */
  cambiar(url: string): boolean {
    const limpia = url.trim().replace(/\/+$/, '');
    if (!esUrlValida(limpia)) {
      return false;
    }

    this.urlInterna.set(limpia);
    try {
      localStorage.setItem(CLAVE_ALMACENAMIENTO, limpia);
    } catch {
      // Sin almacenamiento se juega igual, solo que no se recuerda.
    }
    return true;
  }

  /** Vuelve al servidor por defecto y olvida lo guardado. */
  restablecer(): void {
    this.urlInterna.set(servidorPorDefecto());
    try {
      localStorage.removeItem(CLAVE_ALMACENAMIENTO);
    } catch {
      // Nada que olvidar si no habia donde guardar.
    }
  }
}

function leerGuardada(): string | null {
  try {
    const guardada = localStorage.getItem(CLAVE_ALMACENAMIENTO);
    return guardada !== null && esUrlValida(guardada) ? guardada : null;
  } catch {
    return null;
  }
}
