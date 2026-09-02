import { ErrorPartida } from '../tipos.js';
import { TOTAL_NIVELES } from './niveles.js';

/**
 * Hasta donde ha llegado el jugador en el Modo Historia.
 *
 * Es un dato plano y sin metodos, para que se pueda guardar tal cual en el
 * navegador (y, en su dia, mandarse al servidor) sin traducciones de por medio.
 */
export interface ProgresoHistoria {
  /** Nivel mas alto al que se puede entrar, de 1 a TOTAL_NIVELES. */
  readonly desbloqueado: number;
  /** Niveles ya ganados, ordenados de menor a mayor. Puede haber huecos no. */
  readonly superados: readonly number[];
}

/** Progreso de quien empieza: solo el primer nivel y nada superado. */
export function progresoInicial(): ProgresoHistoria {
  return { desbloqueado: 1, superados: [] };
}

function comprobarNivel(numero: number): void {
  if (!Number.isInteger(numero) || numero < 1 || numero > TOTAL_NIVELES) {
    throw new ErrorPartida(
      'NIVEL_INVALIDO',
      `El nivel ${String(numero)} no existe: hay ${String(TOTAL_NIVELES)}`,
    );
  }
}

/** Se puede entrar a ese nivel. */
export function estaDesbloqueado(progreso: ProgresoHistoria, numero: number): boolean {
  comprobarNivel(numero);
  return numero <= progreso.desbloqueado;
}

/** Ese nivel ya se gano alguna vez. */
export function estaSuperado(progreso: ProgresoHistoria, numero: number): boolean {
  comprobarNivel(numero);
  return progreso.superados.includes(numero);
}

/**
 * Apunta como acabo un nivel y devuelve el progreso resultante.
 *
 * Solo se avanza ganando: **si se pierde, el progreso no se mueve** y hay que
 * repetir el nivel. Perder no quita nada de lo ya conseguido, que seria
 * castigar dos veces por lo mismo.
 *
 * Ganar un nivel ya superado (rejugarlo) no rompe nada: no se duplica en la
 * lista ni retrocede el desbloqueo.
 */
export function registrarResultado(
  progreso: ProgresoHistoria,
  numero: number,
  gano: boolean,
): ProgresoHistoria {
  comprobarNivel(numero);
  if (!gano) {
    return progreso;
  }

  const superados = progreso.superados.includes(numero)
    ? progreso.superados
    : [...progreso.superados, numero].sort((a, b) => a - b);

  return {
    desbloqueado: Math.max(progreso.desbloqueado, Math.min(numero + 1, TOTAL_NIVELES)),
    superados,
  };
}

/** Estan los cincuenta niveles superados. */
export function historiaCompletada(progreso: ProgresoHistoria): boolean {
  return progreso.superados.length === TOTAL_NIVELES;
}
