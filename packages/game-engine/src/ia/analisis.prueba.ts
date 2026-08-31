import { describe, expect, it } from 'vitest';

import {
  celdasOcultas,
  clave,
  construirRestricciones,
  deducirBasico,
  deducirCombinado,
  estimarProbabilidades,
} from './analisis.js';
import { tableroDe } from './estado-de-prueba.ayuda.js';

/** Ordena claves de celdas para poder compararlas sin depender del orden. */
function claves(celdas: readonly { x: number; y: number }[]): string[] {
  return celdas.map(clave).sort();
}

describe('construirRestricciones', () => {
  it('descuenta las minas que ya se encontraron alrededor', () => {
    // Reparto real: minas en (0,0) [ya encontrada] y (1,0) [oculta].
    //   * # #
    //   2 2 1
    //   0 0 0
    const estado = tableroDe(['*##', '221', '000'], 1);
    const restricciones = construirRestricciones(estado);

    const desdeElDos = restricciones.find((r) => r.origen.x === 1 && r.origen.y === 1);
    // El 2 de (1,1) ya tiene una mina encontrada al lado, asi que le queda 1
    // repartida entre sus dos vecinas ocultas.
    expect(desdeElDos?.minasPendientes).toBe(1);
    expect(claves(desdeElDos?.ocultas ?? [])).toEqual(['1,0', '2,0']);
  });

  it('ignora las celdas numeradas que ya no tienen vecinas ocultas', () => {
    const estado = tableroDe(['000', '000'], 0);

    expect(construirRestricciones(estado)).toHaveLength(0);
  });

  it('no genera restricciones a partir de celdas ocultas', () => {
    const estado = tableroDe(['###', '###'], 2);

    expect(construirRestricciones(estado)).toHaveLength(0);
    expect(celdasOcultas(estado)).toHaveLength(6);
  });
});

describe('deducirBasico (nivel 2)', () => {
  it('marca como minas las ocultas de una celda saturada', () => {
    // Reparto real: minas en (0,0), (1,0) y (2,0).
    const estado = tableroDe(['###', '232', '000'], 3);

    const deducciones = deducirBasico(construirRestricciones(estado));

    expect(claves(deducciones.minasSeguras)).toEqual(['0,0', '1,0', '2,0']);
    expect(deducciones.libresSeguras).toHaveLength(0);
  });

  it('marca como libres las ocultas de una celda sin minas pendientes', () => {
    // Reparto real: unica mina en (3,0).
    const estado = tableroDe(['####', '0011', '0000'], 1);

    const deducciones = deducirBasico(construirRestricciones(estado));

    // Los ceros liberan (0,0), (1,0) y (2,0); eso deja al 1 de (2,1) con una
    // sola oculta y una mina pendiente, asi que encadena y resuelve (3,0).
    expect(claves(deducciones.libresSeguras)).toEqual(['0,0', '1,0', '2,0']);
    expect(claves(deducciones.minasSeguras)).toEqual(['3,0']);
  });

  it('no concluye nada cuando ninguna celda esta saturada', () => {
    // Reparto real: minas en (1,0) y (2,0), con el 1-2-2-1 clasico.
    const estado = tableroDe(['####', '1221', '0000'], 2);

    const deducciones = deducirBasico(construirRestricciones(estado));

    expect(deducciones.minasSeguras).toHaveLength(0);
    expect(deducciones.libresSeguras).toHaveLength(0);
  });
});

describe('deducirCombinado (nivel 3)', () => {
  it('resuelve por subconjuntos lo que la deduccion basica no alcanza', () => {
    // El mismo 1-2-2-1 de antes. El 1 de (0,1) cubre {(0,0),(1,0)} con una
    // mina; el 2 de (1,1) cubre {(0,0),(1,0),(2,0)} con dos: la diferencia
    // {(2,0)} tiene que ser mina.
    const estado = tableroDe(['####', '1221', '0000'], 2);

    const deducciones = deducirCombinado(construirRestricciones(estado));

    expect(claves(deducciones.minasSeguras)).toContain('2,0');
  });

  it('llega al menos a lo mismo que la deduccion basica', () => {
    const estado = tableroDe(['###', '232', '000'], 3);

    const basico = deducirBasico(construirRestricciones(estado));
    const combinado = deducirCombinado(construirRestricciones(estado));

    expect(claves(combinado.minasSeguras)).toEqual(
      expect.arrayContaining(claves(basico.minasSeguras)),
    );
  });
});

describe('estimarProbabilidades (nivel 4)', () => {
  it('reparte las minas pendientes entre las ocultas de cada restriccion', () => {
    // El 2 de (2,1) tiene ocho vecinas ocultas y dos minas entre ellas.
    const estado = tableroDe(['#####', '##2##', '#####'], 2);

    const probabilidades = estimarProbabilidades(estado, construirRestricciones(estado));

    expect(probabilidades.get('1,0')).toBeCloseTo(2 / 8, 5);
    expect(probabilidades.get('3,2')).toBeCloseTo(2 / 8, 5);
  });

  it('a las celdas fuera de toda restriccion les aplica la densidad que queda', () => {
    const estado = tableroDe(['#####', '##2##', '#####'], 2);

    const probabilidades = estimarProbabilidades(estado, construirRestricciones(estado));

    // (0,0) no toca al 2: le queda la densidad general, 2 minas / 14 ocultas.
    expect(probabilidades.get('0,0')).toBeCloseTo(2 / 14, 5);
  });

  it('da probabilidad a todas las celdas ocultas y solo a esas', () => {
    const estado = tableroDe(['####', '1221', '0000'], 2);

    const probabilidades = estimarProbabilidades(estado, construirRestricciones(estado));

    expect(probabilidades.size).toBe(celdasOcultas(estado).length);
    expect(probabilidades.has('0,1')).toBe(false);
  });
});
