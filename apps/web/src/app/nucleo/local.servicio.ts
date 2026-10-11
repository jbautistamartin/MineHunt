import { Injectable, inject, signal } from '@angular/core';
import { Anfitrion, Sala, type ConfiguracionSala } from '@minehunt/game-engine';

import {
  RADIO_CERCANA,
  type PartidaCercana,
  type SucesoCercano,
} from './cercanos.plugin';
import { ServicioOnline, type SocketMinimo } from './online.servicio';
import {
  Ensamblador,
  SocketDelAnfitrion,
  SocketDelInvitado,
  marcoDeEmision,
  marcoDeRespuesta,
  type Marco,
} from './transporte-local';

/**
 * Cada cuanto repasa su sala el telefono que hace de anfitrion.
 *
 * Es el mismo latido que lleva la pasarela del servidor, y por la misma razon:
 * el motor no tiene temporizadores propios, asi que alguien tiene que
 * preguntarle si al de turno se le acabo el tiempo.
 */
const LATIDO_MS = 250;

/** Lo que se espera a que la radio de linea antes de darlo por imposible. */
const ESPERA_DE_CONEXION_MS = 15_000;

/**
 * Alfabeto de los codigos de sala, el mismo que reparte el servidor.
 *
 * En una partida local el codigo no hace falta para entrar —se elige de una
 * lista, no se teclea— pero la sala sigue teniendo uno porque el protocolo lo
 * pide, y si se va a enseñar en el lobby que se lea bien: sin O ni 0, ni I ni 1.
 */
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LARGO_DEL_CODIGO = 4;

/** La conexion con la que el anfitrion se habla a si mismo. */
const CONEXION_DEL_ANFITRION = 'anfitrion';

/** En que punto esta el permiso de usar las radios. */
export type EstadoDePermisos = 'sin-pedir' | 'concedidos' | 'denegados';

/**
 * El Multijugador Local: de dos a cuatro telefonos jugando entre ellos, sin
 * servidor, sin Wi-Fi comun y sin internet.
 *
 * **Lo unico que cambia respecto al Online es el cable.** El protocolo es el
 * mismo, las pantallas son las mismas y `ServicioOnline` es el mismo: aqui solo
 * se le dice por donde tiene que hablar. Quien abre la partida se queda ademas
 * con la sala de verdad dentro (`Anfitrion`), que es lo que sustituye al
 * servidor; los demas le mandan sus intenciones por Nearby y reciben el estado
 * que salga, igual que se lo mandarian a un NestJS.
 *
 * El anfitrion no usa radio para hablar consigo mismo: su socket llama
 * directamente a la sala que tiene al lado.
 */
@Injectable({ providedIn: 'root' })
export class ServicioLocal {
  private readonly radio = inject(RADIO_CERCANA);
  private readonly online = inject(ServicioOnline);

  /** El modo existe donde hay radios: en el navegador no se enseña siquiera. */
  readonly disponible = this.radio.disponible;

  private readonly permisosInternos = signal<EstadoDePermisos>('sin-pedir');
  private readonly cercanasInternas = signal<readonly PartidaCercana[]>([]);
  private readonly buscandoInterna = signal(false);
  private readonly anunciandoInterna = signal(false);
  private readonly falloInterno = signal<string | null>(null);

  readonly permisos = this.permisosInternos.asReadonly();
  /** Partidas anunciandose ahi al lado, segun las va encontrando la radio. */
  readonly cercanas = this.cercanasInternas.asReadonly();
  readonly buscando = this.buscandoInterna.asReadonly();
  /** Esta partida se esta anunciando: somos el anfitrion. */
  readonly anunciando = this.anunciandoInterna.asReadonly();
  /** Lo ultimo que la radio dijo que no pudo hacer, para poder enseñarlo. */
  readonly fallo = this.falloInterno.asReadonly();

  /** Lo que se deja de escuchar al cerrar, si se llego a escuchar algo. */
  private dejarDeEscuchar: (() => void) | null = null;

  // --- Lo que solo existe en el telefono que monta la partida ---
  private anfitrion: Anfitrion | null = null;
  private socketPropio: SocketDelAnfitrion | null = null;
  private latido: ReturnType<typeof setInterval> | null = null;
  /** Los que estan conectados por radio, que son a quienes hay que difundir. */
  private readonly invitados = new Set<string>();
  /** Un ensamblador por invitado: cada linea trae sus propios trozos. */
  private readonly ensambladores = new Map<string, Ensamblador>();

