import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MAX_JUGADORES, MIN_JUGADORES, NIVELES_IA, type NivelIA } from '@minehunt/game-engine';
import { TranslatePipe } from '@ngx-translate/core';

import {
  ServicioAjustes,
  type AjustesEntrenamiento,
} from '../../nucleo/ajustes.servicio';
import { ServicioPartida } from '../../nucleo/partida.servicio';
import { VERSION_APP } from '../../nucleo/version';

/** Limites del tablero, para que la partida sea jugable en un movil. */
const LADO_MINIMO = 3;
const LADO_MAXIMO = 30;

/** Proporcion de minas con la que se propone un tablero nuevo. */
const DENSIDAD_SUGERIDA = 0.18;

/** Recarga de la onda expansiva, en segundos. */
const RECARGA_POR_DEFECTO_S = 20;
const RECARGA_MINIMA_S = 0;
const RECARGA_MAXIMA_S = 120;

/**
 * Tiempo por turno, en segundos. Con 0 se juega sin reloj; el Modo Historia
 * (Fase 4) lo ira apretando nivel a nivel.
 */
const TIEMPO_TURNO_POR_DEFECTO_S = 15;
const TIEMPO_TURNO_MINIMO_S = 0;
const TIEMPO_TURNO_MAXIMO_S = 120;

/** Nivel con el que se propone cada bot mientras no se toque. */
const NIVEL_IA_POR_DEFECTO: NivelIA = 3;

/**
 * Con que arranca la pantalla la primera vez, y a donde vuelve el boton de
 * restablecer. Es tambien el respaldo si lo guardado no supera la validacion.
 */
const AJUSTES_POR_DEFECTO: AjustesEntrenamiento = {
  ancho: 9,
  alto: 9,
  minas: 15,
  numJugadores: 2,
  numHumanos: 1,
  nivelesIA: Array.from({ length: MAX_JUGADORES }, () => NIVEL_IA_POR_DEFECTO),
  recargaOndaSegundos: RECARGA_POR_DEFECTO_S,
  tiempoPorTurnoSegundos: TIEMPO_TURNO_POR_DEFECTO_S,
};

/**
 * Pantalla de configuracion del Modo Entrenamiento.
 *
 * De 2 a 4 jugadores, de los cuales 0 a 4 pueden ser humanos; el resto los
 * lleva la IA, y cada bot puede jugar a un nivel distinto. Con 0 humanos la
 * partida se juega sola; el ritmo lo pone el retardo aleatorio de los bots,
 * que vive en ServicioPartida y no se configura.
 *
 * Lo que se deje puesto aqui se recuerda para la proxima sesion, porque nadie
 * quiere volver a montar su tablero de 20x20 cada vez que abre el juego.
 */
