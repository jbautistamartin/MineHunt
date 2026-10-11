import { JugadorIA, type NivelIA } from '../ia/jugador-ia.js';
import { MotorJuego } from '../motor.js';
import {
  ErrorPartida,
  MAX_JUGADORES,
  MIN_JUGADORES,
  type EstadoPartida,
} from '../tipos.js';
import type {
  ConfiguracionSala,
  EstadoSala,
  PuestoSala,
  Resultado,
  SalaAbierta,
  SucesoPartida,
  VistaSala,
} from './protocolo.js';

/**
 * Lo que espera el servidor a que vuelva un jugador caido antes de ponerle un
 * bot. Con menos, un parpadeo de la conexion ya le quitaba el turno; con mas,
 * los demas se quedan mirando.
 */
const GRACIA_ANTES_DEL_SUSTITUTO_MS = 3000;

/** Lo que tarda un bot entre jugada y jugada, para poder seguirle. */
const RITMO_DEL_BOT_MS = 700;

/**
 * Nivel del bot que sustituye a quien se cae: medio a proposito.
 *
 * Uno flojo regala la partida y uno de nivel 5 la gana por el ausente, y
 * ninguna de las dos cosas es justa para los que siguen jugando.
 */
const NIVEL_DEL_SUSTITUTO: NivelIA = 3;

/** Limites de lo que el anfitrion puede pedir. */
const NOMBRE_MAXIMO = 16;
const LADO_MINIMO = 4;
const LADO_MAXIMO = 30;
const SEGUNDOS_MAXIMOS = 300;

/** Con lo que arranca una sala si el anfitrion no toca nada. */
export const CONFIGURACION_POR_DEFECTO: ConfiguracionSala = {
  ancho: 10,
  alto: 8,
  minas: 12,
  tiempoPorTurnoSegundos: 20,
  recargaOndaSegundos: 30,
  publica: true,
  nivelesIA: [],
};

/**
 * Un puesto de la sala: una persona o un bot.
 *
 * Los bots no tienen credencial —no hay nadie a quien devolverle el puesto— y
 * se sientan siempre **detras de los humanos**, para que los ids que ve el
 * motor sigan siendo correlativos cuando entra alguien nuevo.
 */
interface Puesto {
  nombre: string;
  /** Credencial con la que recupera su puesto si se cae; null en los bots. */
  readonly token: string | null;
  conectado: boolean;
  sustituido: boolean;
  /** Nivel del bot que ocupa el puesto, o null si es de una persona. */
  readonly nivelIA: NivelIA | null;
}

/**
 * Una sala vista desde fuera de la partida, para el panel del servidor.
 *
 * No es lo mismo que `SalaAbierta`: aquella es lo que se le ofrece a un
 * jugador que busca sitio —y por eso deja fuera las privadas y las que ya
 * empezaron—, y esto es lo que necesita quien mira como va el servidor, que
 * son justo todas.
 */
export interface InformeSala {
  readonly codigo: string;
  /** Quien la abrio; una sala no tiene mas nombre que ese. */
  readonly anfitrion: string;
  readonly estado: EstadoSala;
  readonly publica: boolean;
  readonly jugadores: number;
  readonly bots: number;
  /** Personas que siguen ahi; los bots no cuentan. */
  readonly conectados: number;
  readonly maximo: number;
  readonly abiertaHaceMs: number;
}

/**
 * Una sala de juego: la partida y la gente que la juega.
 *
 * **Quien tiene la sala es la autoridad.** Aqui vive el unico `MotorJuego` de
 * verdad de esta partida; los clientes solo mandan intenciones («clic en 3,4»)
 * y reciben el estado que salga. Un cliente manipulado no puede jugar fuera de
 * su turno ni ver una mina antes de tiempo, porque el estado que se le manda
 * es el que el motor deja ver a cualquiera.
 *
 * No sabe nada de Socket.IO ni de Nest a proposito: recibe llamadas y devuelve
 * resultados, asi que se puede probar entera sin levantar nada. Quien la
 * envuelve se encarga de difundir lo que aqui ocurra, y hay dos que lo hacen:
 * `PasarelaPartida` en el servidor del Online, y `Anfitrion` —el de al lado—
 * dentro del telefono que monta una partida local.
 *
 * El tiempo entra por `ahora()`, el azar por `aleatorio()` y las credenciales
 * por `credencial()`, los tres inyectados, por lo mismo que en el motor: para
 * que las pruebas manden. La tercera ademas es lo que permite que esto viva en
 * el motor y no en el servidor: `randomUUID` es de Node, y el anfitrion de una
 * partida local es un telefono, donde no hay Node que valga.
 */
