import { InjectionToken } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * El nombre con el que Capacitor registra `CercanosPlugin.java`.
 *
 * Si cambia aqui, cambia alli: el puente los empareja por este texto y un
 * desajuste no falla al compilar, solo deja de existir el plugin en tiempo de
 * ejecucion.
 */
const PLUGIN = 'Cercanos';

/** Como esta el permiso que hace falta para usar las radios del telefono. */
export interface EstadoPermisos {
  readonly concedidos: boolean;
  /**
   * Los que faltan, con el nombre que les da Android.
   *
   * Se devuelven para poder decirlo en el registro cuando algo no arranca: un
   * «no tengo permiso» sin decir cual no se diagnostica con el telefono en la
   * mano.
   */
  readonly faltan: readonly string[];
}

/** Una partida anunciandose ahi al lado. */
export interface PartidaCercana {
  /** El identificador que le da Nearby, que es con el que se conecta. */
  readonly id: string;
  /** El nombre con el que se anuncia, que es el de quien la abrio. */
  readonly nombre: string;
}

/** Lo que la radio cuenta segun va pasando. */
export type SucesoCercano =
  | { readonly tipo: 'encontrada'; readonly id: string; readonly nombre: string }
  | { readonly tipo: 'perdida'; readonly id: string }
  | { readonly tipo: 'conectada'; readonly id: string; readonly nombre: string }
  | { readonly tipo: 'desconectada'; readonly id: string }
  | { readonly tipo: 'mensaje'; readonly id: string; readonly texto: string }
  | { readonly tipo: 'fallo'; readonly motivo: string };

/** El contrato con `CercanosPlugin.java`. */
interface PluginCercanos {
  comprobarPermisos(): Promise<EstadoPermisos>;
  pedirPermisos(): Promise<EstadoPermisos>;
  anunciar(opciones: { nombre: string }): Promise<void>;
  buscar(): Promise<void>;
  dejarDeBuscar(): Promise<void>;
  conectar(opciones: { id: string; nombre: string }): Promise<void>;
  enviar(opciones: { ids: readonly string[]; texto: string }): Promise<void>;
  parar(): Promise<void>;
  addListener(
    evento: string,
    escucha: (datos: Record<string, string>) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

/**
 * Las radios del telefono para hablar con los de al lado, y si estamos en uno.
 *
 * Existe por lo mismo que [Vibrador]: para que el transporte local no importe
 * el puente de Capacitor por su cuenta y las pruebas puedan ponerle una radio
 * de mentira. Aqui eso pesa mas todavia, porque **Nearby necesita radios de
 * verdad**: no hay emulador que lo levante, asi que sin esta costura la unica
 * forma de probar el reparto de mensajes seria con dos telefonos en la mano.
 *
 * `escuchar` devuelve la forma de dejar de escuchar, y no un objeto con
 * `remove`, porque es lo unico que el que llama necesita y asi la de mentira
 * no tiene que imitar la forma de Capacitor.
 */
export interface RadioCercana {
  /** Esto es la aplicacion de Android y no un navegador. */
  readonly disponible: boolean;
  comprobarPermisos(): Promise<EstadoPermisos>;
  pedirPermisos(): Promise<EstadoPermisos>;
  /** Se anuncia una partida con ese nombre, para que la encuentren. */
  anunciar(nombre: string): Promise<void>;
  /** Se buscan las partidas que haya cerca. */
  buscar(): Promise<void>;
  /** Se deja de buscar, sin soltar lo que ya estuviera conectado. */
  dejarDeBuscar(): Promise<void>;
  /** Se pide conexion con una de las encontradas. */
  conectar(id: string, nombre: string): Promise<void>;
  enviar(ids: readonly string[], texto: string): Promise<void>;
  /** Se apaga todo: anuncio, busqueda y conexiones. */
  parar(): Promise<void>;
  escuchar(escucha: (suceso: SucesoCercano) => void): Promise<() => void>;
}

/** Los eventos que manda el plugin, con el tipo que les toca al llegar. */
const EVENTOS = ['encontrada', 'perdida', 'conectada', 'desconectada', 'mensaje', 'fallo'] as const;

export const RADIO_CERCANA = new InjectionToken<RadioCercana>('RadioCercana', {
  providedIn: 'root',
  factory: (): RadioCercana => {
    const nativo = registerPlugin<PluginCercanos>(PLUGIN);

    return {
      disponible: Capacitor.isNativePlatform(),
      comprobarPermisos: () => nativo.comprobarPermisos(),
      pedirPermisos: () => nativo.pedirPermisos(),
      anunciar: (nombre) => nativo.anunciar({ nombre }),
      buscar: () => nativo.buscar(),
      dejarDeBuscar: () => nativo.dejarDeBuscar(),
      conectar: (id, nombre) => nativo.conectar({ id, nombre }),
      enviar: (ids, texto) => nativo.enviar({ ids, texto }),
      parar: () => nativo.parar(),
      escuchar: async (escucha) => {
        const asas = await Promise.all(
          EVENTOS.map((tipo) =>
            nativo.addListener(tipo, (datos) => {
              escucha({ tipo, ...datos } as SucesoCercano);
            }),
          ),
        );

        return (): void => {
          for (const asa of asas) {
            void asa.remove();
          }
        };
      },
    };
  },
});
