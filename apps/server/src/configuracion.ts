/**
 * Lo que cambia entre el portatil de casa y el servidor de verdad.
 *
 * Todo lo de aqui sale del entorno y no del codigo, que es lo que permite
 * publicar la misma imagen en cualquier sitio y cambiarle el puerto o los
 * origenes sin recompilar nada. Se lee **una sola vez al arrancar**: una
 * variable que cambiara a mitad de partida seria imposible de razonar.
 *
 * Nada de esto acepta un valor a medias. Un numero que no es un numero o un
 * tope en cero no se corrigen por lo bajini: se arranca con el valor por
 * defecto y se avisa por consola, porque un servidor que se queda sin topes
 * sin que nadie se entere es peor que uno que no arranca.
 */

/** Puerto por defecto del servidor de MineHunt. */
const PUERTO_POR_DEFECTO = 3000;

/**
 * Salas que puede tener abiertas a la vez la gente de una misma IP.
 *
 * Cuatro deja jugar a una casa entera detras del mismo router —que salen
 * todos con la misma IP— y no deja llenar el servidor desde una pestana.
 */
const SALAS_POR_IP_POR_DEFECTO = 4;

/**
 * Salas que puede tener abiertas a la vez una sola conexion.
 *
 * Una persona juega en una sala. La segunda es para quien se equivoco al
 * crearla y abre otra sin cerrar la anterior; de la tercera en adelante ya no
 * es alguien jugando.
 */
const SALAS_POR_CONEXION_POR_DEFECTO = 2;

/**
 * Mensajes por segundo que se le admiten a una conexion.
 *
 * Jugando no se llega ni de lejos: un clic por turno, y el turno mas rapido
 * que se ha visto no baja del medio segundo. Se deja en 20 para que ni una
 * racha de clics encadenados ni un dedo nervioso toquen el techo.
 */
const MENSAJES_POR_SEGUNDO_POR_DEFECTO = 20;

/** Como se llama la aplicacion en los avisos de arranque. */
const AVISO = '[MineHunt]';

export interface Configuracion {
  readonly puerto: number;
  /**
   * Desde que webs se acepta una conexion.
   *
   * `null` es el comodin: cualquiera. **Solo vale para desarrollo**, y por eso
   * `ORIGENES_PERMITIDOS` es obligatoria en produccion.
   *
   * Sigue haciendo falta aunque el cliente web y el socket compartan origen,
   * porque **la aplicacion de Android no descarga la web**: lleva el bundle
   * dentro del APK y su origen nunca va a ser el del servidor.
   */
  readonly origenes: readonly string[] | null;
  readonly maxSalasPorIp: number;
  readonly maxSalasPorConexion: number;
  readonly maxMensajesPorSegundo: number;
  /**
   * Si hay un proxy inverso delante y se puede creer su `X-Forwarded-For`.
   *
   * Apagado por defecto: esa cabecera la escribe quien quiera, y creersela sin
   * un proxy delante regala la forma de saltarse el tope de salas por IP.
   */
  readonly confiarEnProxy: boolean;
  /** En produccion no se perdona nada: ni comodines ni topes quitados. */
  readonly enProduccion: boolean;
}

/**
 * Lee el entorno y deja la configuracion con la que arranca el servidor.
 *
 * Recibe el entorno en lugar de mirar `process.env` para poder probarla, que
 * es justo lo que no se puede comprobar mirando el servidor por fuera.
 */
export function leerConfiguracion(
  entorno: NodeJS.ProcessEnv = process.env,
  avisar: (mensaje: string) => void = console.warn,
): Configuracion {
  const enProduccion = entorno['NODE_ENV'] === 'production';

  return {
    puerto: numero(entorno['PORT'], PUERTO_POR_DEFECTO, 'PORT', avisar),
    origenes: origenes(entorno['ORIGENES_PERMITIDOS'], enProduccion, avisar),
    maxSalasPorIp: numero(
      entorno['MAX_SALAS_POR_IP'],
      SALAS_POR_IP_POR_DEFECTO,
      'MAX_SALAS_POR_IP',
      avisar,
    ),
    maxSalasPorConexion: numero(
      entorno['MAX_SALAS_POR_CONEXION'],
      SALAS_POR_CONEXION_POR_DEFECTO,
      'MAX_SALAS_POR_CONEXION',
      avisar,
    ),
    maxMensajesPorSegundo: numero(
      entorno['MAX_MENSAJES_POR_SEGUNDO'],
      MENSAJES_POR_SEGUNDO_POR_DEFECTO,
      'MAX_MENSAJES_POR_SEGUNDO',
      avisar,
    ),
    confiarEnProxy: entorno['CONFIAR_EN_PROXY'] === 'si',
    enProduccion,
  };
}

/**
 * Un entero positivo, o el valor por defecto avisando de por que.
 *
 * Se rechaza el cero a proposito: en todo lo que se lee aqui, cero significa
 * «sin tope» o «sin puerto», y eso no se pone sin querer.
 */
function numero(
  crudo: string | undefined,
  porDefecto: number,
  nombre: string,
  avisar: (mensaje: string) => void,
): number {
  if (crudo === undefined || crudo.trim() === '') {
    return porDefecto;
  }

  const valor = Number(crudo);
  if (!Number.isInteger(valor) || valor <= 0) {
    avisar(`${AVISO} ${nombre}="${crudo}" no es un entero positivo; uso ${String(porDefecto)}.`);
    return porDefecto;
  }

  return valor;
}

/**
 * La lista de origenes que acepta el CORS, separados por comas.
 *
 * Sin la variable se deja pasar a cualquiera, que es lo comodo en desarrollo
 * —el `ng serve` del 4200, el movil por la IP de la red— y lo inaceptable de
 * cara a internet: por eso en produccion se avisa a gritos.
 */
function origenes(
  crudo: string | undefined,
  enProduccion: boolean,
  avisar: (mensaje: string) => void,
): readonly string[] | null {
  const lista = (crudo ?? '')
    .split(',')
    .map((origen) => origen.trim())
    .filter((origen) => origen !== '');

  if (lista.length === 0) {
    if (enProduccion) {
      avisar(
        `${AVISO} ORIGENES_PERMITIDOS no esta puesta y esto es produccion: ` +
          'el servidor acepta conexiones de cualquier web. Ponla.',
      );
    }
    return null;
  }

  if (lista.includes('*')) {
    return null;
  }

  return lista;
}