export class Sala {
  private readonly puestos: Puesto[] = [];
  private motor: MotorJuego | null = null;
  /** Bots que sustituyen a los caidos, por puesto. */
  private readonly sustitutos = new Map<number, JugadorIA>();
  private configuracionInterna: ConfiguracionSala = CONFIGURACION_POR_DEFECTO;
  private estadoInterno: EstadoSala = 'lobby';
  /** Instante a partir del cual el bot puede jugar por un ausente. */
  private sustitutoJuegaEn: number | null = null;

  /** Cuando se abrio, para poder decir cuanto lleva viva. */
  private readonly abiertaEn: number;

  constructor(
    readonly codigo: string,
    private readonly ahora: () => number,
    private readonly aleatorio: () => number,
    private readonly credencial: () => string,
  ) {
    this.abiertaEn = ahora();
  }

  get estado(): EstadoSala {
    return this.estadoInterno;
  }

  /**
   * No queda ninguna persona conectada: la pasarela usa esto para recoger salas
   * muertas. Los bots no cuentan, que una mesa de bots sola no espera a nadie.
   */
  get vacia(): boolean {
    return this.puestos.every((puesto) => puesto.nivelIA !== null || !puesto.conectado);
  }

  /** La sala tal y como se le ensena a sus jugadores. */
  vista(): VistaSala {
    return {
      codigo: this.codigo,
      estado: this.estadoInterno,
      configuracion: this.configuracionInterna,
      puestos: this.puestos.map(
        (puesto, id): PuestoSala => ({
          id,
          nombre: puesto.nombre,
          conectado: puesto.conectado,
          anfitrion: id === 0,
          sustituido: puesto.sustituido,
          bot: puesto.nivelIA !== null,
          nivel: puesto.nivelIA,
        }),
      ),
    };
  }

  /**
   * Como se ve esta sala en la lista de las que esperan gente, o null si no
   * pinta nada ahi.
   *
   * Solo salen las que estan en el lobby, con sitio y con alguien dentro: una
   * sala llena, una partida ya empezada o una que se quedo vacia no son sitios
   * a los que mandar a nadie.
   */
  resumen(): SalaAbierta | null {
    const anfitrion = this.puestos[0];
    if (
      !this.configuracionInterna.publica ||
      this.estadoInterno !== 'lobby' ||
      anfitrion === undefined ||
      this.puestos.length >= MAX_JUGADORES ||
      this.vacia
    ) {
      return null;
    }

    return {
      codigo: this.codigo,
      anfitrion: anfitrion.nombre,
      jugadores: this.puestos.length,
      maximo: MAX_JUGADORES,
      bots: this.puestos.filter((puesto) => puesto.nivelIA !== null).length,
    };
  }

  /**
   * Como se ve esta sala desde el panel del servidor.
   *
   * Aqui salen todas, tambien las privadas y las que estan jugando: quien mira
   * el panel es quien lleva el servidor, no alguien buscando partida.
   */
  informe(): InformeSala {
    return {
      codigo: this.codigo,
      anfitrion: this.puestos[0]?.nombre ?? '',
      estado: this.estadoInterno,
      publica: this.configuracionInterna.publica,
      jugadores: this.puestos.length,
      bots: this.puestos.filter((puesto) => puesto.nivelIA !== null).length,
      conectados: this.puestos.filter((puesto) => puesto.nivelIA === null && puesto.conectado)
        .length,
      maximo: MAX_JUGADORES,
      abiertaHaceMs: this.ahora() - this.abiertaEn,
    };
  }

