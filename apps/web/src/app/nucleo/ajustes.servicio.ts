import { Injectable } from '@angular/core';
import { MAX_JUGADORES, MIN_JUGADORES, type NivelIA } from '@minehunt/game-engine';

/**
 * Ajustes del Modo Entrenamiento que se recuerdan entre sesiones.
 *
 * Es lo que el jugador dejo puesto en la pantalla de configuracion, no una
 * partida: aqui no hay tablero ni marcador, solo los numeros con los que se
 * creara la siguiente.
 */
export interface AjustesEntrenamiento {
  readonly ancho: number;
  readonly alto: number;
  readonly minas: number;
  readonly numJugadores: number;
  readonly numHumanos: number;
  readonly nivelesIA: readonly NivelIA[];
  readonly recargaOndaSegundos: number;
  readonly tiempoPorTurnoSegundos: number;
}

/** Clave con la que se recuerdan los ajustes. */
const CLAVE_ALMACENAMIENTO = 'minehunt.entrenamiento';

const LADO_MINIMO = 3;
const LADO_MAXIMO = 30;
const RECARGA_MAXIMA_S = 120;
const TIEMPO_TURNO_MAXIMO_S = 120;

function esEntero(valor: unknown, minimo: number, maximo: number): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= minimo && valor <= maximo;
}

function esNivel(valor: unknown): valor is NivelIA {
  return esEntero(valor, 1, 5);
}

/**
 * Valida lo que venia guardado antes de dejarlo entrar.
 *
 * Lo de localStorage es texto que puede haber escrito cualquiera y que ademas
 * sobrevive a los cambios de formato entre versiones: si algo no cuadra se
 * descarta el lote entero y se vuelve a los valores por defecto, que es mucho
 * mas seguro que arrancar una partida con medidas imposibles.
 */
function validar(datos: unknown): AjustesEntrenamiento | null {
  if (typeof datos !== 'object' || datos === null) {
    return null;
  }
  const posible = datos as Record<string, unknown>;

  if (
    !esEntero(posible['ancho'], LADO_MINIMO, LADO_MAXIMO) ||
    !esEntero(posible['alto'], LADO_MINIMO, LADO_MAXIMO) ||
    !esEntero(posible['numJugadores'], MIN_JUGADORES, MAX_JUGADORES) ||
    !esEntero(posible['recargaOndaSegundos'], 0, RECARGA_MAXIMA_S) ||
    !esEntero(posible['tiempoPorTurnoSegundos'], 0, TIEMPO_TURNO_MAXIMO_S)
  ) {
    return null;
  }

  const ancho = posible['ancho'];
  const alto = posible['alto'];
  const numJugadores = posible['numJugadores'];

  // Las minas y los humanos dependen de los otros valores, asi que se validan
  // contra ellos y no contra constantes.
  if (
    !esEntero(posible['minas'], 1, ancho * alto - 1) ||
    !esEntero(posible['numHumanos'], 0, numJugadores)
  ) {
    return null;
  }

  const niveles = posible['nivelesIA'];
  if (!Array.isArray(niveles) || niveles.length === 0 || !niveles.every(esNivel)) {
    return null;
  }

  return {
    ancho,
    alto,
    minas: posible['minas'],
    numJugadores,
    numHumanos: posible['numHumanos'],
    nivelesIA: [...niveles],
    recargaOndaSegundos: posible['recargaOndaSegundos'],
    tiempoPorTurnoSegundos: posible['tiempoPorTurnoSegundos'],
  };
}

/**
 * Recuerda los ajustes del Modo Entrenamiento de una sesion a la siguiente.
 *
 * Todo el trato con localStorage esta envuelto en try/catch: hay navegadores
 * que lo bloquean, y quedarse sin memoria de ajustes no puede impedir jugar.
 */
@Injectable({ providedIn: 'root' })
export class ServicioAjustes {
  /** Lo ultimo que se guardo, o null si no hay nada valido. */
  cargar(): AjustesEntrenamiento | null {
    try {
      const guardado = localStorage.getItem(CLAVE_ALMACENAMIENTO);
      return guardado === null ? null : validar(JSON.parse(guardado));
    } catch {
      // Almacenamiento bloqueado o JSON corrupto: se empieza de cero.
      return null;
    }
  }

  guardar(ajustes: AjustesEntrenamiento): void {
    try {
      localStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(ajustes));
    } catch {
      // Sin almacenamiento, los ajustes valen solo para esta sesion.
    }
  }

  /** Olvida lo guardado: la proxima vez se arranca con los valores por defecto. */
  olvidar(): void {
    try {
      localStorage.removeItem(CLAVE_ALMACENAMIENTO);
    } catch {
      // Nada que olvidar si no habia donde guardar.
    }
  }
}
