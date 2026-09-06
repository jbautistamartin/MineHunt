import type { NivelIA } from '../ia/jugador-ia.js';
import type { CodigoError, CodigoSuceso, EstadoPartida } from '../tipos.js';
import { VERSION_MOTOR } from '../version.js';

/**
 * Contrato entre el servidor y los clientes de una partida online.
 *
 * **Aqui no hay ni una regla del juego ni un texto para leer**: solo los
 * nombres de los mensajes y la forma de lo que va dentro. Dos jugadores de la
 * misma sala pueden tener el movil en idiomas distintos, asi que la frase la
 * compone cada cliente con sus propias claves de traduccion; por el cable van
 * codigos y datos crudos.
 *
 * Vive en el motor y no en el servidor por la misma razon por la que ya vivian
 * aqui `CodigoSuceso` y `CodigoError`: es el vocabulario con el que cliente y
 * servidor se hablan, y los dos dependen de este paquete. Puesto en
 * `apps/server`, el cliente tendria que redeclararlo y se desincronizaria solo;
 * puesto en un cuarto workspace, habria que duplicar toda la fontaneria del
 * monorepo para un fichero de declaraciones.
 *
 * Sigue siendo TypeScript puro: ni Socket.IO, ni Nest, ni Angular, ni nada que
 * se ejecute. Son tipos y unas cuantas cadenas constantes.
 */

/** Mensajes que manda el cliente. */
export const MENSAJES_DEL_CLIENTE = {
  /** Que salas estan esperando gente, para quien no tiene ningun codigo. */
  salasAbiertas: 'salas-abiertas',
  crearSala: 'crear-sala',
  unirseASala: 'unirse-a-sala',
  reconectar: 'reconectar',
  configurarSala: 'configurar-sala',
  empezarPartida: 'empezar-partida',
  /** Terminada la partida, la sala vuelve al lobby para jugar otra. */
  volverAlLobby: 'volver-al-lobby',
  clic: 'clic',
  onda: 'onda',
  rendirse: 'rendirse',
  salir: 'salir',
} as const;

/** Mensajes que difunde el servidor a todos los de la sala. */
export const MENSAJES_DEL_SERVIDOR = {
  /** Como esta la sala: quien hay, conectado o no, y con que ajustes. */
  sala: 'sala',
  /** Estado completo de la partida, tal y como lo devuelve el motor. */
  partida: 'partida',
  /** Algo que acaba de pasar, para contarlo en el idioma de cada uno. */
  suceso: 'suceso',
} as const;

/**
 * Ajustes con los que el anfitrion monta la partida.
 *
 * Son los mismos que los del Modo Entrenamiento, y a proposito: quien ya sabe
 * montar una partida local no tiene que aprender otra cosa para montar una
 * online.
 */
export interface ConfiguracionSala {
  readonly ancho: number;
  readonly alto: number;
  readonly minas: number;
  /** Segundos por turno; 0 deja la partida sin reloj. */
  readonly tiempoPorTurnoSegundos: number;
  readonly recargaOndaSegundos: number;
  /**
   * La sala sale en la lista de salas abiertas.
   *
   * Privada no significa cerrada: se entra igual con el codigo. Lo que cambia
   * es que no se anuncia, que es lo que hace falta para jugar solo con quien
   * uno quiere.
   */
  readonly publica: boolean;
  /**
   * Bots que se sientan a jugar, en orden de asiento y detras de los humanos.
   *
   * Es lo que permite empezar sin esperar a nadie, o completar una mesa a la
   * que le falta gente.
   */
  readonly nivelesIA: readonly NivelIA[];
}

/**
 * Momento de la sala.
 *
 * - lobby: se espera a que llegue gente y el anfitrion arranque.
 * - jugando: hay partida en marcha.
 * - terminada: la partida acabo y la sala sigue en pie para ver el resultado.
 */
export type EstadoSala = 'lobby' | 'jugando' | 'terminada';

/** Un puesto de la sala, que en partida es el id de jugador del motor. */
export interface PuestoSala {
  readonly id: number;
  readonly nombre: string;
  readonly conectado: boolean;
  readonly anfitrion: boolean;
  /** Se cayo y le esta jugando un bot hasta que vuelva. */
  readonly sustituido: boolean;
  /** El puesto lo ocupa un bot, no una persona. */
  readonly bot: boolean;
  /** Nivel del bot, o null si el puesto es de una persona. */
  readonly nivel: NivelIA | null;
}

/** La sala tal y como la ven sus jugadores. */
export interface VistaSala {
  readonly codigo: string;
  readonly estado: EstadoSala;
  readonly configuracion: ConfiguracionSala;
  readonly puestos: readonly PuestoSala[];
}

/**
 * Una sala esperando gente.
 *
 * Es lo poco que hace falta para decidir si entrar: quien la abrio y cuanto
 * sitio queda. No lleva nada de la partida porque todavia no hay ninguna.
 */
