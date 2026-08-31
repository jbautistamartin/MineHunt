import type { Coordenada, EstadoPartida } from '../tipos.js';

/**
 * Analisis del tablero desde el punto de vista de un jugador.
 *
 * Todo lo de aqui parte de EstadoPartida, que por construccion no contiene
 * informacion oculta: una celda oculta no dice ni su numero ni si esconde
 * mina. La IA no tiene ninguna otra fuente de datos, asi que no puede hacer
 * trampas ni queriendo.
 *
 * Ojo con el sentido del juego: en MineHunt las minas se BUSCAN. Una celda
 * de la que se sabe con certeza que esconde mina es la mejor jugada posible,
 * no la peor.
 */

/** Desplazamientos a las ocho celdas vecinas. */
const VECINDAD: readonly Coordenada[] = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
];

/** Clave de una coordenada, para usarla en conjuntos y mapas. */
export function clave(celda: Coordenada): string {
  return `${String(celda.x)},${String(celda.y)}`;
}

/** Deshace una clave. */
function desdeClave(valor: string): Coordenada {
  const [x = '0', y = '0'] = valor.split(',');
  return { x: Number(x), y: Number(y) };
}

/**
 * Lo que una celda numerada ya despejada dice sobre sus vecinas ocultas:
 * cuantas minas quedan repartidas entre ellas.
 */
export interface Restriccion {
  readonly origen: Coordenada;
  /** Minas por descubrir entre las ocultas, ya descontadas las encontradas. */
  readonly minasPendientes: number;
  readonly ocultas: readonly Coordenada[];
}

/** Conclusiones a las que llega el analisis. */
export interface Deducciones {
  /** Celdas que con seguridad esconden mina: la jugada ideal. */
  readonly minasSeguras: readonly Coordenada[];
  /** Celdas que con seguridad no esconden mina: gastan el turno para nada. */
  readonly libresSeguras: readonly Coordenada[];
  readonly restricciones: readonly Restriccion[];
}

/** Vecinas de una celda que caen dentro del tablero. */
export function vecinasDe(estado: EstadoPartida, celda: Coordenada): Coordenada[] {
  const vecinas: Coordenada[] = [];
  for (const desplazamiento of VECINDAD) {
    const x = celda.x + desplazamiento.x;
    const y = celda.y + desplazamiento.y;
    if (x >= 0 && x < estado.ancho && y >= 0 && y < estado.alto) {
      vecinas.push({ x, y });
    }
  }
  return vecinas;
}

/** Todas las celdas que siguen ocultas. */
export function celdasOcultas(estado: EstadoPartida): Coordenada[] {
  const ocultas: Coordenada[] = [];
  for (const fila of estado.celdas) {
    for (const celda of fila) {
      if (celda.estado === 'oculta') {
        ocultas.push({ x: celda.x, y: celda.y });
      }
    }
  }
  return ocultas;
}

/** Estado visible de una celda concreta. */
function estadoDe(estado: EstadoPartida, celda: Coordenada): string | null {
  return estado.celdas[celda.y]?.[celda.x]?.estado ?? null;
}

/**
 * Traduce cada celda numerada a una restriccion sobre sus vecinas ocultas.
 * Las celdas sin vecinas ocultas no aportan nada y se descartan.
 */
export function construirRestricciones(estado: EstadoPartida): Restriccion[] {
  const restricciones: Restriccion[] = [];

  for (const fila of estado.celdas) {
    for (const celda of fila) {
      if (celda.estado !== 'despejada' || celda.minasAdyacentes === null) {
        continue;
      }

      const vecinas = vecinasDe(estado, celda);
      const ocultas = vecinas.filter((vecina) => estadoDe(estado, vecina) === 'oculta');
      if (ocultas.length === 0) {
        continue;
      }

      const yaEncontradas = vecinas.filter(
        (vecina) => estadoDe(estado, vecina) === 'mina-encontrada',
      ).length;

      restricciones.push({
        origen: { x: celda.x, y: celda.y },
        minasPendientes: celda.minasAdyacentes - yaEncontradas,
        ocultas,
      });
    }
  }

  return restricciones;
}

/** Quita de las restricciones las celdas cuyo contenido ya se conoce. */
function simplificar(
  restricciones: readonly Restriccion[],
  minas: ReadonlySet<string>,
  libres: ReadonlySet<string>,
): Restriccion[] {
  const simplificadas: Restriccion[] = [];

  for (const restriccion of restricciones) {
    let pendientes = restriccion.minasPendientes;
    const ocultas: Coordenada[] = [];

    for (const celda of restriccion.ocultas) {
      const llave = clave(celda);
      if (minas.has(llave)) {
        pendientes -= 1;
      } else if (!libres.has(llave)) {
        ocultas.push(celda);
      }
    }

    if (ocultas.length > 0) {
      simplificadas.push({ origen: restriccion.origen, minasPendientes: pendientes, ocultas });
    }
  }

  return simplificadas;
}

/**
 * Deduccion basica (nivel 2): mira cada celda numerada por separado.
 *
 * - Si le quedan tantas minas como vecinas ocultas, todas esconden mina.
 * - Si no le queda ninguna, ninguna de sus vecinas ocultas la esconde.
 *
 * Se repite hasta que deja de sacar conclusiones nuevas, porque cada
 * descubrimiento puede desbloquear el de al lado.
 */
