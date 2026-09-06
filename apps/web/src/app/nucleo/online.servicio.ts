import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import {
  MENSAJES_DEL_CLIENTE,
  MENSAJES_DEL_SERVIDOR,
  VERSION_PROTOCOLO,
  type CodigoErrorProtocolo,
  type ConfiguracionSala,
  type Entrada,
  type EstadoPartida,
  type Reentrada,
  type Resultado,
  type SalaAbierta,
  type SucesoPartida,
  type VistaSala,
} from '@minehunt/game-engine';
import { io } from 'socket.io-client';

import { ServicioServidor } from './servidor';

/** Cada cuanto se repintan las cuentas atras mientras hay algo que contar. */
const LATIDO_MS = 250;

/**
 * Lo que se espera a la lista de salas antes de darla por perdida.
 *
 * Sin esto, con el servidor apagado la peticion se queda esperando para siempre
 * —Socket.IO guarda lo que no ha podido mandar—, y con ella se queda esperando
 * la pantalla que la pidio.
 */
const ESPERA_MAXIMA_MS = 5000;

/** Donde se recuerda la sala y la credencial, para poder volver a ella. */
const CLAVE_ALMACENAMIENTO = 'minehunt.online';

/**
 * Lo unico que el servicio necesita de un socket.
 *
 * Se declara aparte para poder probarlo con uno de mentira: levantar un
 * servidor de verdad en las pruebas del cliente seria probar el servidor otra
 * vez, y eso ya lo hacen sus e2e.
 */
export interface SocketMinimo {
  on(evento: string, escucha: (datos: never) => void): void;
  emitWithAck(evento: string, datos?: unknown): Promise<unknown>;
  disconnect(): void;
}

export type CreadorDeSocket = (url: string) => SocketMinimo;

/** Con que se abre la conexion. Las pruebas lo sustituyen. */
export const CREADOR_DE_SOCKET = new InjectionToken<CreadorDeSocket>('creador de socket', {
  providedIn: 'root',
  factory:
    (): CreadorDeSocket =>
    (url: string): SocketMinimo =>
      // Websocket primero, que es lo que la partida necesita; y si no se
      // puede, que se apane con las peticiones largas antes que no conectar.
      io(url, { transports: ['websocket', 'polling'] }) as unknown as SocketMinimo,
});

/**
 * En que punto esta la conexion con el servidor.
 *
 * Interesa al jugador y no solo al programa: una partida por turnos con alguien
 * al otro lado necesita decir si el problema es suyo o del rival.
 */
export type EstadoConexion = 'desconectado' | 'conectando' | 'conectado' | 'caido';

/** Lo que se guarda para poder volver a una sala tras cerrar la aplicacion. */
interface SalaRecordada {
  readonly codigo: string;
  readonly token: string;
  readonly nombre: string;
}

/**
 * El Multijugador Online visto desde el cliente.
 *
 * Es el gemelo de `ServicioPartida`: publica el estado como senales para que
 * las pantallas se repinten solas, con la diferencia de que **aqui no hay
 * motor**. El tablero llega hecho desde el servidor, que es la autoridad, y lo
 * unico que se manda son intenciones. Por eso no valida nada de las reglas: si
 * una jugada no vale, lo dice el servidor.
 *
 * Los sucesos se guardan como codigo, nunca como texto ya traducido, igual que
 * en el Entrenamiento: es lo que permite que dos jugadores de la misma sala
 * vean la partida cada uno en su idioma.
 */
@Injectable({ providedIn: 'root' })
export class ServicioOnline {
  private readonly abrirSocket = inject(CREADOR_DE_SOCKET);
  private readonly servidor = inject(ServicioServidor);
  private socket: SocketMinimo | null = null;
  /** Credencial de la sala en curso; sin ella no se puede volver a entrar. */
  private credencial: SalaRecordada | null = leerRecordada();

