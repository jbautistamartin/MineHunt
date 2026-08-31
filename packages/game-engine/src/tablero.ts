import type { CeldaVisible, Coordenada, EstadoCelda } from './tipos.js';
import { ErrorPartida } from './tipos.js';

/**
 * Celda con la informacion completa, incluida la mina.
 * Este tipo NUNCA sale del paquete: solo se expone a traves de CeldaVisible.
 */
interface CeldaInterna {
  tieneMina: boolean;
  estado: EstadoCelda;
  minasAdyacentes: number;
  /** Jugador que encontro la mina, si es que ya la encontro alguien. */
  encontradaPor: number | null;
}

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

/**
 * Tablero rectangular de MineHunt.
 *
 * Las minas no se colocan al construirlo, sino en el primer clic, para poder
 * garantizar que esa primera celda no tenga mina.
 */
export class Tablero {
  private readonly celdas: CeldaInterna[];
  private minasColocadas = false;

  constructor(
    readonly ancho: number,
    readonly alto: number,
    readonly totalMinas: number,
  ) {
    this.celdas = Array.from({ length: ancho * alto }, () => ({
      tieneMina: false,
      estado: 'oculta' as EstadoCelda,
      minasAdyacentes: 0,
      encontradaPor: null,
    }));
  }

  /** Indica si la coordenada cae dentro del tablero. */
  contiene(x: number, y: number): boolean {
    return x >= 0 && x < this.ancho && y >= 0 && y < this.alto;
  }

  /** Celda interna en una posicion. Falla si la posicion esta fuera del tablero. */
  private celda(x: number, y: number): CeldaInterna {
    if (!this.contiene(x, y)) {
      throw new ErrorPartida(
        'CELDA_FUERA_DEL_TABLERO',
        `La celda (${x}, ${y}) esta fuera de un tablero de ${this.ancho}x${this.alto}`,
      );
    }
    // El indice es valido porque ya se ha comprobado que cae dentro.
    return this.celdas[y * this.ancho + x] as CeldaInterna;
  }

  /** Estado visible de una celda. */
  estadoDe(x: number, y: number): EstadoCelda {
    return this.celda(x, y).estado;
  }

  /**
   * Coloca las minas al azar evitando la celda excluida, que es la primera
   * que clica el jugador, y despues calcula los numeros de cada celda.
   */
  colocarMinas(excluida: Coordenada, aleatorio: () => number): void {
    if (this.minasColocadas) {
      return;
    }

    const indiceExcluido = excluida.y * this.ancho + excluida.x;
    const candidatas: number[] = [];
    for (let indice = 0; indice < this.celdas.length; indice += 1) {
      if (indice !== indiceExcluido) {
        candidatas.push(indice);
      }
    }

    // Barajado de Fisher-Yates parcial: basta con extraer totalMinas posiciones.
    for (let i = 0; i < this.totalMinas; i += 1) {
      const salto = Math.floor(aleatorio() * (candidatas.length - i));
      const j = i + Math.min(salto, candidatas.length - i - 1);
      const temporal = candidatas[i] as number;
      candidatas[i] = candidatas[j] as number;
      candidatas[j] = temporal;
      (this.celdas[candidatas[i] as number] as CeldaInterna).tieneMina = true;
    }

    this.calcularNumeros();
    this.minasColocadas = true;
  }

  /** Recorre el tablero anotando en cada celda cuantas minas la rodean. */
  private calcularNumeros(): void {
    for (let y = 0; y < this.alto; y += 1) {
      for (let x = 0; x < this.ancho; x += 1) {
        this.celda(x, y).minasAdyacentes = this.contarMinasVecinas(x, y);
      }
    }
  }

  private contarMinasVecinas(x: number, y: number): number {
    let total = 0;
    for (const desplazamiento of VECINDAD) {
      const vecinoX = x + desplazamiento.x;
      const vecinoY = y + desplazamiento.y;
      if (this.contiene(vecinoX, vecinoY) && this.celda(vecinoX, vecinoY).tieneMina) {
        total += 1;
      }
    }
    return total;
  }

  /** Indica si la celda esconde una mina. Uso interno del motor. */
  tieneMina(x: number, y: number): boolean {
    return this.celda(x, y).tieneMina;
  }

  /** Marca una mina como encontrada por un jugador y devuelve la celda afectada. */
  marcarMinaEncontrada(x: number, y: number, jugador: number): Coordenada[] {
    const celda = this.celda(x, y);
    celda.estado = 'mina-encontrada';
    celda.encontradaPor = jugador;
    return [{ x, y }];
  }

  /**
   * Despeja una celda sin mina. Si no tiene minas alrededor, arrastra en
   * cascada a todas las celdas vacias conectadas y al borde numerado que las
   * rodea. La cascada es iterativa para no agotar la pila en tableros grandes.
   */
  despejar(x: number, y: number): Coordenada[] {
    const reveladas: Coordenada[] = [];
    const pendientes: Coordenada[] = [{ x, y }];

    while (pendientes.length > 0) {
      const actual = pendientes.pop() as Coordenada;
      const celda = this.celda(actual.x, actual.y);
      if (celda.estado !== 'oculta') {
        continue;
      }

      celda.estado = 'despejada';
      reveladas.push(actual);

      // Solo las celdas sin minas alrededor propagan la cascada.
      if (celda.minasAdyacentes !== 0) {
        continue;
      }
      for (const desplazamiento of VECINDAD) {
        const vecinoX = actual.x + desplazamiento.x;
        const vecinoY = actual.y + desplazamiento.y;
        if (
          this.contiene(vecinoX, vecinoY) &&
          this.celda(vecinoX, vecinoY).estado === 'oculta' &&
          !this.celda(vecinoX, vecinoY).tieneMina
        ) {
          pendientes.push({ x: vecinoX, y: vecinoY });
        }
      }
    }

    return reveladas;
  }

  /** Proyeccion del tablero sin filtrar informacion oculta. */
  aVisible(): CeldaVisible[][] {
    const filas: CeldaVisible[][] = [];
    for (let y = 0; y < this.alto; y += 1) {
      const fila: CeldaVisible[] = [];
      for (let x = 0; x < this.ancho; x += 1) {
        const celda = this.celda(x, y);
        fila.push({
          x,
          y,
          estado: celda.estado,
          // El numero solo se conoce cuando la celda esta despejada.
          minasAdyacentes: celda.estado === 'despejada' ? celda.minasAdyacentes : null,
          encontradaPor: celda.encontradaPor,
        });
      }
      filas.push(fila);
    }
    return filas;
  }
}
