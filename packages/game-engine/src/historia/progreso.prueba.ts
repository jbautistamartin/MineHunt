import { describe, expect, it } from 'vitest';

import { ErrorPartida } from '../tipos.js';
import { TOTAL_NIVELES } from './niveles.js';
import {
  estaDesbloqueado,
  estaSuperado,
  historiaCompletada,
  progresoInicial,
  registrarResultado,
  type ProgresoHistoria,
} from './progreso.js';

/** Gana todos los niveles del 1 al indicado, en orden. */
function ganarHasta(numero: number): ProgresoHistoria {
  let progreso = progresoInicial();
  for (let nivel = 1; nivel <= numero; nivel += 1) {
    progreso = registrarResultado(progreso, nivel, true);
  }
  return progreso;
}

describe('Progreso del Modo Historia', () => {
  it('se empieza con el primer nivel y nada superado', () => {
    const progreso = progresoInicial();

    expect(progreso.desbloqueado).toBe(1);
    expect(progreso.superados).toEqual([]);
    expect(estaDesbloqueado(progreso, 1)).toBe(true);
    expect(estaDesbloqueado(progreso, 2)).toBe(false);
  });

  it('ganar desbloquea el siguiente nivel', () => {
    const progreso = registrarResultado(progresoInicial(), 1, true);

    expect(progreso.desbloqueado).toBe(2);
    expect(progreso.superados).toEqual([1]);
    expect(estaSuperado(progreso, 1)).toBe(true);
    expect(estaDesbloqueado(progreso, 2)).toBe(true);
    expect(estaDesbloqueado(progreso, 3)).toBe(false);
  });

  it('perder deja el progreso donde estaba: se repite el nivel', () => {
    const antes = ganarHasta(3);

    const despues = registrarResultado(antes, 4, false);

    expect(despues).toEqual(antes);
    expect(despues.desbloqueado).toBe(4);
    expect(estaSuperado(despues, 4)).toBe(false);
  });

  it('perder un nivel ya superado no quita lo conseguido', () => {
    const antes = ganarHasta(5);

    const despues = registrarResultado(antes, 2, false);

    expect(despues.superados).toEqual([1, 2, 3, 4, 5]);
    expect(despues.desbloqueado).toBe(6);
  });

  it('rejugar y volver a ganar un nivel viejo no duplica ni retrocede', () => {
    const antes = ganarHasta(5);

    const despues = registrarResultado(antes, 2, true);

    expect(despues.superados).toEqual([1, 2, 3, 4, 5]);
    expect(despues.desbloqueado).toBe(6);
  });

  it('el ultimo nivel no desbloquea nada mas alla', () => {
    const antes = ganarHasta(TOTAL_NIVELES - 1);

    const despues = registrarResultado(antes, TOTAL_NIVELES, true);

    expect(despues.desbloqueado).toBe(TOTAL_NIVELES);
    expect(historiaCompletada(despues)).toBe(true);
  });

  it('la historia no esta completa mientras falte un nivel', () => {
    expect(historiaCompletada(progresoInicial())).toBe(false);
    expect(historiaCompletada(ganarHasta(TOTAL_NIVELES - 1))).toBe(false);
  });

  it('rechaza niveles que no existen', () => {
    const progreso = progresoInicial();

    expect(() => registrarResultado(progreso, 0, true)).toThrowError(ErrorPartida);
    expect(() => registrarResultado(progreso, TOTAL_NIVELES + 1, true)).toThrowError(
      ErrorPartida,
    );
    expect(() => estaDesbloqueado(progreso, 1.5)).toThrowError(ErrorPartida);
  });

  it('el progreso es inmutable: registrar devuelve uno nuevo', () => {
    const antes = progresoInicial();

    const despues = registrarResultado(antes, 1, true);

    expect(antes.desbloqueado).toBe(1);
    expect(antes.superados).toEqual([]);
    expect(despues).not.toBe(antes);
  });
});