  private readonly conexionInterna = signal<EstadoConexion>('desconectado');
  /**
   * Corta la espera de lo que se este pidiendo al servidor.
   *
   * Existe porque entrar en una sala no es instantaneo y puede no llegar nunca:
   * con el servidor apagado o fuera de alcance, el acuse de recibo no vuelve y
   * el jugador se queda mirando un boton apagado sin saber que pasa.
   */
  private abortarEspera: (() => void) | null = null;
  private readonly salaInterna = signal<VistaSala | null>(null);
  private readonly partidaInterna = signal<EstadoPartida | null>(null);
  private readonly sucesoInterno = signal<SucesoPartida | null>(null);
  private readonly errorInterno = signal<CodigoErrorProtocolo | null>(null);
  private readonly puestoInterno = signal<number | null>(null);
  private readonly abiertasInterna = signal<readonly SalaAbierta[]>([]);

  /**
   * Cuando llego el ultimo estado y que hora es ahora.
   *
   * El servidor solo difunde cuando pasa algo, asi que las cuentas atras las
   * baja el cliente restando lo que lleva transcurrido desde que recibio el
   * estado. Es lo mismo que hace el Entrenamiento con su latido, solo que alli
   * el estado lo tiene a mano.
   */
  private recibidoEn = 0;
  private readonly reloj = signal(0);
  private latido: ReturnType<typeof setInterval> | null = null;

  readonly conexion = this.conexionInterna.asReadonly();
  readonly sala = this.salaInterna.asReadonly();
  readonly partida = this.partidaInterna.asReadonly();
  readonly ultimoSuceso = this.sucesoInterno.asReadonly();
  readonly ultimoError = this.errorInterno.asReadonly();
  /** Puesto que ocupa este jugador en la sala, que es su id en la partida. */
  readonly puesto = this.puestoInterno.asReadonly();
  /** Salas esperando gente, para quien no tiene ningun codigo. */
  readonly salasAbiertas = this.abiertasInterna.asReadonly();

  readonly hayCredencial = computed(() => this.credencialGuardada() !== null);

  /** Le toca a este jugador. */
  readonly esMiTurno = computed(() => {
    const partida = this.partidaInterna();
    return partida !== null && !partida.terminada && partida.turnoDe === this.puestoInterno();
  });

  /** Onda de este jugador, que es la unica que puede gastar. */
  readonly miOnda = computed(() => {
    const puesto = this.puestoInterno();
    return puesto === null ? null : (this.partidaInterna()?.jugadores[puesto]?.onda ?? null);
  });

  /** Lo que lleva transcurrido desde que llego el ultimo estado. */
  private readonly transcurridoMs = computed(() => Math.max(0, this.reloj() - this.recibidoEn));

  /** Segundos que faltan para recuperar la onda, redondeados hacia arriba. */
  readonly segundosDeRecarga = computed(() => {
    const recarga = this.miOnda()?.recargaRestanteMs ?? 0;
    return Math.ceil(Math.max(0, recarga - this.transcurridoMs()) / 1000);
  });

  /** Milisegundos que le quedan al turno; null si la sala no aprieta el reloj. */
  readonly restanteDeTurnoMs = computed(() => {
    const restante = this.partidaInterna()?.tiempoRestanteMs ?? null;
    return restante === null ? null : Math.max(0, restante - this.transcurridoMs());
  });

  /** Segundos que le quedan al turno; null si la sala no aprieta el reloj. */
  readonly segundosDeTurno = computed(() => {
    const restante = this.restanteDeTurnoMs();
    return restante === null ? null : Math.ceil(restante / 1000);
  });

  /** Parte del turno que queda, de 1 a 0, para pintar la barra. */
  readonly fraccionDeTurno = computed(() => {
    const partida = this.partidaInterna();
    const restante = this.restanteDeTurnoMs();
    if (partida === null || restante === null || partida.tiempoPorTurnoMs === 0) {
      return null;
    }
    return restante / partida.tiempoPorTurnoMs;
  });