  /** Estado de la partida en curso, o null si todavia no ha empezado. */
  estadoDePartida(): EstadoPartida | null {
    return this.motor?.obtenerEstado() ?? null;
  }

  /** Entra un jugador nuevo. El primero en llegar es el anfitrion. */
  unirse(nombre: string): Resultado<number> {
    if (this.estadoInterno !== 'lobby') {
      return { ok: false, error: 'SALA_EN_JUEGO' };
    }
    if (this.puestos.length >= MAX_JUGADORES) {
      return { ok: false, error: 'SALA_LLENA' };
    }

    const limpio = nombre.trim();
    if (limpio.length === 0 || limpio.length > NOMBRE_MAXIMO) {
      return { ok: false, error: 'NOMBRE_INVALIDO' };
    }

    // Delante de los bots, que van siempre al final.
    const sitio = this.puestos.findIndex((puesto) => puesto.nivelIA !== null);
    const suyo: Puesto = {
      nombre: limpio,
      token: this.credencial(),
      conectado: true,
      sustituido: false,
      nivelIA: null,
    };

    if (sitio === -1) {
      this.puestos.push(suyo);
      return { ok: true, datos: this.puestos.length - 1 };
    }

    this.puestos.splice(sitio, 0, suyo);
    return { ok: true, datos: sitio };
  }

  /** Credencial del puesto, para devolversela a quien acaba de entrar. */
  tokenDe(puesto: number): string | null {
    return this.puestos[puesto]?.token ?? null;
  }

  /** Vuelve alguien que se habia caido y recupera su puesto. */
  reconectar(token: string): Resultado<number> {
    const puesto = this.puestoDe(token);
    if (puesto === null) {
      return { ok: false, error: 'JUGADOR_DESCONOCIDO' };
    }

    const suyo = this.puestos[puesto];
    if (suyo !== undefined) {
      suyo.conectado = true;
      suyo.sustituido = false;
    }
    // Vuelve a mandar el: si el bot estaba esperando para jugar, ya no juega.
    if (this.motor?.obtenerEstado().turnoDe === puesto) {
      this.sustitutoJuegaEn = null;
    }
    return { ok: true, datos: puesto };
  }

  /**
   * Se cae o se marcha un jugador.
   *
   * En el lobby su puesto desaparece y los de detras suben, porque los ids
   * tienen que ser correlativos cuando empiece la partida. Con la partida ya
   * en marcha el puesto **se queda**: es lo que le permite volver, y quitarlo
   * cambiaria de dueno las minas que ya encontro.
   */
  desconectar(token: string): void {
    const puesto = this.puestoDe(token);
    if (puesto === null) {
      return;
    }

    if (this.estadoInterno === 'lobby') {
      this.puestos.splice(puesto, 1);
      return;
    }

    const suyo = this.puestos[puesto];
    if (suyo !== undefined) {
      suyo.conectado = false;
    }
  }

  /** El anfitrion cambia los ajustes, solo mientras no haya empezado. */
  configurar(token: string, cambios: Partial<ConfiguracionSala>): Resultado<null> {
    const problema = this.comprobarAnfitrionEnLobby(token);
    if (problema !== null) {
      return problema;
    }

    const configuracion = { ...this.configuracionInterna, ...cambios };
    if (!esConfiguracionValida(configuracion)) {
      return { ok: false, error: 'CONFIGURACION_INVALIDA' };
    }
    if (this.humanos().length + configuracion.nivelesIA.length > MAX_JUGADORES) {
      return { ok: false, error: 'SALA_LLENA' };
    }

    this.configuracionInterna = configuracion;
    this.sentarBots();
    return { ok: true, datos: null };
  }

