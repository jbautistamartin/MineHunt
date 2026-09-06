import { NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  output,
} from '@angular/core';
import type { CeldaVisible, Coordenada, EstadoPartida } from '@minehunt/game-engine';

/**
 * Cuanto hay que mantener el dedo encima para que cuente como pulsacion larga.
 *
 * Es el tiempo que usa Android para su propia pulsacion larga, asi que es el
 * que el jugador ya tiene en la mano. Mas corto se dispararia queriendo clicar
 * normal; mas largo se siente como que el juego no responde.
 */
const MS_PULSACION_LARGA = 400;

/**
 * Lo que puede bailar el dedo sin que se cancele la pulsacion larga.
 *
 * Un dedo apoyado nunca esta del todo quieto. Pasado ese margen ya no es una
 * pulsacion: es un arrastre, y arrastrar no tiene que gastar la onda.
 */
const PX_DE_MARGEN = 12;

/**
 * Rejilla de juego.
 *
 * Solo pinta: no conoce las reglas ni toca el motor. Avisa hacia arriba de la
 * celda pulsada y la pantalla decide que hacer, para poder reutilizarlo tal
 * cual en el Modo Historia y en el multijugador online (Fase 7).
 */
@Component({
  selector: 'mh-tablero',
  imports: [NgClass],
  templateUrl: './tablero.html',
  styleUrl: './tablero.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // Lo lee el CSS para calcular el lado de la celda y que el tablero quepa.
    '[style.--columnas]': 'estado().ancho',
  },
})
export class Tablero {
  readonly estado = input.required<EstadoPartida>();
  /** Bloquea el tablero cuando la partida termina. */
  readonly bloqueado = input(false);

  readonly celdaPulsada = output<Coordenada>();
  /**
   * Celda pulsada con el boton derecho, que en la web es el atajo para lanzar
   * la onda expansiva sin pasar por el boton. El tablero no sabe que es una
   * onda: solo avisa de que se pulso de la otra manera.
   */
  readonly celdaPulsadaAlterna = output<Coordenada>();

  /**
   * Mantener el dedo sobre una celda vale por la pulsacion alterna.
   *
   * **Es la unica via en Android**, donde no hay boton derecho. Sustituye al
   * doble toque, que salia caro: con aquel, un toque suelto no podia resolverse
   * hasta comprobar que no venia un segundo, asi que **cada jugada normal
   * llegaba tarde**. Manteniendo el dedo no hay nada que esperar — el clic
   * normal se resuelve al soltar, como siempre — y ademas es el gesto que el
   * telefono ya usa para «la otra accion» en todas partes.
   *
   * Aun asi lo enciende la pantalla **solo cuando hay onda de verdad que
   * gastar**: sin onda, con la onda recargando o en el turno de otro, mantener
   * el dedo no tiene que hacer nada distinto de un clic.
   */
  readonly pulsacionLargaAlterna = input(false);

  readonly filas = computed(() => this.estado().celdas);

  /** Una columna por celda de ancho, todas del mismo lado. */
  readonly columnas = computed(() => `repeat(${String(this.estado().ancho)}, var(--lado-celda))`);

  /** El dedo apoyado ahora mismo, esperando a cumplir el tiempo. */
  private pendiente: {
    celda: Coordenada;
    x: number;
    y: number;
    temporizador: ReturnType<typeof setTimeout>;
  } | null = null;

  /**
   * La pulsacion larga ya se resolvio: el clic que viene detras no vale.
   *
   * Al soltar el dedo el navegador dispara `click` de todos modos, y sin esto
   * la celda se jugaria dos veces: una con onda y otra sin ella. Se apaga al
   * empezar la siguiente pulsacion y no al consumir el clic, porque ese clic
   * puede no llegar nunca — la celda ya esta destapada y su boton, apagado.
   */
  private alternaResuelta = false;

  constructor() {
    // Salir de la partida con el dedo a medias no puede dejar viva una jugada
    // que se dispare sobre un tablero que ya no existe.
    inject(DestroyRef).onDestroy(() => {
      this.olvidarPendiente();
    });
  }