  // --- Lo que solo existe en el telefono que se une a una partida ---
  private socketInvitado: SocketDelInvitado | null = null;
  /** A quien se le pidio linea, para saber a quien mandarle los mensajes. */
  private anfitrionRemoto: string | null = null;
  /** Lo que espera a que la radio confirme la linea con el anfitrion. */
  private esperandoLinea: ((abierta: boolean) => void) | null = null;

  /**
   * Ya se esta cerrando.
   *
   * Cerrar corta el socket, y cortar el socket llama aqui otra vez: es la misma
   * cuerda tirada por los dos extremos. Sin esta marca el cierre se reentra
   * solo, y aunque hoy acabe parando, depende de en que orden esten escritas
   * tres lineas de otro fichero.
   */
  private cerrando = false;

  /**
   * Comprueba el permiso y lo pide si falta.
   *
   * Se pide en caliente y no al arrancar la aplicacion porque es donde se
   * entiende: un buscaminas que pide la ubicacion nada mas abrirse da mala
   * espina, y pedido al entrar en este modo se puede explicar antes.
   */
  async asegurarPermisos(): Promise<boolean> {
    if (!this.disponible) {
      return false;
    }

    const tiene = await this.radio.comprobarPermisos();
    if (tiene.concedidos) {
      this.permisosInternos.set('concedidos');
      return true;
    }

    const pedidos = await this.radio.pedirPermisos();
    this.permisosInternos.set(pedidos.concedidos ? 'concedidos' : 'denegados');
    return pedidos.concedidos;
  }

  /**
   * Mira como esta el permiso **sin pedirlo**.
   *
   * Es lo que se hace al abrir la pantalla: si ya estaba concedido se empieza a
   * buscar sin molestar a nadie, y si no, se enseña antes para que sirve. Un
   * buscaminas que suelta el dialogo del sistema nada mas entrar no ha
   * explicado nada todavia.
   */
  async comprobarPermisos(): Promise<boolean> {
    if (!this.disponible) {
      return false;
    }

    const tiene = await this.radio.comprobarPermisos();
    if (tiene.concedidos) {
      this.permisosInternos.set('concedidos');
    }
    return tiene.concedidos;
  }

  /** Empieza a buscar partidas cerca y las va publicando en `cercanas`. */
  async buscar(): Promise<void> {
    if (!(await this.asegurarPermisos())) {
      return;
    }

    await this.escucharLaRadio();
    this.cercanasInternas.set([]);
    this.falloInterno.set(null);
    await this.radio.buscar();
    this.buscandoInterna.set(true);
  }

  /**
   * Monta la partida en este telefono y se sienta en ella de anfitrion.
   *
   * La sala se crea **antes** de que nadie pida nada: el `Anfitrion` la
   * envuelve y a partir de ahi la conversacion es la de siempre, incluido el
   * `crear-sala` que manda el propio anfitrion para sentarse.
   */
  async abrir(nombre: string, configuracion: Partial<ConfiguracionSala>): Promise<boolean> {
    if (!(await this.asegurarPermisos())) {
      return false;
    }

    await this.escucharLaRadio();
    // Quien monta una partida deja de buscar las de los demas: anunciar y
    // barrer a la vez solo gasta radio.
    await this.dejarDeBuscar();
    this.montarSala();

    try {
      await this.radio.anunciar(nombre.trim().slice(0, 16));
    } catch (fallo) {
      this.falloInterno.set(motivoDe(fallo));
      await this.cerrar();
      return false;
    }
    this.anunciandoInterna.set(true);

    this.online.usarTransporte(() => this.socketDelAnfitrion());
    const creada = await this.online.crearSala(nombre, configuracion);
    if (!creada) {
      await this.cerrar();
    }
    return creada;
  }