  /** El anfitrion arranca la partida con los que haya dentro. */
  empezar(token: string): Resultado<null> {
    const problema = this.comprobarAnfitrionEnLobby(token);
    if (problema !== null) {
      return problema;
    }
    // Los bots cuentan: con un humano y un bot ya hay partida, que es la
    // gracia de poder meterlos.
    if (this.puestos.length < MIN_JUGADORES) {
      return { ok: false, error: 'FALTAN_JUGADORES' };
    }

    const { ancho, alto, minas, tiempoPorTurnoSegundos, recargaOndaSegundos } =
      this.configuracionInterna;

    try {
      this.motor = MotorJuego.crearPartida(ancho, alto, minas, this.puestos.length, {
        aleatorio: this.aleatorio,
        ahora: this.ahora,
        tiempoPorTurnoSegundos,
        recargaOndaSegundos,
      });
    } catch (error) {
      return { ok: false, error: codigoDe(error) };
    }

    this.estadoInterno = 'jugando';
    this.sustitutoJuegaEn = null;
    return { ok: true, datos: null };
  }

  /**
   * Terminada la partida, la sala vuelve al lobby para jugar otra con los
   * mismos.
   *
   * Los que se cayeron y no volvieron se quedan fuera: si no, la partida
   * siguiente empezaria con puestos fantasma a los que un bot juega desde el
   * primer turno.
   *
   * Lo pide el anfitrion; si el anfitrion es justo el que no volvio, vale
   * cualquiera de los que siguen dentro, que si no la sala se queda muerta con
   * gente esperando.
   */
  volverAlLobby(token: string): Resultado<null> {
    const puesto = this.puestoDe(token);
    if (puesto === null) {
      return { ok: false, error: 'JUGADOR_DESCONOCIDO' };
    }
    if (this.estadoInterno === 'lobby') {
      return { ok: false, error: 'SALA_EN_LOBBY' };
    }
    if (this.estadoInterno !== 'terminada') {
      return { ok: false, error: 'SALA_EN_JUEGO' };
    }
    if (puesto !== 0 && this.puestos[0]?.conectado === true) {
      return { ok: false, error: 'NO_ES_EL_ANFITRION' };
    }

    for (let indice = this.puestos.length - 1; indice >= 0; indice -= 1) {
      const puesto = this.puestos[indice];
      // Los bots no se van: los puso el anfitrion y siguen puestos.
      if (puesto !== undefined && puesto.nivelIA === null && !puesto.conectado) {
        this.puestos.splice(indice, 1);
      }
    }
    for (const suyo of this.puestos) {
      suyo.sustituido = false;
    }

    this.motor = null;
    this.sustitutos.clear();
    this.sustitutoJuegaEn = null;
    this.estadoInterno = 'lobby';
    return { ok: true, datos: null };
  }

  /** Clic de un jugador sobre una celda. */
  clic(token: string, x: number, y: number): Resultado<SucesoPartida> {
    const turno = this.comprobarTurno(token);
    if (!turno.ok) {
      return turno;
    }

    return this.jugar(turno.datos, x, y);
  }

  /** Arma o desarma la onda expansiva del jugador de turno. */
  onda(token: string, activar: boolean): Resultado<null> {
    const turno = this.comprobarTurno(token);
    if (!turno.ok) {
      return turno;
    }

    try {
      if (activar) {
        this.motor?.activarOnda();
      } else {
        this.motor?.desactivarOnda();
      }
      return { ok: true, datos: null };
    } catch (error) {
      return { ok: false, error: codigoDe(error) };
    }
  }

  /** Un jugador tira la toalla y se queda de espectador. */
  rendirse(token: string): Resultado<SucesoPartida> {
    const puesto = this.puestoDe(token);
    if (puesto === null) {
      return { ok: false, error: 'JUGADOR_DESCONOCIDO' };
    }
    if (this.estadoInterno !== 'jugando' || this.motor === null) {
      return { ok: false, error: 'SALA_EN_LOBBY' };
    }

    try {
      this.motor.rendirse(puesto);
    } catch (error) {
      return { ok: false, error: codigoDe(error) };
    }

    this.repasarFinal();
    return { ok: true, datos: { codigo: 'JUGADOR_RENDIDO', jugador: puesto, celdas: 0 } };
  }

