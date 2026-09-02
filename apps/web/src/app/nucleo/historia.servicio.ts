import { Injectable, computed, effect, inject, signal } from '@angular/core';
import {
  NIVELES_HISTORIA,
  TOTAL_NIVELES,
  estaDesbloqueado,
  estaSuperado,
  historiaCompletada,
  obtenerNivel,
  progresoInicial,
  registrarResultado,
  type NivelHistoria,
  type ProgresoHistoria,
} from '@minehunt/game-engine';

import { ServicioPartida } from './partida.servicio';

/** Clave con la que se recuerda el progreso del Modo Historia. */
const CLAVE_ALMACENAMIENTO = 'minehunt.historia';

/**
 * Puesto que ocupa el jugador en los niveles de Historia.
 *
 * Siempre el 0: el nivel describe a sus rivales de la IA y estos se sientan
 * detras, en los puestos 1 en adelante. Es lo que permite saber si la partida
 * se gano mirando quien fue el ganador.
 */
export const JUGADOR_HUMANO = 0;

function esEnteroDeNivel(valor: unknown): valor is number {
  return (
    typeof valor === 'number' && Number.isInteger(valor) && valor >= 1 && valor <= TOTAL_NIVELES
  );
}

/**
 * Valida el progreso guardado antes de dejarlo entrar.
 *
 * Mismo criterio que con los ajustes: es texto que puede haber escrito
 * cualquiera y que sobrevive a los cambios de version, asi que si algo no
 * cuadra se descarta el lote entero y se empieza de cero. Aqui pesa ademas
 * que un progreso inventado desbloquearia niveles sin jugarlos.
 */
function validar(datos: unknown): ProgresoHistoria | null {
  if (typeof datos !== 'object' || datos === null) {
    return null;
  }
  const posible = datos as Record<string, unknown>;

  const desbloqueado = posible['desbloqueado'];
  const superados = posible['superados'];
  if (!esEnteroDeNivel(desbloqueado) || !Array.isArray(superados)) {
    return null;
  }
  if (!superados.every(esEnteroDeNivel) || new Set(superados).size !== superados.length) {
    return null;
  }
  // No se puede haber superado un nivel al que ni siquiera se podia entrar.
  if (superados.some((numero) => numero > desbloqueado)) {
    return null;
  }

  return {
    desbloqueado,
    superados: [...superados].sort((a, b) => a - b),
  };
}

/**
 * Progreso del Modo Historia y puente entre un nivel y el motor.
 *
 * Guarda hasta donde ha llegado el jugador (en localStorage, para que siga
 * ahi la proxima vez) y monta la partida de un nivel sobre ServicioPartida,
 * que es el unico que habla con el motor. La logica de que desbloquea que vive
 * en el motor, en historia/progreso; aqui solo se persiste y se publica como
 * senal para que la pantalla se repinte sola.
 *
 * Apunta el resultado el solo: vigila el estado de la partida y, en cuanto
 * termina un nivel, lo registra. Asi da igual por donde salga el jugador de la
 * pantalla de juego, que el nivel ganado no se pierde.
 */
@Injectable({ providedIn: 'root' })
export class ServicioHistoria {
  private readonly partida = inject(ServicioPartida);

  /** Evita apuntar dos veces el mismo final de partida. */
  private resultadoApuntado = false;

  private readonly progresoInterno = signal<ProgresoHistoria>(progresoInicial());
  private readonly nivelEnCursoInterno = signal<NivelHistoria | null>(null);

  readonly progreso = this.progresoInterno.asReadonly();
  /** Nivel que se esta jugando, o null si la partida en curso no es de Historia. */
  readonly nivelEnCurso = this.nivelEnCursoInterno.asReadonly();

  readonly niveles = NIVELES_HISTORIA;
  readonly totalNiveles = TOTAL_NIVELES;

  readonly totalSuperados = computed(() => this.progresoInterno().superados.length);
  readonly completada = computed(() => historiaCompletada(this.progresoInterno()));

  constructor() {
    const guardado = this.cargar();
    if (guardado !== null) {
      this.progresoInterno.set(guardado);
    }

    effect(() => {
      const estado = this.partida.estado();
      const nivel = this.nivelEnCursoInterno();
      if (nivel === null || estado === null) {
        return;
      }
      // Una revancha vuelve a poner la partida en marcha: se puede apuntar otra vez.
      if (!estado.terminada) {
        this.resultadoApuntado = false;
        return;
      }
      if (this.resultadoApuntado) {
        return;
      }

      this.resultadoApuntado = true;
      this.apuntar(nivel.numero, !estado.empate && estado.ganador === JUGADOR_HUMANO);
    });
  }

  estaDesbloqueado(numero: number): boolean {
    return estaDesbloqueado(this.progresoInterno(), numero);
  }

  estaSuperado(numero: number): boolean {
    return estaSuperado(this.progresoInterno(), numero);
  }

  /** El nivel siguiente a ese, o null si era el ultimo. */
  siguienteDe(numero: number): NivelHistoria | null {
    return obtenerNivel(numero + 1);
  }

  /**
   * Monta la partida de un nivel: el jugador en el puesto 0 y los rivales que
   * el nivel indique detras. Devuelve false si ese nivel sigue bloqueado.
   */
  jugar(nivel: NivelHistoria): boolean {
    if (!this.estaDesbloqueado(nivel.numero)) {
      return false;
    }

    this.resultadoApuntado = false;
    this.nivelEnCursoInterno.set(nivel);
    this.partida.iniciar({
      ancho: nivel.ancho,
      alto: nivel.alto,
      minas: nivel.minas,
      numJugadores: nivel.rivales.length + 1,
      numHumanos: 1,
      nivelesIA: nivel.rivales,
      recargaOndaSegundos: nivel.recargaOndaSegundos,
      tiempoPorTurnoSegundos: nivel.tiempoPorTurnoSegundos,
    });
    return true;
  }

  /** Deja la partida de Historia y vuelve a dejar el modo en reposo. */
  salir(): void {
    this.nivelEnCursoInterno.set(null);
    this.resultadoApuntado = false;
    this.partida.abandonar();
  }

  /** Borra el progreso y vuelve a dejar solo el primer nivel abierto. */
  reiniciarProgreso(): void {
    this.progresoInterno.set(progresoInicial());
    try {
      localStorage.removeItem(CLAVE_ALMACENAMIENTO);
    } catch {
      // Nada que olvidar si no habia donde guardar.
    }
  }

  /**
   * Apunta como acabo un nivel. Solo se avanza ganando: perder no mueve el
   * progreso ni quita lo conseguido, asi que se repite el nivel y ya esta.
   */
  private apuntar(numero: number, gano: boolean): void {
    const progreso = registrarResultado(this.progresoInterno(), numero, gano);
    this.progresoInterno.set(progreso);
    this.guardar(progreso);
  }

  private cargar(): ProgresoHistoria | null {
    try {
      const guardado = localStorage.getItem(CLAVE_ALMACENAMIENTO);
      return guardado === null ? null : validar(JSON.parse(guardado));
    } catch {
      // Almacenamiento bloqueado o JSON corrupto: se empieza de cero.
      return null;
    }
  }

  private guardar(progreso: ProgresoHistoria): void {
    try {
      localStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(progreso));
    } catch {
      // Sin almacenamiento, el progreso vale solo para esta sesion.
    }
  }
}
