import { randomInt, randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { Sala } from '@minehunt/game-engine';

import type { Configuracion } from '../configuracion.js';
import { AZAR, CONFIGURACION, RELOJ, type Azar, type Reloj } from './dependencias.js';

/**
 * Quien abre una sala, a efectos de los topes.
 *
 * Son dos y no uno porque protegen de cosas distintas: la conexion frena a
 * quien abre salas una detras de otra desde la misma pestana, y la IP a quien
 * lo intenta abriendo pestanas nuevas. Detras de un router domestico la IP la
 * comparte toda la casa, asi que su tope no puede ser tan estrecho como el de
 * la conexion.
 */
export interface Dueno {
  readonly conexion: string;
  readonly ip: string;
}

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

  /**
   * Quien abrio cada sala de las que siguen vivas.
   *
   * Se apunta aqui y no dentro de `Sala` porque a la sala no le importa: es
   * contabilidad del servidor, no una regla del juego, y `Sala` se prueba sin
   * saber nada de conexiones ni de IPs.
   */
  private readonly duenos = new Map<string, Dueno>();

  constructor(
    @Inject(RELOJ) private readonly ahora: Reloj,
    @Inject(AZAR) private readonly azar: Azar,
    @Inject(CONFIGURACION) private readonly configuracion: Configuracion,
  ) {}

  /**
   * Abre una sala con un codigo libre, si a quien la pide le quedan.
   *
   * Devuelve null cuando ya tiene abiertas todas las que le tocan. Las salas
   * viven en memoria y abrirlas no cuesta nada, asi que sin tope una sola
   * pestana puede quedarse con el servidor entero.
   */
  crear(dueno: Dueno): Sala | null {
    if (!this.leQuedanSalas(dueno)) {
      return null;
    }

    // La credencial se inyecta como el reloj y el azar: `Sala` vive en el
    // motor, que no sabe de Node, y en el telefono que monta una partida local
    // la fabrica el navegador.
    const sala = new Sala(this.codigoLibre(), this.ahora, this.azar, randomUUID);
    this.salas.set(sala.codigo, sala);
    this.duenos.set(sala.codigo, dueno);
    return sala;
  }

  /** Cuantas de las salas vivas abrio esa conexion, y cuantas esa IP. */
  private leQuedanSalas(dueno: Dueno): boolean {
    let deLaConexion = 0;
    let deLaIp = 0;

    for (const abierta of this.duenos.values()) {
      if (abierta.conexion === dueno.conexion) {
        deLaConexion += 1;
      }
      if (abierta.ip === dueno.ip) {
        deLaIp += 1;
      }
    }

    return (
      deLaConexion < this.configuracion.maxSalasPorConexion &&
      deLaIp < this.configuracion.maxSalasPorIp
    );
  }

  /** La sala de ese codigo, mirando en mayusculas: se teclea a mano. */
  buscar(codigo: string): Sala | null {
    return this.salas.get(codigo.trim().toUpperCase()) ?? null;
  }

  eliminar(codigo: string): void {
    this.salas.delete(codigo);
    // Con la sala se va lo que ocupaba del tope de quien la abrio, o cerrarla
    // no le devolveria el hueco y el tope acabaria siendo «salas por vida».
    this.duenos.delete(codigo);
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