  /**
   * Lo que hay que mirar cada poco aunque nadie toque nada: el reloj del turno
   * y si toca que juegue un bot por alguien que se ha caido.
   *
   * El motor no tiene temporizadores propios y esa es la gracia; el que
   * pregunta es el servidor, que ademas es quien pone el reloj bueno.
   */
  atender(): readonly SucesoPartida[] {
    if (this.estadoInterno !== 'jugando' || this.motor === null) {
      return [];
    }

    const sucesos: SucesoPartida[] = [];

    const perdedor = this.motor.obtenerEstado().turnoDe;
    if (this.motor.comprobarTiempoDeTurno()) {
      sucesos.push({ codigo: 'TURNO_PERDIDO', jugador: perdedor, celdas: 0 });
      this.sustitutoJuegaEn = null;
    }

    const jugada = this.turnoAutomatico();
    if (jugada !== null) {
      sucesos.push(jugada);
    }

    this.repasarFinal();
    return sucesos;
  }

  /**
   * Juega quien no puede jugar por si mismo: un puesto de bot, o el de alguien
   * que se ha caido.
   *
   * Al ausente se le espera un poco por si vuelve; al bot no, que esta ahi para
   * jugar. Los dos llevan luego el mismo ritmo: encadenando minas se juega
   * muchas veces seguidas, y a toda velocidad nadie se entera de lo que ha
   * pasado.
   */
  private turnoAutomatico(): SucesoPartida | null {
    const estado = this.motor?.obtenerEstado();
    if (estado === undefined || estado.terminada) {
      return null;
    }

    const puesto = this.puestos[estado.turnoDe];
    if (puesto === undefined) {
      return null;
    }

    const esBot = puesto.nivelIA !== null;
    if (!esBot && puesto.conectado) {
      this.sustitutoJuegaEn = null;
      return null;
    }

    this.sustitutoJuegaEn ??=
      this.ahora() + (esBot ? RITMO_DEL_BOT_MS : GRACIA_ANTES_DEL_SUSTITUTO_MS);
    if (this.ahora() < this.sustitutoJuegaEn) {
      return null;
    }

    puesto.sustituido = !esBot;
    this.sustitutoJuegaEn = this.ahora() + RITMO_DEL_BOT_MS;

    const bot =
      this.sustitutos.get(estado.turnoDe) ??
      new JugadorIA(puesto.nivelIA ?? NIVEL_DEL_SUSTITUTO, { aleatorio: this.aleatorio });
    this.sustitutos.set(estado.turnoDe, bot);

    let decision;
    try {
      decision = bot.elegirJugada(estado);
    } catch {
      // Sin celdas que clicar no hay nada que hacer; la partida se acaba sola.
      return null;
    }

    if (decision.usarOnda) {
      try {
        this.motor?.activarOnda();
      } catch {
        // Si no la tenia disponible, juega sin ella.
      }
    }

    const jugada = this.jugar(estado.turnoDe, decision.celda.x, decision.celda.y);
    return jugada.ok ? jugada.datos : null;
  }

  /** Aplica el clic de un puesto y traduce el resultado del motor a suceso. */
  private jugar(puesto: number, x: number, y: number): Resultado<SucesoPartida> {
    if (this.motor === null) {
      return { ok: false, error: 'SALA_EN_LOBBY' };
    }

    try {
      const resultado = this.motor.clicCelda(x, y);
      this.repasarFinal();
      return {
        ok: true,
        datos: {
          codigo: resultado.codigo,
          jugador: puesto,
          celdas: resultado.celdasReveladas.length,
        },
      };
    } catch (error) {
      return { ok: false, error: codigoDe(error) };
    }
  }

  /** Cierra la sala en cuanto el motor da la partida por terminada. */
  private repasarFinal(): void {
    if (this.motor?.estaTerminada() === true) {
      this.estadoInterno = 'terminada';
      this.sustitutoJuegaEn = null;
    }
  }

