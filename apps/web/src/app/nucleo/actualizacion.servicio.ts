import { Injectable, signal } from '@angular/core';

import { URL_PROYECTO } from './proyecto';
import { VERSION_APP } from './version';

/** La version publicada que supera a la instalada. */
export interface VersionNueva {
  /** El numero tal cual se publico, sin la «v» del tag: «1.0.1». */
  readonly version: string;
  /** La pagina del release, que es a donde lleva el enlace. */
  readonly pagina: string;
}

/** Clave con la que se recuerda cuando se pregunto por ultima vez. */
const CLAVE_ALMACENAMIENTO = 'minehunt.actualizacion';

const UN_DIA_MS = 24 * 60 * 60 * 1000;

const URL_ULTIMO_RELEASE =
  'https://api.github.com/repos/jbautistamartin/MineHunt/releases/latest';

/**
 * Compara dos versiones `mayor.menor.parche` **como numeros**: devuelve >0 si la
 * primera es mas nueva, <0 si lo es la segunda y 0 si son la misma.
 *
 * Esta aparte y exportada porque es lo unico de aqui que se puede probar sin
 * red, y porque comparar versiones como texto se equivoca en cuanto un numero
 * pasa de nueve: «1.10.0» va antes que «1.9.0» alfabeticamente, y entonces el
 * juego dejaria de avisar justo a partir de la decima entrega.
 *
 * De `1.2.3-rc1+sha` se queda con `1.2.3`, y una version que no se entiende
 * devuelve `null`, que es lo que hace que no se avise de nada.
 */
export function compararVersiones(a: string, b: string): number | null {
  const partir = (texto: string): readonly number[] | null => {
    const limpia = texto.trim().replace(/^v/i, '').split(/[-+]/)[0] ?? '';
    const trozos = limpia.split('.');
    // Un trozo vacio es una etiqueta mal formada —«», «1.», «.2»—, y hay que
    // descartarla: `Number('')` vale cero y la dejaria pasar como una version.
    if (trozos.length > 3 || trozos.some((trozo) => trozo.trim() === '')) {
      return null;
    }
    const numeros = trozos.map((trozo) => Number(trozo));
    if (numeros.some((numero) => !Number.isInteger(numero) || numero < 0)) {
      return null;
    }
    return [numeros[0] ?? 0, numeros[1] ?? 0, numeros[2] ?? 0];
  };

  const uno = partir(a);
  const otro = partir(b);
  if (uno === null || otro === null) {
    return null;
  }

  for (let i = 0; i < 3; i++) {
    const diferencia = (uno[i] ?? 0) - (otro[i] ?? 0);
    if (diferencia !== 0) {
      return diferencia;
    }
  }
  return 0;
}

/**
 * Mira si en la pagina del juego hay publicada una version mas nueva que la que
 * se esta jugando, y lo publica en una señal para que lo cuente «Acerca de» y lo
 * marque el menu.
 *
 * Se pregunta **una vez al dia como mucho**, y la respuesta puede no llegar
 * nunca: sin red, con el movil en avion o con un 404 porque todavia no hay
 * ningun release, esto **se calla**. Avisar de que no se pudo comprobar seria
 * contarle al jugador un problema que no es suyo.
 *
 * No descarga ni instala nada. En Android el APK se instala desde la pagina del
 * release, con el instalador del sistema, igual que la primera vez; y en el
 * navegador basta con recargar, porque la version que se sirve es la que hay.
 */
@Injectable({ providedIn: 'root' })
export class ServicioActualizacion {
  /** La version nueva, si la hay. Null mientras no se sepa o no haya ninguna. */
  readonly novedad = signal<VersionNueva | null>(null);

  /** La pagina del release, o la del proyecto si todavia no se ha preguntado. */
  readonly pagina = signal<string>(URL_PROYECTO);

  constructor() {
    // Lo que se encontro en una sesion anterior sigue valiendo: dentro del mismo dia no se
    // vuelve a preguntar, y sin esto el punto del menu desaparecia al reabrir el juego.
    const recordada = this.leerRecordada();
    if (recordada !== null) {
      this.novedad.set(recordada);
      this.pagina.set(recordada.pagina);
    }
  }