  /**
   * Entra en una de las partidas encontradas.
   *
   * Se pide linea, se espera a que la radio la de por abierta y solo entonces
   * se habla: mandar antes es mandar a un sitio que todavia no existe. Con la
   * linea abierta se pregunta que sala hay —que en un telefono es siempre una—
   * y se entra en ella con el nombre.
   */
  async unirse(id: string, nombre: string): Promise<boolean> {
    if (!(await this.asegurarPermisos())) {
      return false;
    }

    await this.escucharLaRadio();
    this.anfitrionRemoto = id;
    this.socketInvitado = new SocketDelInvitado(
      (trozos) => {
        void this.mandarPorRadio([id], trozos);
      },
      () => {
        void this.cerrar();
      },
    );

    const linea = new Promise<boolean>((seguir) => {
      this.esperandoLinea = seguir;
      setTimeout(() => {
        this.esperandoLinea?.(false);
        this.esperandoLinea = null;
      }, ESPERA_DE_CONEXION_MS);
    });

    try {
      await this.radio.conectar(id, nombre.trim().slice(0, 16));
    } catch (fallo) {
      this.falloInterno.set(motivoDe(fallo));
      await this.cerrar();
      return false;
    }

    if (!(await linea)) {
      this.falloInterno.set('SIN_LINEA');
      await this.cerrar();
      return false;
    }

    // Con la linea abierta ya no hace falta seguir gastando radio buscando.
    await this.dejarDeBuscar();

    this.online.usarTransporte(() => this.socketInvitado as SocketMinimo);
    await this.online.pedirSalasAbiertas();
    const sala = this.online.salasAbiertas()[0];
    if (sala === undefined) {
      this.falloInterno.set('SIN_SALA');
      await this.cerrar();
      return false;
    }

    const dentro = await this.online.unirse(sala.codigo, nombre);
    if (!dentro) {
      await this.cerrar();
    }
    return dentro;
  }

  /** Deja de buscar, sin soltar lo que ya estuviera conectado. */
  async dejarDeBuscar(): Promise<void> {
    if (!this.buscandoInterna()) {
      return;
    }
    this.buscandoInterna.set(false);
    this.cercanasInternas.set([]);

    try {
      await this.radio.dejarDeBuscar();
    } catch {
      // Dejar de hacer algo que no se estaba haciendo no es un problema.
    }
  }

  /**
   * Se acabo la partida local: se apaga la radio y se suelta todo.
   *
   * Tambien devuelve `ServicioOnline` a su transporte de siempre, o la
   * siguiente partida online intentaria hablar por una radio que ya no existe.
   */
  async cerrar(): Promise<void> {
    if (this.cerrando) {
      return;
    }
    this.cerrando = true;

    try {
      await this.cerrarDeVerdad();
    } finally {
      this.cerrando = false;
    }
  }

  private async cerrarDeVerdad(): Promise<void> {
    this.pararLatido();

    this.socketPropio = null;
    this.socketInvitado = null;
    this.anfitrion = null;
    this.anfitrionRemoto = null;
    this.invitados.clear();
    this.ensambladores.clear();
    this.esperandoLinea?.(false);
    this.esperandoLinea = null;

    this.buscandoInterna.set(false);
    this.anunciandoInterna.set(false);
    this.cercanasInternas.set([]);

    this.online.usarTransporte(null);

    this.dejarDeEscuchar?.();
    this.dejarDeEscuchar = null;

    if (this.disponible) {
      try {
        await this.radio.parar();
      } catch {
        // Apagar lo que ya estaba apagado no es un problema de nadie.
      }
    }
  }

  /** Monta la sala de verdad y el anfitrion que la envuelve. */
  private montarSala(): void {
    const sala = new Sala(codigoDeSala(), () => Date.now(), Math.random, credencial);

    this.anfitrion = new Anfitrion(sala, (evento, datos) => {
      // A quien aloja la sala se le cuenta sin pasar por la radio.
      this.socketPropio?.recibir(evento, datos);
      if (this.invitados.size > 0) {
        void this.mandarPorRadio([...this.invitados], marcoDeEmision(evento, datos));
      }
    });

    this.latido = setInterval(() => {
      this.anfitrion?.atender();
    }, LATIDO_MS);
  }

  private socketDelAnfitrion(): SocketMinimo {
    this.socketPropio = new SocketDelAnfitrion(
      (mensaje, datos) =>
        this.anfitrion?.pedir(CONEXION_DEL_ANFITRION, mensaje, datos) ?? {
          ok: false,
          error: 'SALA_NO_ENCONTRADA',
        },
      () => {
        void this.cerrar();
      },
    );
    return this.socketPropio;
  }

