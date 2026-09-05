import { randomInt } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { AZAR, RELOJ, type Azar, type Reloj } from './dependencias.js';
import { Sala } from './sala.js';

/**
 * Alfabeto de los codigos de sala.
 *
 * Sin O ni 0, ni I ni 1: el codigo se dicta en voz alta o se copia de una
 * pantalla, y ahi esas parejas se confunden siempre.
 */
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LARGO_DEL_CODIGO = 4;

/** Guarda las salas vivas y reparte codigos para entrar en ellas. */
@Injectable()
export class ServicioSalas {
  private readonly salas = new Map<string, Sala>();

  constructor(
    @Inject(RELOJ) private readonly ahora: Reloj,
    @Inject(AZAR) private readonly azar: Azar,
  ) {}

  /** Abre una sala con un codigo libre. */
  crear(): Sala {
    const sala = new Sala(this.codigoLibre(), this.ahora, this.azar);
    this.salas.set(sala.codigo, sala);
    return sala;
  }

  /** La sala de ese codigo, mirando en mayusculas: se teclea a mano. */
  buscar(codigo: string): Sala | null {
    return this.salas.get(codigo.trim().toUpperCase()) ?? null;
  }

  eliminar(codigo: string): void {
    this.salas.delete(codigo);
  }

  todas(): readonly Sala[] {
    return [...this.salas.values()];
  }

  /**
   * Codigo que no este cogido.
   *
   * El azar de aqui es el del sistema y no el inyectado a proposito: las
   * pruebas fijan el suyo para que las minas caigan siempre igual, y con un
   * azar constante todas las salas pedirian el mismo codigo y no habria forma
   * de abrir la segunda.
   */
  private codigoLibre(): string {
    for (let intento = 0; intento < 100; intento += 1) {
      const codigo = Array.from(
        { length: LARGO_DEL_CODIGO },
        () => ALFABETO[randomInt(ALFABETO.length)],
      ).join('');

      if (!this.salas.has(codigo)) {
        return codigo;
      }
    }

    // Con 32^4 combinaciones esto no pasa jugando; si pasara, mas largo antes
    // que devolver un codigo pisado.
    return `${Date.now().toString(36).toUpperCase()}`;
  }
}
