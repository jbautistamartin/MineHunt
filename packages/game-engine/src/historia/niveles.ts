import type { NivelIA } from '../ia/jugador-ia.js';

/** Cuantos niveles tiene el Modo Historia. */
export const TOTAL_NIVELES = 50;

/** Los niveles se agrupan en cinco zonas de diez, cada una con su nombre. */
export const NIVELES_POR_ZONA = 10;
export const TOTAL_ZONAS = TOTAL_NIVELES / NIVELES_POR_ZONA;

/**
 * Un nivel del Modo Historia: los ajustes exactos con los que se crea la
 * partida. Es solo un dato, sin logica: quien lo juega es el motor de siempre.
 */
export interface NivelHistoria {
  /** Numero del nivel, de 1 a TOTAL_NIVELES. */
  readonly numero: number;
  /** Zona a la que pertenece, de 1 a TOTAL_ZONAS. Da nombre al nivel. */
  readonly zona: number;
  readonly ancho: number;
  readonly alto: number;
  readonly minas: number;
  readonly recargaOndaSegundos: number;
  /** Segundos por turno; 0 en los primeros niveles, que se juegan sin reloj. */
  readonly tiempoPorTurnoSegundos: number;
  /**
   * Nivel de inteligencia de cada rival, del mas fuerte al mas debil. El
   * jugador humano ocupa el puesto 0 y estos son los demas, asi que la partida
   * tiene rivales.length + 1 jugadores.
   */
  readonly rivales: readonly NivelIA[];
}

/** Deja un numero dentro de los cinco niveles de IA que existen. */
function comoNivelIA(valor: number): NivelIA {
  return Math.min(5, Math.max(1, valor)) as NivelIA;
}

/**
 * Construye un nivel a partir de su numero.
 *
 * La dificultad sube por cuatro vias a la vez, y esa es la gracia: un tablero
 * mas grande con mas densidad de minas, rivales mas listos, la onda tardando
 * mas en recargarse y menos tiempo por turno. Cada una sola se haria monotona.
 *
 * - Zonas de diez niveles: cada una agranda el tablero. La densidad de minas
 *   sube aparte, de forma continua, para que no baje al cambiar de zona.
 * - Jugadores: 2 hasta el 15, 3 hasta el 35 y 4 a partir de ahi. Con mas gente
 *   en la mesa te llegan menos turnos, que es dificultad de la buena.
 * - Rivales: el mejor de cada zona juega al nivel de la zona y los demas van un
 *   escalon por debajo, para que no sean todos clones.
 * - Reloj: los cinco primeros niveles se juegan sin reloj, para aprender. A
 *   partir del sexto empieza en 30 s y baja hasta 6 s en el ultimo.
 */
function construirNivel(numero: number): NivelHistoria {
  const zona = Math.floor((numero - 1) / NIVELES_POR_ZONA) + 1;
  const paso = (numero - 1) % NIVELES_POR_ZONA;
  const avance = (numero - 1) / (TOTAL_NIVELES - 1);

  const ancho = 6 + (zona - 1) * 3 + Math.floor(paso / 3);
  const alto = 5 + (zona - 1) * 2 + Math.floor(paso / 4);
  // La densidad va con el avance global y no por zonas: atada a la zona, al
  // saltar de la 1 a la 2 se reiniciaba el sumando del paso y el nivel 11 salia
  // con menos minas que el 10, que es justo lo que no puede pasar.
  const densidad = 0.14 + avance * 0.12;
  const minas = Math.max(3, Math.round(ancho * alto * densidad));

  const jugadores = numero <= 15 ? 2 : numero <= 35 ? 3 : 4;
  const nivelDeLaZona = comoNivelIA(zona);
  const rivales = Array.from({ length: jugadores - 1 }, (_valor, puesto) =>
    comoNivelIA(nivelDeLaZona - puesto),
  );

  const tiempoPorTurnoSegundos =
    numero <= 5 ? 0 : Math.max(6, 30 - Math.round(((numero - 6) / (TOTAL_NIVELES - 6)) * 24));

  return {
    numero,
    zona,
    ancho,
    alto,
    minas,
    recargaOndaSegundos: 10 + Math.round(avance * 35),
    tiempoPorTurnoSegundos,
    rivales,
  };
}

/**
 * Los cincuenta niveles, calculados una sola vez al cargar el modulo.
 *
 * Se generan en vez de escribirse a mano uno por uno para que la progresion sea
 * revisable de un vistazo y no haya cincuenta sitios donde equivocarse; las
 * pruebas comprueban que cada nivel resultante es jugable y que la dificultad
 * no retrocede.
 */
export const NIVELES_HISTORIA: readonly NivelHistoria[] = Object.freeze(
  Array.from({ length: TOTAL_NIVELES }, (_valor, indice) => construirNivel(indice + 1)),
);

/** Devuelve un nivel por su numero, o null si ese nivel no existe. */
export function obtenerNivel(numero: number): NivelHistoria | null {
  return NIVELES_HISTORIA[numero - 1] ?? null;
}