  /**
   * Pregunta que salas estan esperando gente.
   *
   * Conecta si hacia falta: es lo primero que se hace al abrir la pantalla, y
   * de paso se ve si el servidor esta ahi antes de escribir ningun nombre.
   */
  async pedirSalasAbiertas(): Promise<void> {
    await this.conectar();

    const respuesta = (await conLimiteDeEspera(
      this.pedir(MENSAJES_DEL_CLIENTE.salasAbiertas),
    )) as Resultado<readonly SalaAbierta[]> | null;

    this.abiertasInterna.set(respuesta !== null && respuesta.ok ? respuesta.datos : []);
  }

  /** Abre una sala nueva y se sienta en ella de anfitrion. */
  async crearSala(nombre: string, configuracion?: Partial<ConfiguracionSala>): Promise<boolean> {
    return this.entrar(MENSAJES_DEL_CLIENTE.crearSala, {
      nombre,
      configuracion,
      version: VERSION_PROTOCOLO,
    });
  }

  /** Entra en la sala de ese codigo. */
  async unirse(codigo: string, nombre: string): Promise<boolean> {
    return this.entrar(MENSAJES_DEL_CLIENTE.unirseASala, {
      codigo: codigo.trim().toUpperCase(),
      nombre,
      version: VERSION_PROTOCOLO,
    });
  }

  /**
   * Vuelve a la sala que quedo a medias, si la hay.
   *
   * Se llama al abrir la pantalla: cerrar la aplicacion en mitad de una partida
   * no deberia costarla, y el servidor guarda el puesto esperando.
   */
  async volverALaSala(): Promise<boolean> {
    const credencial = this.credencialGuardada();
    if (credencial === null) {
      return false;
    }

    await this.conectar();
    const respuesta = (await this.pedir(MENSAJES_DEL_CLIENTE.reconectar, {
      codigo: credencial.codigo,
      token: credencial.token,
      version: VERSION_PROTOCOLO,
    })) as Resultado<Reentrada>;

    if (!respuesta.ok) {
      // La sala ya no existe o la credencial no vale: se olvida, o el jugador
      // se queda intentando volver a una partida que no esta.
      this.olvidarCredencial();
      this.errorInterno.set(respuesta.error);
      return false;
    }

    this.recordar(respuesta.datos, credencial.nombre);
    this.anotarPartida(respuesta.datos.partida);
    return true;
  }

  /** El anfitrion cambia los ajustes de la sala. */
  async configurar(configuracion: Partial<ConfiguracionSala>): Promise<boolean> {
    return this.mandar(MENSAJES_DEL_CLIENTE.configurarSala, configuracion);
  }

  /** El anfitrion arranca la partida. */
  async empezar(): Promise<boolean> {
    return this.mandar(MENSAJES_DEL_CLIENTE.empezarPartida);
  }

  /** Clic sobre una celda. La regla la aplica el servidor, no esto. */
  async clic(x: number, y: number): Promise<boolean> {
    return this.mandar(MENSAJES_DEL_CLIENTE.clic, { x, y });
  }

  /** Arma o desarma la onda expansiva antes de clicar. */
  async onda(activar: boolean): Promise<boolean> {
    return this.mandar(MENSAJES_DEL_CLIENTE.onda, { activar });
  }

  /** Clic que gasta la onda en esa celda, que es lo que hace el boton derecho. */
  async clicConOnda(x: number, y: number): Promise<boolean> {
    if (this.miOnda()?.estado !== 'activo' && !(await this.onda(true))) {
      return false;
    }
    return this.clic(x, y);
  }

  async rendirse(): Promise<boolean> {
    return this.mandar(MENSAJES_DEL_CLIENTE.rendirse);
  }

  /** Terminada la partida, devuelve la sala al lobby para jugar otra. */
  async otraPartida(): Promise<boolean> {
    return this.mandar(MENSAJES_DEL_CLIENTE.volverAlLobby);
  }

  /** Deja la sala y corta la conexion. */
  async salir(): Promise<void> {
    if (this.socket !== null) {
      await this.pedir(MENSAJES_DEL_CLIENTE.salir);
    }
    this.olvidarCredencial();
    this.desconectar();
  }