  /** Se engancha a la radio una sola vez, la primera que hace falta. */
  private async escucharLaRadio(): Promise<void> {
    if (this.dejarDeEscuchar !== null) {
      return;
    }
    this.dejarDeEscuchar = await this.radio.escuchar((suceso) => {
      this.atender(suceso);
    });
  }

  private atender(suceso: SucesoCercano): void {
    switch (suceso.tipo) {
      case 'encontrada':
        this.cercanasInternas.update((todas) =>
          todas.some((una) => una.id === suceso.id)
            ? todas
            : [...todas, { id: suceso.id, nombre: suceso.nombre }],
        );
        return;
      case 'perdida':
        this.cercanasInternas.update((todas) => todas.filter((una) => una.id !== suceso.id));
        return;
      case 'conectada':
        this.alConectar(suceso.id);
        return;
      case 'desconectada':
        this.alDesconectar(suceso.id);
        return;
      case 'mensaje':
        this.alLlegarMensaje(suceso.id, suceso.texto);
        return;
      case 'fallo':
        this.falloInterno.set(suceso.motivo);
        return;
    }
  }

  private alConectar(id: string): void {
    if (this.anfitrionRemoto === id) {
      this.esperandoLinea?.(true);
      this.esperandoLinea = null;
      this.socketInvitado?.anunciarConexion();
      return;
    }

    this.invitados.add(id);
    this.ensambladores.set(id, new Ensamblador());
  }

  private alDesconectar(id: string): void {
    if (this.anfitrionRemoto === id) {
      // Se fue el que tenia la sala: la partida se acabo para todos, y hay que
      // decirlo en vez de dejar un tablero que ya no avanza.
      this.esperandoLinea?.(false);
      this.esperandoLinea = null;
      this.socketInvitado?.anunciarCaida();
      return;
    }

    this.invitados.delete(id);
    this.ensambladores.delete(id);
    this.anfitrion?.desconectar(id);
  }

  /**
   * Un trozo recien llegado por la radio.
   *
   * En el invitado va derecho a su socket; en el anfitrion hay que juntarlo,
   * pasarselo a la sala y devolver la respuesta por donde vino.
   */
  private alLlegarMensaje(id: string, texto: string): void {
    if (this.anfitrionRemoto === id) {
      this.socketInvitado?.recibirTrozo(texto);
      return;
    }

    const anfitrion = this.anfitrion;
    const ensamblador = this.ensambladores.get(id);
    if (anfitrion === null || ensamblador === undefined) {
      return;
    }

    const completo = ensamblador.juntar(texto);
    if (completo === null) {
      return;
    }

    let marco: Marco;
    try {
      marco = JSON.parse(completo) as Marco;
    } catch {
      return;
    }
    if (marco?.t !== 'p' || typeof marco.m !== 'string' || !Number.isInteger(marco.id)) {
      return;
    }

    const respuesta = anfitrion.pedir(id, marco.m, marco.d);
    void this.mandarPorRadio([id], marcoDeRespuesta(marco.id, respuesta));
  }

  /**
   * Manda los trozos de un mensaje, en orden.
   *
   * Se espera a cada uno antes del siguiente: Nearby entrega en orden lo que se
   * le da en orden, y lanzarlos todos a la vez deja ese orden en manos de como
   * resuelvan las promesas.
   */
  private async mandarPorRadio(ids: readonly string[], trozos: readonly string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    try {
      for (const trozo of trozos) {
        await this.radio.enviar(ids, trozo);
      }
    } catch (fallo) {
      this.falloInterno.set(motivoDe(fallo));
    }
  }

  private pararLatido(): void {
    if (this.latido !== null) {
      clearInterval(this.latido);
      this.latido = null;
    }
  }
}

/**
 * Credencial de un puesto de la sala.
 *
 * `randomUUID` no esta en todos los WebView que admite el APK, pero
 * `getRandomValues` si: es lo unico de la criptografia del navegador que no
 * pide un origen seguro ni una version reciente.
 */
function credencial(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function codigoDeSala(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(LARGO_DEL_CODIGO));
  return [...bytes].map((byte) => ALFABETO[byte % ALFABETO.length]).join('');
}

/** El texto de un fallo de la radio, sin dar por hecho que sea un Error. */
function motivoDe(fallo: unknown): string {
  return fallo instanceof Error ? fallo.message : String(fallo);
}
