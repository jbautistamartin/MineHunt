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
  vecinasDe,
  type Deducciones,
  type Restriccion,
} from './analisis.js';

/**
 * Nivel de inteligencia de un bot.
 *
 * 1. Azar puro.
 * 2. Deduccion basica sobre cada celda numerada por separado.
 * 3. Deduccion combinando varias celdas (CSP local).
 * 4. Estimacion probabilistica cuando no hay jugada segura.
 * 5. Estrategico: como el 4, pero prefiere esquinas y bordes.
 *
 * Todos los niveles pueden gastar la onda expansiva, cada uno con el
 * criterio que le corresponde a su inteligencia. Ver decidirOnda.
 */
export type NivelIA = 1 | 2 | 3 | 4 | 5;

export const NIVELES_IA: readonly NivelIA[] = [1, 2, 3, 4, 5];

/** Por que el bot eligio esa celda. */
export type MotivoDecision =
  | 'MINA_SEGURA'
  | 'MEJOR_PROBABILIDAD'
  | 'DESPEJE_CON_ONDA'
  | 'AZAR';

export interface DecisionIA {
  readonly celda: Coordenada;
  readonly motivo: MotivoDecision;
  /** Probabilidad estimada de que la celda esconda mina, si se calculo. */
  readonly probabilidad: number | null;
  /** Si hay que activar la onda expansiva antes de este clic. */
  readonly usarOnda: boolean;
}

export interface OpcionesIA {
  readonly aleatorio?: () => number;
}

/**
 * Con que frecuencia gasta la onda un bot de nivel 1. No sabe para que sirve,
 * asi que lo tira de vez en cuando y ya esta.
 */
const PROBABILIDAD_ITEM_AL_AZAR = 0.2;

/**
 * Por debajo de esta probabilidad de mina, a los niveles 4 y 5 les compensa
 * mas abrir tablero con la onda que arriesgar un clic que casi seguro falla.
 */
const UMBRAL_PROBABILIDAD_POBRE = 0.2;

/**
 * Bot de MineHunt.
 *
 * Recibe EXACTAMENTE la misma informacion que un jugador humano: el
 * EstadoPartida que devuelve el motor, que no contiene la posicion de las
 * minas ocultas. No hay ninguna via por la que pueda mirar el tablero real.
 *
 * Como el juego esta invertido, el objetivo es el contrario al del buscaminas
 * clasico: una celda de la que se sabe que esconde mina es la mejor jugada, y
 * una que se sabe libre es la peor, porque cede el turno sin puntuar. Por eso
 * las celdas libres son justo donde conviene gastar la onda: no se pierde
 * ninguna opcion de puntuar y se abre tablero para los turnos siguientes.
 *
 * Que quien encuentra mina conserve el turno refuerza ese orden en lugar de
 * cambiarlo: acertar ya no solo puntua, ademas te deja seguir jugando, asi que
 * la mina cantada sigue siendo la primera opcion de todos los niveles.
 */
export class JugadorIA {
  private readonly aleatorio: () => number;

  constructor(
    readonly nivel: NivelIA,
    opciones: OpcionesIA = {},
  ) {
    this.aleatorio = opciones.aleatorio ?? Math.random;
  }

  /** Decide la siguiente celda a clicar y si conviene gastar la onda. */
  elegirJugada(estado: EstadoPartida): DecisionIA {
    const ocultas = celdasOcultas(estado);
    if (ocultas.length === 0) {
      throw new ErrorPartida('SIN_JUGADAS', 'No queda ninguna celda oculta que clicar');
    }

    // Nivel 1: ni mira el tablero. Clica a ciegas y a veces tira la onda.
    if (this.nivel === 1) {
      return {
        celda: this.alAzar(ocultas),
        motivo: 'AZAR',
        probabilidad: null,
        usarOnda:
          this.ondaDisponible(estado) && this.aleatorio() < PROBABILIDAD_ITEM_AL_AZAR,
      };
    }

    const restricciones = construirRestricciones(estado);
    const deducciones =
      this.nivel === 2 ? deducirBasico(restricciones) : deducirCombinado(restricciones);

    // Una mina segura siempre es la mejor jugada: suma sin arriesgar, y el
    // la onda no despejaria nada sobre ella, asi que se guarda.
    const minasSeguras = this.soloOcultas(deducciones.minasSeguras, ocultas);
    if (minasSeguras.length > 0) {
      return {
        celda: this.nivel >= 5 ? this.deMenosVecinas(estado, minasSeguras) : minasSeguras[0]!,
        motivo: 'MINA_SEGURA',
        probabilidad: 1,
        usarOnda: false,
      };
    }

    const conOnda = this.decidirOnda(estado, deducciones, ocultas);
    if (conOnda !== null) {
      return conOnda;
    }

    // Sin certezas, se descarta lo que se sabe que no puntua.
    const libres = new Set(deducciones.libresSeguras.map(clave));
    const dudosas = ocultas.filter((celda) => !libres.has(clave(celda)));
    const candidatas = dudosas.length > 0 ? dudosas : ocultas;

    if (this.nivel <= 3) {
      return {
        celda: this.alAzar(candidatas),
        motivo: 'AZAR',
        probabilidad: null,
        usarOnda: false,
      };
    }

    return this.elegirPorProbabilidad(estado, candidatas, deducciones.restricciones);
  }