  /**
   * Pregunta por el ultimo release.
   *
   * @param forzar salta el limite de una vez al dia. Lo usa quien pulsa a mano.
   */
  async comprobar(forzar = false): Promise<void> {
    if (!forzar && !this.toca()) {
      return;
    }

    try {
      // Con `fetch` y no con `HttpClient`: asi este servicio no depende de la
      // inyeccion de Angular para nada, lo que permite probarlo sin TestBed y
      // deja las pantallas que leen su señal sin necesidad de proveer nada.
      const respuesta = await fetch(URL_ULTIMO_RELEASE, {
        headers: { Accept: 'application/vnd.github+json' },
      });

      // Un 404 es que todavia no hay ningun release publicado, no una averia; y si lo que se
      // recordaba ya no esta publicado, se olvida.
      if (!respuesta.ok) {
        this.olvidar();
        return;
      }

      const release = (await respuesta.json()) as {
        tag_name?: string;
        html_url?: string;
      } | null;

      const etiqueta = release?.tag_name ?? '';
      const comparacion = compararVersiones(etiqueta, VERSION_APP);
      if (comparacion === null || comparacion <= 0) {
        // En cuanto se juega la version de la que se avisaba, el aviso se va con ella.
        this.olvidar();
        return;
      }

      const pagina = release?.html_url ?? URL_PROYECTO;
      const novedad: VersionNueva = { version: etiqueta.replace(/^v/i, ''), pagina };
      this.pagina.set(pagina);
      this.novedad.set(novedad);
      this.guardar(novedad);
    } catch {
      // Sin red o en avion. No es noticia para el jugador: se apunta el intento para no
      // insistir y se deja en pie lo que ya se supiera.
      this.guardar(this.novedad());
    }
  }

  /**
   * Si ha pasado un dia desde la ultima pregunta.
   *
   * Lo guardado es texto que puede haber escrito cualquiera, asi que lo que no
   * sea un numero razonable se trata como «no se ha preguntado nunca», igual que
   * hacen los ajustes y el progreso de Historia.
   */
  private toca(): boolean {
    const ultima = this.leerGuardado()?.['ultimaComprobacion'];
    if (typeof ultima !== 'number' || !Number.isFinite(ultima) || ultima <= 0) {
      return true;
    }
    return Date.now() - ultima >= UN_DIA_MS;
  }

  /**
   * La version que se recordaba, si sigue siendo mas nueva que la que se esta jugando.
   *
   * Lo guardado es texto que puede haber escrito cualquiera, asi que se valida entero y lo que
   * no cuadre se trata como que no hay nada recordado — igual que hacen los ajustes y el
   * progreso de Historia.
   */
  private leerRecordada(): VersionNueva | null {
    const datos = this.leerGuardado();
    const version = datos?.['version'];
    const pagina = datos?.['pagina'];
    if (typeof version !== 'string' || typeof pagina !== 'string') {
      return null;
    }

    const comparacion = compararVersiones(version, VERSION_APP);
    if (comparacion === null || comparacion <= 0) {
      return null;
    }
    return { version, pagina };
  }

  private leerGuardado(): Record<string, unknown> | null {
    try {
      const guardado = localStorage.getItem(CLAVE_ALMACENAMIENTO);
      if (guardado === null) {
        return null;
      }
      const datos: unknown = JSON.parse(guardado);
      return typeof datos === 'object' && datos !== null
        ? (datos as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  /** Apunta el intento y, con el, la version encontrada (o la falta de ella). */
  private guardar(novedad: VersionNueva | null): void {
    try {
      localStorage.setItem(
        CLAVE_ALMACENAMIENTO,
        JSON.stringify({
          ultimaComprobacion: Date.now(),
          ...(novedad === null ? {} : { version: novedad.version, pagina: novedad.pagina }),
        }),
      );
    } catch {
      // Sin almacenamiento se preguntara otra vez al abrir: no es grave.
    }
  }

  private olvidar(): void {
    this.novedad.set(null);
    this.pagina.set(URL_PROYECTO);
    this.guardar(null);
  }
}