export interface SalaAbierta {
  readonly codigo: string;
  readonly anfitrion: string;
  readonly jugadores: number;
  readonly maximo: number;
  /** Cuantos de esos puestos los llevan bots. */
  readonly bots: number;
}

/** Suceso de la partida, en codigo y datos: lo mismo que guarda el cliente. */
export interface SucesoPartida {
  readonly codigo: CodigoSuceso;
  readonly jugador: number;
  readonly celdas: number;
}

/** Motivos por los que el servidor rechaza algo, aparte de los del motor. */
export type CodigoErrorSala =
  | 'SALA_NO_ENCONTRADA'
  | 'SALA_LLENA'
  | 'SALA_EN_JUEGO'
  | 'SALA_EN_LOBBY'
  | 'NO_ES_EL_ANFITRION'
  | 'NO_ES_TU_TURNO'
  | 'JUGADOR_DESCONOCIDO'
  | 'FALTAN_JUGADORES'
  | 'CONFIGURACION_INVALIDA'
  | 'NOMBRE_INVALIDO'
  /** El mensaje no traia lo que decia traer. Del cliente no se fia nadie. */
  | 'PETICION_INVALIDA'
  /** Cliente y servidor no hablan el mismo protocolo. */
  | 'VERSION_INCOMPATIBLE';

/** Todo lo que puede ir mal, del motor o de la sala. */
export type CodigoErrorProtocolo = CodigoErrorSala | CodigoError;

/**
 * Respuesta a una peticion del cliente.
 *
 * Va por el acuse de recibo de Socket.IO en lugar de por un mensaje aparte:
 * asi quien pregunta sabe si le ha salido bien sin tener que adivinarlo por
 * los mensajes que difunde el servidor.
 */
export type Resultado<T> =
  | { readonly ok: true; readonly datos: T }
  | { readonly ok: false; readonly error: CodigoErrorProtocolo };

/** Lo que recibe quien entra en una sala, sea creandola o uniendose. */
export interface Entrada {
  readonly codigo: string;
  /**
   * Credencial del jugador en esta sala.
   *
   * Es lo que le devuelve su puesto si se le cae la conexion, asi que el
   * cliente tiene que guardarla. No viaja en cada mensaje: el servidor la
   * ata al socket al entrar.
   */
  readonly token: string;
  readonly puesto: number;
  readonly sala: VistaSala;
  /** La del servidor, para que el cliente pueda enseñarla si hace falta. */
  readonly version: string;
}

/**
 * Cliente y servidor se entienden.
 *
 * Se comparan `major.minor` y no la version entera: un parche arregla cosas
 * sin tocar lo que va por el cable, y echar a un jugador por eso seria
 * gratuito. **Si cambia el protocolo, sube la minor.**
 *
 * Esta version es la del juego entero (la que el jugador ve en pantalla), asi
 * que dentro de una misma minor —hoy, cualquier 0.0.x— todas las versiones se
 * dan por compatibles y se pueden publicar arreglos sin dejar fuera a nadie.
 * Cambiar lo que va por el cable obliga entonces a subir la minor de todo el
 * juego (a 0.1.0), que es justo lo que hace que un cliente viejo se quede
 * fuera en vez de entrar creyendo que se entiende.
 */
export function versionesCompatibles(una: string, otra: string): boolean {
  const hastaLaMinor = (version: string): string =>
    version.split('.').slice(0, 2).join('.');

  return hastaLaMinor(una) === hastaLaMinor(otra);
}

/** La version con la que habla este protocolo, que es la del motor. */
export { VERSION_MOTOR as VERSION_PROTOCOLO };

/** Lo que recibe quien vuelve tras caerse. */
export interface Reentrada extends Entrada {
  /** La partida en curso, o null si la sala sigue en el lobby. */
  readonly partida: EstadoPartida | null;
}

/**
 * Lo que todo el que entra tiene que decir: con que version viene.
 *
 * El protocolo va con la del motor, y el cliente puede ser un APK instalado
 * hace meses mientras el servidor ya va por otra. Sin esto, los dos se hablan
 * creyendo que se entienden y la partida sale a medias, que se parece
 * demasiado a un fallo del juego.
 */
export interface PeticionConVersion {
  readonly version: string;
}

export interface PeticionCrearSala extends PeticionConVersion {
  readonly nombre: string;
  readonly configuracion?: Partial<ConfiguracionSala>;
}

export interface PeticionUnirse extends PeticionConVersion {
  readonly codigo: string;
  readonly nombre: string;
}

export interface PeticionReconectar extends PeticionConVersion {
  readonly codigo: string;
  readonly token: string;
}

export interface PeticionClic {
  readonly x: number;
  readonly y: number;
}

export interface PeticionOnda {
  /** true la arma para el proximo clic, false se arrepiente sin coste. */
  readonly activar: boolean;
}