  /**
   * Cuando gastar la onda, segun lo que cada nivel es capaz de razonar.
   *
   * - Niveles 2 y 3: sobre una celda que sus deducciones declaran libre. Ahi
   *   no se pierde nada, porque esa celda no iba a puntuar de todos modos.
   * - Niveles 4 y 5: ademas, si ni siquiera hay libres seguras pero el mejor
   *   candidato tiene pocas papeletas de esconder mina, prefieren abrir
   *   tablero a tirar un clic que casi seguro falla.
   *
   * Devuelve null si a este nivel no le compensa gastarlo ahora.
   */
  private decidirOnda(
    estado: EstadoPartida,
    deducciones: Deducciones,
    ocultas: readonly Coordenada[],
  ): DecisionIA | null {
    if (!this.ondaDisponible(estado)) {
      return null;
    }

    // Una celda que se sabe libre es el sitio ideal: no cuesta nada.
    const seguras = this.soloOcultas(deducciones.libresSeguras, ocultas);
    if (seguras.length > 0) {
      return {
        celda: this.mejorParaDespejar(estado, seguras),
        motivo: 'DESPEJE_CON_ONDA',
        probabilidad: 0,
        usarOnda: true,
      };
    }

    if (this.nivel < 4) {
      return null;
    }

    // Sin nada seguro: solo si el panorama es tan pobre que el clic no promete.
    const probabilidades = estimarProbabilidades(estado, deducciones.restricciones);
    let mejor = 0;
    let peorCelda: Coordenada | null = null;
    let peorProbabilidad = Number.POSITIVE_INFINITY;

    for (const celda of ocultas) {
      const probabilidad = probabilidades.get(clave(celda)) ?? 0;
      mejor = Math.max(mejor, probabilidad);
      if (probabilidad < peorProbabilidad) {
        peorProbabilidad = probabilidad;
        peorCelda = celda;
      }
    }

    if (mejor >= UMBRAL_PROBABILIDAD_POBRE || peorCelda === null) {
      return null;
    }

    // Se gasta en la celda con menos papeletas de esconder mina: es la que
    // mas probablemente este vacia y arrastre la cascada.
    const masImprobables = ocultas.filter(
      (celda) => (probabilidades.get(clave(celda)) ?? 0) <= peorProbabilidad + 1e-9,
    );

    return {
      celda: this.mejorParaDespejar(estado, masImprobables),
      motivo: 'DESPEJE_CON_ONDA',
      probabilidad: peorProbabilidad,
      usarOnda: true,
    };
  }

  /**
   * Donde gastar la onda entre varias candidatas validas.
   *
   * El nivel 5 va a por la que mas tablero puede abrir: la que tiene mas
   * vecinas todavia ocultas. Los demas se quedan con la primera que ven.
   */
  private mejorParaDespejar(
    estado: EstadoPartida,
    candidatas: readonly Coordenada[],
  ): Coordenada {
    if (this.nivel < 5) {
      return candidatas[0]!;
    }

    let mejor = candidatas[0]!;
    let masVecinas = this.vecinasOcultas(estado, mejor);

    for (const celda of candidatas.slice(1)) {
      const vecinas = this.vecinasOcultas(estado, celda);
      if (vecinas > masVecinas) {
        mejor = celda;
        masVecinas = vecinas;
      }
    }

    return mejor;
  }

  private vecinasOcultas(estado: EstadoPartida, celda: Coordenada): number {
    return vecinasDe(estado, celda).filter(
      (vecina) => estado.celdas[vecina.y]?.[vecina.x]?.estado === 'oculta',
    ).length;
  }

  /** Niveles 4 y 5: se va a la celda con mas papeletas de esconder mina. */
  private elegirPorProbabilidad(
    estado: EstadoPartida,
    candidatas: readonly Coordenada[],
    restricciones: readonly Restriccion[],
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
      this.nivel >= 5 ? this.deMenosVecinas(estado, empatadas) : this.alAzar(empatadas);

    return {
      celda,
      motivo: 'MEJOR_PROBABILIDAD',
      probabilidad: mejorProbabilidad,
      usarOnda: false,
    };
  }

  /** La onda del jugador al que le toca esta lista para gastarse. */
  private ondaDisponible(estado: EstadoPartida): boolean {
    return estado.jugadores[estado.turnoDe]?.onda.estado === 'disponible';
  }

  /**
   * Nivel 5: entre celdas igual de prometedoras, se queda con la que tiene
   * menos vecinas. Las esquinas y los bordes destapan menos tablero, asi que
   * dan menos informacion gratis al rival.
   */
  private deMenosVecinas(
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
    const indice = Math.min(Math.floor(this.aleatorio() * celdas.length), celdas.length - 1);
    return celdas[indice]!;
  }
}