@Component({
  selector: 'mh-configuracion',
  imports: [TranslatePipe, RouterLink],
  templateUrl: './configuracion.html',
  styleUrl: './configuracion.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Configuracion {
  private readonly partida = inject(ServicioPartida);
  private readonly ajustes = inject(ServicioAjustes);
  private readonly router = inject(Router);

  readonly ladoMinimo = LADO_MINIMO;
  readonly ladoMaximo = LADO_MAXIMO;
  readonly minJugadores = MIN_JUGADORES;
  readonly maxJugadores = MAX_JUGADORES;

  readonly version = VERSION_APP;
  readonly niveles = NIVELES_IA;
  readonly recargaMinima = RECARGA_MINIMA_S;
  readonly recargaMaxima = RECARGA_MAXIMA_S;
  readonly tiempoTurnoMinimo = TIEMPO_TURNO_MINIMO_S;
  readonly tiempoTurnoMaximo = TIEMPO_TURNO_MAXIMO_S;

  readonly ancho = signal(AJUSTES_POR_DEFECTO.ancho);
  readonly alto = signal(AJUSTES_POR_DEFECTO.alto);
  readonly minas = signal(AJUSTES_POR_DEFECTO.minas);
  readonly numJugadores = signal(AJUSTES_POR_DEFECTO.numJugadores);
  readonly numHumanos = signal(AJUSTES_POR_DEFECTO.numHumanos);
  /**
   * Nivel de cada puesto de bot, en orden de asiento. Se guardan los cuatro
   * aunque jueguen menos: asi cambiar el numero de jugadores no borra lo que
   * ya se habia elegido.
   */
  readonly nivelesIA = signal<readonly NivelIA[]>(AJUSTES_POR_DEFECTO.nivelesIA);
  readonly recargaOndaSegundos = signal(AJUSTES_POR_DEFECTO.recargaOndaSegundos);
  readonly tiempoPorTurnoSegundos = signal(AJUSTES_POR_DEFECTO.tiempoPorTurnoSegundos);

  /** Todo lo configurable, junto, tal y como se guarda y se restaura. */
  readonly ajustesActuales = computed<AjustesEntrenamiento>(() => ({
    ancho: this.ancho(),
    alto: this.alto(),
    minas: this.minas(),
    numJugadores: this.numJugadores(),
    numHumanos: this.numHumanos(),
    nivelesIA: this.nivelesIA(),
    recargaOndaSegundos: this.recargaOndaSegundos(),
    tiempoPorTurnoSegundos: this.tiempoPorTurnoSegundos(),
  }));

  constructor() {
    const guardados = this.ajustes.cargar();
    if (guardados !== null) {
      this.aplicar(guardados);
    }

    // Se guarda a cada cambio y no al empezar la partida: asi tambien se
    // recuerda lo que se estuvo trasteando aunque al final no se jugara.
    effect(() => {
      this.ajustes.guardar(this.ajustesActuales());
    });
  }

  /** Opciones del selector de jugadores: 2, 3 y 4. */
  readonly opcionesJugadores = Array.from(
    { length: MAX_JUGADORES - MIN_JUGADORES + 1 },
    (_valor, indice) => MIN_JUGADORES + indice,
  );

  /** Opciones de humanos: de 0 al total de jugadores de la partida. */
  readonly opcionesHumanos = computed(() =>
    Array.from({ length: this.numJugadores() + 1 }, (_valor, indice) => indice),
  );

  readonly numBots = computed(() => this.numJugadores() - this.numHumanos());
  readonly hayBots = computed(() => this.numBots() > 0);

  /**
   * Un puesto por bot en juego: indice dentro de nivelesIA, id del jugador que
   * ocupa y nivel elegido. Es lo que recorre la plantilla.
   */
  readonly puestosDeBot = computed(() =>
    Array.from({ length: this.numBots() }, (_valor, indice) => ({
      indice,
      idJugador: this.numHumanos() + indice,
      nivel: this.nivelesIA()[indice] ?? NIVEL_IA_POR_DEFECTO,
    })),
  );
  /** Sin humanos la partida se juega sola de principio a fin. */
  readonly soloBots = computed(() => this.numHumanos() === 0);

  readonly totalCeldas = computed(() => this.ancho() * this.alto());

  /** Como mucho una mina menos que celdas: la del primer clic queda libre. */
  readonly minasMaximas = computed(() => Math.max(1, this.totalCeldas() - 1));

  readonly densidad = computed(() =>
    Math.round((this.minas() / Math.max(1, this.totalCeldas())) * 100),
  );

  readonly dimensionesValidas = computed(
    () =>
      this.esLadoValido(this.ancho()) &&
      this.esLadoValido(this.alto()) &&
      this.totalCeldas() >= 2,
  );

  readonly minasValidas = computed(
    () =>
      Number.isInteger(this.minas()) &&
      this.minas() >= 1 &&
      this.minas() <= this.minasMaximas(),
  );

  readonly puedeEmpezar = computed(() => this.dimensionesValidas() && this.minasValidas());

  /** Al cambiar el tablero, ajusta las minas para que sigan cabiendo. */
  cambiarAncho(valor: string): void {
    this.ancho.set(this.aEntero(valor, this.ancho()));
    this.ajustarMinas();
  }

  cambiarAlto(valor: string): void {
    this.alto.set(this.aEntero(valor, this.alto()));
    this.ajustarMinas();
  }

  cambiarMinas(valor: string): void {
    this.minas.set(this.aEntero(valor, this.minas()));
  }

  /** Al cambiar el total de jugadores, los humanos no pueden pasarse. */
  cambiarJugadores(valor: number): void {
    this.numJugadores.set(valor);
    this.numHumanos.set(Math.min(this.numHumanos(), valor));
  }

  cambiarHumanos(valor: number): void {
    this.numHumanos.set(valor);
  }

  /** Cambia el nivel de un puesto de bot sin tocar el de los demas. */
  cambiarNivelDeBot(indice: number, valor: NivelIA): void {
    const niveles = [...this.nivelesIA()];
    niveles[indice] = valor;
    this.nivelesIA.set(niveles);
  }

  /** Pone el mismo nivel en todos los puestos, que es lo habitual. */
  igualarNiveles(valor: NivelIA): void {
    this.nivelesIA.set(this.nivelesIA().map(() => valor));
  }

  cambiarTiempoPorTurno(valor: string): void {
    const numero = this.aEntero(valor, this.tiempoPorTurnoSegundos());
    this.tiempoPorTurnoSegundos.set(
      Math.min(TIEMPO_TURNO_MAXIMO_S, Math.max(TIEMPO_TURNO_MINIMO_S, numero)),
    );
  }

  cambiarRecarga(valor: string): void {
    const numero = this.aEntero(valor, this.recargaOndaSegundos());
    this.recargaOndaSegundos.set(Math.min(RECARGA_MAXIMA_S, Math.max(RECARGA_MINIMA_S, numero)));
  }

  /** Vuelve a los valores de fabrica y olvida lo guardado. */
  reiniciarAjustes(): void {
    this.aplicar(AJUSTES_POR_DEFECTO);
    this.ajustes.olvidar();
  }

  empezar(): void {
    if (!this.puedeEmpezar()) {
      return;
    }
    this.partida.iniciar({
      ancho: this.ancho(),
      alto: this.alto(),
      minas: this.minas(),
      numJugadores: this.numJugadores(),
      numHumanos: this.numHumanos(),
      nivelesIA: this.puestosDeBot().map((puesto) => puesto.nivel),
      recargaOndaSegundos: this.recargaOndaSegundos(),
      tiempoPorTurnoSegundos: this.tiempoPorTurnoSegundos(),
    });
    void this.router.navigate(['/partida']);
  }

  /** Vuelca unos ajustes en los campos de la pantalla. */
  private aplicar(ajustes: AjustesEntrenamiento): void {
    this.ancho.set(ajustes.ancho);
    this.alto.set(ajustes.alto);
    this.minas.set(ajustes.minas);
    this.numJugadores.set(ajustes.numJugadores);
    this.numHumanos.set(ajustes.numHumanos);
    this.nivelesIA.set(this.completarNiveles(ajustes.nivelesIA));
    this.recargaOndaSegundos.set(ajustes.recargaOndaSegundos);
    this.tiempoPorTurnoSegundos.set(ajustes.tiempoPorTurnoSegundos);
  }

  /**
   * Deja siempre un nivel por cada puesto posible: lo guardado pudo venir de
   * una partida con menos jugadores de los que se elijan ahora.
   */
  private completarNiveles(niveles: readonly NivelIA[]): readonly NivelIA[] {
    return Array.from(
      { length: MAX_JUGADORES },
      (_valor, indice) => niveles[indice] ?? NIVEL_IA_POR_DEFECTO,
    );
  }

  private esLadoValido(lado: number): boolean {
    return Number.isInteger(lado) && lado >= LADO_MINIMO && lado <= LADO_MAXIMO;
  }

  /**
   * Recorta las minas al maximo que admite el tablero y, si el jugador no las
   * ha tocado, propone una cantidad proporcional al tamano.
   */
  private ajustarMinas(): void {
    if (!this.dimensionesValidas()) {
      return;
    }
    const sugeridas = Math.max(1, Math.round(this.totalCeldas() * DENSIDAD_SUGERIDA));
    this.minas.set(Math.min(sugeridas, this.minasMaximas()));
  }

  private aEntero(valor: string, porDefecto: number): number {
    const numero = Number.parseInt(valor, 10);
    return Number.isNaN(numero) ? porDefecto : numero;
  }
}
