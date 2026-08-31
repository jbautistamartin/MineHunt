import type { Coordenada, EstadoPartida } from '../tipos.js';
import { ErrorPartida } from '../tipos.js';
import {
  celdasOcultas,
  clave,
  construirRestricciones,
  deducirBasico,
  deducirCombinado,
  estimarProbabilidades,
  gradoDe,
} from './analisis.js';

/**
 * Nivel de inteligencia de un bot.
 *
 * 1. Azar puro.
 * 2. Deduccion basica sobre cada celda numerada por separado.
 * 3. Deduccion combinando varias celdas (CSP local).
 * 4. Estimacion probabilistica cuando no hay jugada segura.
 * 5. Estrategico: como el 4, pero prefiere esquinas y bordes al elegir entre
 *    opciones parecidas. La parte del item de despeje llega en la Fase 3.
 */
export type NivelIA = 1 | 2 | 3 | 4 | 5;

export const NIVELES_IA: readonly NivelIA[] = [1, 2, 3, 4, 5];

/** Por que el bot eligio esa celda. */
export type MotivoDecision = 'MINA_SEGURA' | 'MEJOR_PROBABILIDAD' | 'AZAR';

export interface DecisionIA {
  readonly celda: Coordenada;
  readonly motivo: MotivoDecision;
  /** Probabilidad estimada de que la celda esconda mina, si se calculo. */
  readonly probabilidad: number | null;
}

export interface OpcionesIA {
  readonly aleatorio?: () => number;
}

/**
 * Bot de MineHunt.
 *
 * Recibe EXACTAMENTE la misma informacion que un jugador humano: el
 * EstadoPartida que devuelve el motor, que no contiene la posicion de las
 * minas ocultas. No hay ninguna via por la que pueda mirar el tablero real.
 *
 * Como el juego esta invertido, el objetivo es el contrario al del buscaminas
 * clasico: una celda de la que se sabe que esconde mina es la mejor jugada, y
 * una que se sabe libre es la peor, porque gasta el turno sin puntuar.
 */
export class JugadorIA {
  private readonly aleatorio: () => number;

  constructor(
    readonly nivel: NivelIA,
    opciones: OpcionesIA = {},
  ) {
    this.aleatorio = opciones.aleatorio ?? Math.random;
  }

  /** Decide la siguiente celda a clicar. */
  elegirJugada(estado: EstadoPartida): DecisionIA {
    const ocultas = celdasOcultas(estado);
    if (ocultas.length === 0) {
      throw new ErrorPartida('SIN_JUGADAS', 'No queda ninguna celda oculta que clicar');
    }

    if (this.nivel === 1) {
      return { celda: this.alAzar(ocultas), motivo: 'AZAR', probabilidad: null };
    }

    const restricciones = construirRestricciones(estado);
    const deducciones =
      this.nivel === 2 ? deducirBasico(restricciones) : deducirCombinado(restricciones);

    // Una mina segura siempre es la mejor jugada posible: suma sin arriesgar.
    if (deducciones.minasSeguras.length > 0) {
      const candidatas = this.soloOcultas(deducciones.minasSeguras, ocultas);
      if (candidatas.length > 0) {
        return {
          celda: this.nivel >= 5 ? this.preferirEsquinas(estado, candidatas) : candidatas[0]!,
          motivo: 'MINA_SEGURA',
          probabilidad: 1,
        };
      }
    }

    // Sin certezas, los niveles 2 y 3 al menos evitan lo que saben que no puntua.
    const libres = new Set(deducciones.libresSeguras.map(clave));
    const dudosas = ocultas.filter((celda) => !libres.has(clave(celda)));
    const candidatas = dudosas.length > 0 ? dudosas : ocultas;

    if (this.nivel <= 3) {
      return { celda: this.alAzar(candidatas), motivo: 'AZAR', probabilidad: null };
    }

    return this.elegirPorProbabilidad(estado, candidatas, deducciones.restricciones);
  }

  /** Niveles 4 y 5: se va a la celda con mas papeletas de esconder mina. */
  private elegirPorProbabilidad(
    estado: EstadoPartida,
    candidatas: readonly Coordenada[],
    restricciones: Parameters<typeof estimarProbabilidades>[1],
  ): DecisionIA {
    const probabilidades = estimarProbabilidades(estado, restricciones);
    let mejorProbabilidad = -1;
    for (const celda of candidatas) {
      mejorProbabilidad = Math.max(mejorProbabilidad, probabilidades.get(clave(celda)) ?? 0);
    }

    // Empatan muchas celdas casi siempre, asi que se filtra con un margen
    // pequeno para no descartar diferencias irrelevantes de redondeo.
    const empatadas = candidatas.filter(
      (celda) => (probabilidades.get(clave(celda)) ?? 0) >= mejorProbabilidad - 1e-9,
    );

    const celda =
      this.nivel >= 5 ? this.preferirEsquinas(estado, empatadas) : this.alAzar(empatadas);

    return {
      celda,
      motivo: 'MEJOR_PROBABILIDAD',
      probabilidad: mejorProbabilidad,
    };
  }

  /**
   * Nivel 5: entre celdas igual de prometedoras, se queda con la que tiene
   * menos vecinas. Las esquinas y los bordes destapan menos tablero, asi que
   * dan menos informacion gratis al rival.
   */
  private preferirEsquinas(
    estado: EstadoPartida,
    candidatas: readonly Coordenada[],
  ): Coordenada {
    let mejor = candidatas[0]!;
    let menorGrado = gradoDe(estado, mejor);

    for (const celda of candidatas.slice(1)) {
      const grado = gradoDe(estado, celda);
      if (grado < menorGrado) {
        mejor = celda;
        menorGrado = grado;
      }
    }

    return mejor;
  }

  /** Descarta las deducciones que ya no correspondan a celdas ocultas. */
  private soloOcultas(
    celdas: readonly Coordenada[],
    ocultas: readonly Coordenada[],
  ): Coordenada[] {
    const disponibles = new Set(ocultas.map(clave));
    return celdas.filter((celda) => disponibles.has(clave(celda)));
  }

  private alAzar(celdas: readonly Coordenada[]): Coordenada {
    const indice = Math.min(
      Math.floor(this.aleatorio() * celdas.length),
      celdas.length - 1,
    );
    return celdas[indice]!;
  }
}