  /** El clic de siempre: destapa la celda, salvo que ya lo hiciera el gesto. */
  pulsar(celda: CeldaVisible): void {
    if (this.alternaResuelta || this.bloqueado() || celda.estado !== 'oculta') {
      return;
    }
    this.celdaPulsada.emit({ x: celda.x, y: celda.y });
  }

  /** El dedo se apoya: empieza a contar para la pulsacion larga. */
  empezarPulsacion(evento: PointerEvent, celda: CeldaVisible): void {
    this.olvidarPendiente();
    this.alternaResuelta = false;
    if (!this.pulsacionLargaAlterna() || this.bloqueado() || celda.estado !== 'oculta') {
      return;
    }

    const destino: Coordenada = { x: celda.x, y: celda.y };
    this.pendiente = {
      celda: destino,
      x: evento.clientX,
      y: evento.clientY,
      temporizador: setTimeout(() => {
        this.pendiente = null;
        this.alternaResuelta = true;
        this.celdaPulsadaAlterna.emit(destino);
      }, MS_PULSACION_LARGA),
    };
  }

  /**
   * El dedo se va de paseo: esto ya no es una pulsacion.
   *
   * Sin esto, arrastrar el dedo por el tablero acabaria gastando la onda en la
   * celda donde se apoyo primero.
   */
  moverPulsacion(evento: PointerEvent): void {
    const pendiente = this.pendiente;
    if (pendiente === null) {
      return;
    }
    if (
      Math.abs(evento.clientX - pendiente.x) > PX_DE_MARGEN ||
      Math.abs(evento.clientY - pendiente.y) > PX_DE_MARGEN
    ) {
      this.olvidarPendiente();
    }
  }

  /** Se solto (o se fue el dedo) antes de tiempo: era un clic normal. */
  soltarPulsacion(): void {
    this.olvidarPendiente();
  }

  private olvidarPendiente(): void {
    if (this.pendiente !== null) {
      clearTimeout(this.pendiente.temporizador);
      this.pendiente = null;
    }
  }

  /**
   * Pulsacion con el boton derecho. Se traga el menu contextual del navegador
   * siempre, incluso sobre celdas ya destapadas o con el tablero bloqueado:
   * que aparezca el menu del navegador en mitad de una partida es peor que no
   * hacer nada.
   */
  pulsarAlterna(evento: Event, celda: CeldaVisible): void {
    evento.preventDefault();
    if (this.bloqueado() || celda.estado !== 'oculta') {
      return;
    }
    this.olvidarPendiente();
    this.celdaPulsadaAlterna.emit({ x: celda.x, y: celda.y });
  }

  /**
   * Clases de una celda: su estado, el color del numero y, si esconde una mina
   * ya encontrada, el color del jugador que se la apunto.
   *
   * Las minas que salen al destapar el tablero al final no son de nadie, asi
   * que llevan 'mina' pero tambien 'sin-duenno', que las pinta apagadas para
   * que no se confundan con las que si se llevo alguien.
   */
  clasesDe(celda: CeldaVisible): Record<string, boolean> {
    return {
      oculta: celda.estado === 'oculta',
      despejada: celda.estado === 'despejada',
      mina: celda.estado === 'mina-encontrada' || celda.estado === 'mina-sin-encontrar',
      'sin-duenno': celda.estado === 'mina-sin-encontrar',
      [`n${String(celda.minasAdyacentes ?? 0)}`]:
        celda.estado === 'despejada' && (celda.minasAdyacentes ?? 0) > 0,
      [`jugador-${String(celda.encontradaPor ?? 0)}`]: celda.encontradaPor !== null,
    };
  }

  /** Texto de la celda: el numero de minas alrededor, o nada si es 0. */
  textoDe(celda: CeldaVisible): string {
    if (celda.estado !== 'despejada') {
      return '';
    }
    return celda.minasAdyacentes !== null && celda.minasAdyacentes > 0
      ? String(celda.minasAdyacentes)
      : '';
  }

  /** Identidad estable de cada celda para que Angular no rehaga la rejilla entera. */
  clave(_indice: number, celda: CeldaVisible): string {
    return `${String(celda.x)},${String(celda.y)}`;
  }
}