  /**
   * El jugador se cansa de esperar: se deja de esperar y se corta la conexion.
   *
   * Cortar tambien el socket no es de mas: si el servidor contestara despues,
   * la sala se habria creado de verdad y el jugador estaria fuera de ella sin
   * saberlo. Asi la peticion muere del todo y se puede volver a intentar.
   */
  cancelarEspera(): void {
    this.abortarEspera?.();
    this.desconectar();
  }

  /** Corta la conexion sin dejar la sala: se podra volver con la credencial. */
  desconectar(): void {
    this.detenerLatido();
    this.socket?.disconnect();
    this.socket = null;
    this.conexionInterna.set('desconectado');
    this.salaInterna.set(null);
    this.partidaInterna.set(null);
    this.sucesoInterno.set(null);
    this.puestoInterno.set(null);
  }

  /**
   * Espera una respuesta, con dos formas de rendirse: el limite de tiempo de
   * siempre y el boton de cancelar del jugador. Devuelve null en los dos casos.
   */
  private async esperando(promesa: Promise<unknown>): Promise<unknown> {
    const cancelacion = new Promise<null>((seguir) => {
      this.abortarEspera = (): void => {
        seguir(null);
      };
    });

    try {
      return await conLimiteDeEspera(Promise.race([promesa, cancelacion]));
    } finally {
      this.abortarEspera = null;
    }
  }

  /** Credencial guardada de una sala a medias, si la hay. */
  credencialGuardada(): SalaRecordada | null {
    return this.credencial;
  }

  /** Entra en una sala, creandola o uniendose. */
  private async entrar(mensaje: string, peticion: Record<string, unknown>): Promise<boolean> {
    await this.conectar();

    const respuesta = (await this.esperando(this.pedir(mensaje, peticion))) as
      | Resultado<Entrada>
      | null;

    // Ni contesto ni el jugador espero mas: se corta y la pantalla lo dice.
    if (respuesta === null) {
      this.desconectar();
      this.conexionInterna.set('caido');
      return false;
    }
    if (!respuesta.ok) {
      this.errorInterno.set(respuesta.error);
      return false;
    }

    this.recordar(respuesta.datos, String(peticion['nombre']));
    return true;
  }