  /** Comprueba que quien pide jugar existe y que es su turno. */
  private comprobarTurno(token: string): Resultado<number> {
    const puesto = this.puestoDe(token);
    if (puesto === null) {
      return { ok: false, error: 'JUGADOR_DESCONOCIDO' };
    }
    if (this.estadoInterno !== 'jugando' || this.motor === null) {
      return { ok: false, error: 'SALA_EN_LOBBY' };
    }
    if (this.motor.obtenerEstado().turnoDe !== puesto) {
      return { ok: false, error: 'NO_ES_TU_TURNO' };
    }
    return { ok: true, datos: puesto };
  }

  private comprobarAnfitrionEnLobby(token: string): Resultado<never> | null {
    const puesto = this.puestoDe(token);
    if (puesto === null) {
      return { ok: false, error: 'JUGADOR_DESCONOCIDO' };
    }
    if (puesto !== 0) {
      return { ok: false, error: 'NO_ES_EL_ANFITRION' };
    }
    if (this.estadoInterno !== 'lobby') {
      return { ok: false, error: 'SALA_EN_JUEGO' };
    }
    return null;
  }

  /** Los puestos que ocupan personas. */
  private humanos(): readonly Puesto[] {
    return this.puestos.filter((puesto) => puesto.nivelIA === null);
  }

  /**
   * Rehace los puestos de bot para que cuadren con la configuracion.
   *
   * Se tiran todos y se vuelven a poner detras de los humanos: es mas simple
   * que ir emparejando cual sobra y cual falta, y en el lobby no hay nada que
   * conservar de un bot.
   */
  private sentarBots(): void {
    const humanos = [...this.humanos()];
    const bots = this.configuracionInterna.nivelesIA.map(
      (nivel, indice): Puesto => ({
        nombre: `Bot ${String(indice + 1)}`,
        token: null,
        conectado: false,
        sustituido: false,
        nivelIA: nivel,
      }),
    );

    this.puestos.length = 0;
    this.puestos.push(...humanos, ...bots);
  }

  private puestoDe(token: string): number | null {
    const puesto = this.puestos.findIndex((candidato) => candidato.token === token);
    return puesto === -1 ? null : puesto;
  }
}

/** Los ajustes que pide el anfitrion tienen que caber en un tablero jugable. */
function esConfiguracionValida(configuracion: ConfiguracionSala): boolean {
  const { ancho, alto, minas, tiempoPorTurnoSegundos, recargaOndaSegundos } = configuracion;
  const enteros = [ancho, alto, minas, tiempoPorTurnoSegundos, recargaOndaSegundos];

  if (typeof configuracion.publica !== 'boolean' || !Array.isArray(configuracion.nivelesIA)) {
    return false;
  }
  // Los bots solos no hacen una sala: siempre hay al menos un humano dentro.
  if (
    configuracion.nivelesIA.length > MAX_JUGADORES - 1 ||
    !configuracion.nivelesIA.every(
      (nivel) => Number.isInteger(nivel) && nivel >= 1 && nivel <= 5,
    )
  ) {
    return false;
  }

  return (
    enteros.every((valor) => Number.isInteger(valor)) &&
    ancho >= LADO_MINIMO &&
    ancho <= LADO_MAXIMO &&
    alto >= LADO_MINIMO &&
    alto <= LADO_MAXIMO &&
    minas >= 1 &&
    // Al menos una celda sin mina: la primera que se clica.
    minas <= ancho * alto - 1 &&
    tiempoPorTurnoSegundos >= 0 &&
    tiempoPorTurnoSegundos <= SEGUNDOS_MAXIMOS &&
    recargaOndaSegundos >= 0 &&
    recargaOndaSegundos <= SEGUNDOS_MAXIMOS
  );
}

/** Saca el codigo de un error del motor; lo que no lo sea, no se traga. */
function codigoDe(error: unknown): CodigoErrorMotor {
  if (error instanceof ErrorPartida) {
    return error.codigo;
  }
  throw error;
}

type CodigoErrorMotor = ErrorPartida['codigo'];
