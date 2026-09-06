import { Injectable, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { TranslateService } from '@ngx-translate/core';

/** Idiomas que ofrece la interfaz. */
export const IDIOMAS_SOPORTADOS = ['es', 'en'] as const;

export type Idioma = (typeof IDIOMAS_SOPORTADOS)[number];

/** Idioma al que se recurre cuando el del dispositivo no es ninguno de los soportados. */
export const IDIOMA_POR_DEFECTO: Idioma = 'en';

/** Clave con la que se recuerda la eleccion manual del jugador. */
const CLAVE_ALMACENAMIENTO = 'minehunt.idioma';

/** Id del <link rel="manifest"> de index.html, que hay uno por idioma. */
const ID_DEL_MANIFIESTO = 'manifiesto';

/**
 * Apunta el manifiesto de la aplicacion instalable al del idioma activo.
 *
 * El nombre y la descripcion con los que la aplicacion se instala tambien se
 * traducen, y eso no sale de ngx-translate: lo lee el navegador del
 * manifiesto, antes de que arranque nada. De ahi que haya dos ficheros y que
 * lo unico que se haga en caliente sea cambiar a cual apunta el enlace.
 */
function apuntarManifiesto(idioma: Idioma): void {
  const enlace = globalThis.document?.getElementById(ID_DEL_MANIFIESTO);
  if (enlace instanceof HTMLLinkElement) {
    enlace.href = `manifest.${idioma}.json`;
  }
}

function esIdiomaSoportado(valor: string | null): valor is Idioma {
  return valor !== null && (IDIOMAS_SOPORTADOS as readonly string[]).includes(valor);
}

/** Lee la eleccion guardada, tolerando navegadores que bloquean el almacenamiento. */
function leerIdiomaGuardado(): Idioma | null {
  try {
    const guardado = localStorage.getItem(CLAVE_ALMACENAMIENTO);
    return esIdiomaSoportado(guardado) ? guardado : null;
  } catch {
    return null;
  }
}

/** Traduce una etiqueta de idioma ('es-MX', 'en', 'pt-BR') a uno de los soportados. */
export function idiomaDeLaEtiqueta(etiqueta: string): Idioma {
  return etiqueta.toLowerCase().startsWith('es') ? 'es' : IDIOMA_POR_DEFECTO;
}

/**
 * Idioma con el que arranca la aplicacion.
 *
 * Manda lo que el jugador eligiera a mano; si no ha elegido nunca, se mira la
 * configuracion regional del dispositivo: es-* usa espanol y cualquier otra
 * cosa cae en ingles.
 *
 * Es sincrono a proposito, para que la primera pantalla ya salga traducida.
 * Dentro del WebView de Android navigator.language puede no ser el idioma del
 * telefono, asi que el servicio lo repasa despues preguntandole al sistema.
 */
export function detectarIdiomaInicial(): Idioma {
  const guardado = leerIdiomaGuardado();
  if (guardado !== null) {
    return guardado;
  }

  return idiomaDeLaEtiqueta(globalThis.navigator?.language ?? '');
}

/** Gestiona el idioma de la interfaz y recuerda la eleccion del jugador. */
@Injectable({ providedIn: 'root' })
export class ServicioIdioma {
  private readonly traductor = inject(TranslateService);
  private readonly idioma = signal<Idioma>(detectarIdiomaInicial());

  /** Idioma activo, para que la interfaz marque cual esta seleccionado. */
  readonly idiomaActual = this.idioma.asReadonly();
  readonly idiomasDisponibles = IDIOMAS_SOPORTADOS;

  constructor() {
    this.traductor.addLangs([...IDIOMAS_SOPORTADOS]);
    this.traductor.setFallbackLang(IDIOMA_POR_DEFECTO);
    this.traductor.use(this.idioma());
    apuntarManifiesto(this.idioma());
    void this.repasarConElIdiomaDelSistema();
  }

  /**
   * Segunda opinion sobre el idioma, solo en Android (Fase 5).
   *
   * El WebView puede arrancar en el idioma del propio WebView y no en el del
   * telefono, asi que se le pregunta al sistema con @capacitor/device y se
   * corrige si no coincide. En la web no se pregunta nada: alli
   * navigator.language es de fiar.
   *
   * Nunca pisa una eleccion manual: si el jugador ya eligio idioma, manda el
   * suyo. Y si el plugin no contesta, se queda lo que detecto el WebView, que
   * es mejor que quedarse sin traducir.
   */
  private async repasarConElIdiomaDelSistema(): Promise<void> {
    if (!Capacitor.isNativePlatform() || leerIdiomaGuardado() !== null) {
      return;
    }

    try {
      const { value } = await Device.getLanguageCode();
      const delSistema = idiomaDeLaEtiqueta(value);
      if (delSistema !== this.idioma()) {
        this.idioma.set(delSistema);
        this.traductor.use(delSistema);
        apuntarManifiesto(delSistema);
      }
    } catch {
      // Sin respuesta del plugin se sigue con el idioma que dijo el WebView.
    }
  }

  /** Cambia el idioma a mano y lo recuerda para las proximas sesiones. */
  cambiarIdioma(idioma: Idioma): void {
    if (idioma === this.idioma()) {
      return;
    }
    this.idioma.set(idioma);
    this.traductor.use(idioma);
    apuntarManifiesto(idioma);
    try {
      localStorage.setItem(CLAVE_ALMACENAMIENTO, idioma);
    } catch {
      // Si el navegador bloquea el almacenamiento, el idioma vale solo para esta sesion.
    }
  }
}