  /** Se queda con lo que devuelve el servidor al entrar en una sala. */
  private recordar(entrada: Entrada, nombre: string): void {
    this.credencial = { codigo: entrada.codigo, token: entrada.token, nombre };
    this.puestoInterno.set(entrada.puesto);
    this.salaInterna.set(entrada.sala);
    this.errorInterno.set(null);

    try {
      localStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(this.credencial));
    } catch {
      // Sin almacenamiento se juega igual, solo que no se puede volver.
    }
  }

  private olvidarCredencial(): void {
    this.credencial = null;
    try {
      localStorage.removeItem(CLAVE_ALMACENAMIENTO);
    } catch {
      // Nada que olvidar si no habia donde guardar.
    }
  }

  /** Manda una peticion de las que solo hay que saber si valieron. */
  private async mandar(mensaje: string, datos?: unknown): Promise<boolean> {
    const respuesta = (await this.pedir(mensaje, datos)) as Resultado<unknown> | null;
    if (respuesta === null) {
      return false;
    }
    if (!respuesta.ok) {
      this.errorInterno.set(respuesta.error);
      return false;
    }

    this.errorInterno.set(null);
    return true;
  }

  private async pedir(mensaje: string, datos?: unknown): Promise<unknown> {
    if (this.socket === null) {
      return null;
    }
    return this.socket.emitWithAck(mensaje, datos);
  }

  /**
   * Abre la conexion si no la habia.
   *
   * Socket.IO reconecta solo, asi que lo unico que hay que hacer al volver es
   * pedir el puesto otra vez con la credencial; eso lo hace `alReconectar`.
   */
  private async conectar(): Promise<void> {
    if (this.socket !== null) {
      return;
    }

    this.conexionInterna.set('conectando');
    const socket = this.abrirSocket(this.servidor.url());
    this.socket = socket;
    this.escuchar(socket);
  }

  /** Engancha lo que difunde el servidor a las senales. */
  private escuchar(socket: SocketMinimo): void {
    socket.on('connect', () => {
      this.conexionInterna.set('conectado');
      void this.alReconectar();
    });
    socket.on('disconnect', () => {
      this.conexionInterna.set('caido');
    });
    // Sin esto, con el servidor apagado la pantalla se queda en «conectando»
    // para siempre y el jugador no sabe que mirar.
    socket.on('connect_error', () => {
      this.conexionInterna.set('caido');
    });
    socket.on(MENSAJES_DEL_SERVIDOR.sala, (sala: VistaSala) => {
      this.salaInterna.set(sala);
    });
    socket.on(MENSAJES_DEL_SERVIDOR.partida, (partida: EstadoPartida) => {
      this.anotarPartida(partida);
    });
    socket.on(MENSAJES_DEL_SERVIDOR.suceso, (suceso: SucesoPartida) => {
      this.sucesoInterno.set(suceso);
      this.errorInterno.set(null);
    });
  }

  /** Guarda el estado recien llegado y pone en hora las cuentas atras. */
  private anotarPartida(partida: EstadoPartida | null): void {
    this.recibidoEn = Date.now();
    this.reloj.set(this.recibidoEn);
    this.partidaInterna.set(partida);
    this.ajustarLatido();
  }

  /**
   * El latido solo vive mientras haya algo que contar: un turno con reloj o una
   * onda recargando. Sin eso, repintar cuatro veces por segundo no aporta nada.
   */
  private ajustarLatido(): void {
    const partida = this.partidaInterna();
    const hayQueContar =
      partida !== null &&
      !partida.terminada &&
      (partida.tiempoRestanteMs !== null ||
        partida.jugadores.some((jugador) => jugador.onda.estado === 'recargando'));

    if (hayQueContar && this.latido === null) {
      this.latido = setInterval(() => {
        this.reloj.set(Date.now());
      }, LATIDO_MS);
    } else if (!hayQueContar) {
      this.detenerLatido();
    }
  }

  private detenerLatido(): void {
    if (this.latido !== null) {
      clearInterval(this.latido);
      this.latido = null;
    }
  }

  /**
   * Al volver la conexion hay que reclamar el puesto: el socket es otro y el
   * servidor solo sabe de quien es por la credencial.
   */
  private async alReconectar(): Promise<void> {
    const credencial = this.credencial;
    if (credencial === null || this.salaInterna() === null) {
      return;
    }

    const respuesta = (await this.pedir(MENSAJES_DEL_CLIENTE.reconectar, {
      codigo: credencial.codigo,
      token: credencial.token,
      version: VERSION_PROTOCOLO,
    })) as Resultado<Reentrada> | null;

    if (respuesta !== null && respuesta.ok) {
      this.puestoInterno.set(respuesta.datos.puesto);
      this.salaInterna.set(respuesta.datos.sala);
      this.anotarPartida(respuesta.datos.partida);
    }
  }
}

/** La promesa, o null si tarda demasiado. Lo que llegue tarde se ignora. */
async function conLimiteDeEspera(promesa: Promise<unknown>): Promise<unknown> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const seAcaboElTiempo = new Promise<null>((seguir) => {
    temporizador = setTimeout(() => {
      seguir(null);
    }, ESPERA_MAXIMA_MS);
  });

  try {
    return await Promise.race([promesa, seAcaboElTiempo]);
  } finally {
    clearTimeout(temporizador);
  }
}

function leerRecordada(): SalaRecordada | null {
  try {
    const crudo = localStorage.getItem(CLAVE_ALMACENAMIENTO);
    if (crudo === null) {
      return null;
    }

    const posible = JSON.parse(crudo) as Record<string, unknown>;
    const { codigo, token, nombre } = posible;
    if (typeof codigo !== 'string' || typeof token !== 'string' || typeof nombre !== 'string') {
      return null;
    }
    return { codigo, token, nombre };
  } catch {
    return null;
  }
}
