import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

/** Idiomas que ofrece la interfaz. */
export const IDIOMAS_SOPORTADOS = ['es', 'en'] as const;

export type Idioma = (typeof IDIOMAS_SOPORTADOS)[number];

/** Idioma al que se recurre cuando el del dispositivo no es ninguno de los soportados. */
export const IDIOMA_POR_DEFECTO: Idioma = 'en';

/** Clave con la que se recuerda la eleccion manual del jugador. */
const CLAVE_ALMACENAMIENTO = 'minehunt.idioma';

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

/**
 * Idioma con el que arranca la aplicacion.
 *
 * Manda lo que el jugador eligiera a mano; si no ha elegido nunca, se mira la
 * configuracion regional del dispositivo: es-* usa espanol y cualquier otra
 * cosa cae en ingles.
 *
 * En Android dentro del WebView (Fase 5) puede hacer falta @capacitor/device
 * si navigator.language no resulta fiable.
 */
export function detectarIdiomaInicial(): Idioma {
  const guardado = leerIdiomaGuardado();
  if (guardado !== null) {
    return guardado;
  }

  const delDispositivo = globalThis.navigator?.language ?? '';
  return delDispositivo.toLowerCase().startsWith('es') ? 'es' : IDIOMA_POR_DEFECTO;
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
  }

  /** Cambia el idioma a mano y lo recuerda para las proximas sesiones. */
  cambiarIdioma(idioma: Idioma): void {
    if (idioma === this.idioma()) {
      return;
    }
    this.idioma.set(idioma);
    this.traductor.use(idioma);
    try {
      localStorage.setItem(CLAVE_ALMACENAMIENTO, idioma);
    } catch {
      // Si el navegador bloquea el almacenamiento, el idioma vale solo para esta sesion.
    }
  }
}