export function deducirBasico(restricciones: readonly Restriccion[]): Deducciones {
  return deducir(restricciones, false);
}

/**
 * Deduccion combinando varias celdas (nivel 3): ademas de lo anterior, aplica
 * la regla del subconjunto. Si las ocultas de A estan todas dentro de las de
 * B, la diferencia B \ A esconde exactamente (minas de B - minas de A) minas;
 * cuando ese numero coincide con el tamano de la diferencia, o vale cero, se
 * resuelve entera. Es el CSP local que pide el plan.
 */
export function deducirCombinado(restricciones: readonly Restriccion[]): Deducciones {
  return deducir(restricciones, true);
}

function deducir(
  restriccionesIniciales: readonly Restriccion[],
  usarSubconjuntos: boolean,
): Deducciones {
  const minas = new Set<string>();
  const libres = new Set<string>();
  let restricciones = simplificar(restriccionesIniciales, minas, libres);

  let huboCambio = true;
  while (huboCambio) {
    huboCambio = false;

    // Regla directa sobre cada restriccion.
    for (const restriccion of restricciones) {
      if (restriccion.minasPendientes === restriccion.ocultas.length) {
        for (const celda of restriccion.ocultas) {
          if (!minas.has(clave(celda))) {
            minas.add(clave(celda));
            huboCambio = true;
          }
        }
      } else if (restriccion.minasPendientes === 0) {
        for (const celda of restriccion.ocultas) {
          if (!libres.has(clave(celda))) {
            libres.add(clave(celda));
            huboCambio = true;
          }
        }
      }
    }

    if (usarSubconjuntos) {
      huboCambio = aplicarSubconjuntos(restricciones, minas, libres) || huboCambio;
    }

    const anteriores = restricciones.length;
    restricciones = simplificar(restricciones, minas, libres);
    if (restricciones.length !== anteriores) {
      huboCambio = true;
    }
    // Sin restricciones no queda nada que deducir.
    if (restricciones.length === 0) {
      break;
    }
  }

  return {
    minasSeguras: [...minas].map(desdeClave),
    libresSeguras: [...libres].map(desdeClave),
    restricciones,
  };
}

/** Regla del subconjunto entre pares de restricciones. */
function aplicarSubconjuntos(
  restricciones: readonly Restriccion[],
  minas: Set<string>,
  libres: Set<string>,
): boolean {
  let huboCambio = false;

  for (const menor of restricciones) {
    const clavesMenor = new Set(menor.ocultas.map(clave));

    for (const mayor of restricciones) {
      if (menor === mayor || menor.ocultas.length >= mayor.ocultas.length) {
        continue;
      }
      const esSubconjunto = menor.ocultas.every((celda) =>
        mayor.ocultas.some((otra) => clave(otra) === clave(celda)),
      );
      if (!esSubconjunto) {
        continue;
      }

      const diferencia = mayor.ocultas.filter((celda) => !clavesMenor.has(clave(celda)));
      const minasEnDiferencia = mayor.minasPendientes - menor.minasPendientes;

      if (minasEnDiferencia === diferencia.length && diferencia.length > 0) {
        for (const celda of diferencia) {
          if (!minas.has(clave(celda))) {
            minas.add(clave(celda));
            huboCambio = true;
          }
        }
      } else if (minasEnDiferencia === 0) {
        for (const celda of diferencia) {
          if (!libres.has(clave(celda))) {
            libres.add(clave(celda));
            huboCambio = true;
          }
        }
      }
    }
  }

  return huboCambio;
}

/**
 * Probabilidad estimada de que cada celda oculta esconda mina (nivel 4).
 *
 * Para las celdas de la frontera se toma la peor cota que le impone alguna
 * celda numerada; para las del resto del tablero, la densidad de minas que
 * queda. Es una aproximacion: el calculo exacto exigiria enumerar todas las
 * combinaciones compatibles, que se dispara en tableros grandes.
 */
export function estimarProbabilidades(
  estado: EstadoPartida,
  restricciones: readonly Restriccion[],
): Map<string, number> {
  const probabilidades = new Map<string, number>();

  for (const restriccion of restricciones) {
    if (restriccion.ocultas.length === 0) {
      continue;
    }
    const probabilidad = restriccion.minasPendientes / restriccion.ocultas.length;
    for (const celda of restriccion.ocultas) {
      const llave = clave(celda);
      probabilidades.set(llave, Math.max(probabilidades.get(llave) ?? 0, probabilidad));
    }
  }

  const ocultas = celdasOcultas(estado);
  const densidad = ocultas.length > 0 ? estado.minasRestantes / ocultas.length : 0;
  for (const celda of ocultas) {
    const llave = clave(celda);
    if (!probabilidades.has(llave)) {
      probabilidades.set(llave, densidad);
    }
  }

  return probabilidades;
}

/**
 * Cuantas vecinas tiene una celda: 3 en las esquinas, 5 en los bordes y 8 en
 * el interior. El nivel 5 la usa para preferir esquinas y bordes.
 */
export function gradoDe(estado: EstadoPartida, celda: Coordenada): number {
  return vecinasDe(estado, celda).length;
}
