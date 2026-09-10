import { Inject, UseInterceptors, type OnModuleDestroy } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayDisconnect,
  type OnGatewayInit,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

import {
  MENSAJES_DEL_CLIENTE,
  MENSAJES_DEL_SERVIDOR,
  VERSION_PROTOCOLO,
  versionesCompatibles,
  type Entrada,
  type PeticionClic,
  type PeticionCrearSala,
  type PeticionOnda,
  type PeticionReconectar,
  type PeticionUnirse,
  type Reentrada,
  type Resultado,
  type SalaAbierta,
  type SucesoPartida,
} from '@minehunt/game-engine';
import { leerConfiguracion, type Configuracion } from '../configuracion.js';
import { CONFIGURACION } from './dependencias.js';
import { LimitadorDeRitmo } from './limitador.js';
import { InterceptorDeRitmo } from './ritmo.interceptor.js';
import type { Sala } from './sala.js';
import { ServicioSalas } from './salas.servicio.js';

/**
 * Cada cuanto se repasan las salas en marcha.
 *
 * Es el mismo latido que lleva el cliente en el Modo Entrenamiento, y por la
 * misma razon: el motor no tiene temporizadores propios, asi que hay que
 * preguntarle si al de turno se le acabo el tiempo.
 */
const LATIDO_MS = 250;

/** Lo que se guarda una sala sin nadie dentro por si vuelven. */
const TTL_SALA_VACIA_MS = 2 * 60 * 1000;

/** Lo que la pasarela ata a cada socket al entrar en una sala. */
interface DatosDelSocket {
  codigo?: string;
  token?: string;
}

/**
 * Del otro lado del cable no se fia nadie.
 *
 * Un mensaje puede traer cualquier cosa, y sin mirarlo antes una coordenada
 * que no es un numero o un nombre que no es texto se cuela hasta el motor y
 * revienta dentro del manejador: el cliente se queda esperando un acuse de
 * recibo que ya no va a llegar. Que sea la sala la que decide es justo lo que
 * hay que proteger.
 */
function esTexto(valor: unknown): valor is string {
  return typeof valor === 'string';
}

function esEntero(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor);
}

/**
 * Quien entra dice con que version viene, y si no coincide se queda fuera.
 *
 * El cliente puede ser un APK instalado hace meses mientras el servidor ya va
 * por otra version. Dejarles hablar creyendo que se entienden da partidas a
 * medias, que el jugador vive como un fallo del juego y no como lo que es: que
 * le toca actualizar.
 */
function versionAceptada(version: unknown): boolean {
  return esTexto(version) && versionesCompatibles(version, VERSION_PROTOCOLO);
}

/**
 * Los origenes con los que arranca la pasarela.
 *
 * El decorador se evalua al cargar el modulo, antes de que Nest inyecte nada,
 * asi que este es el unico sitio del servidor que lee el entorno por su
 * cuenta. La copia inyectada (`CONFIGURACION`) es la misma lectura y es la que
 * usan los topes; se separan porque el decorador no tiene forma de esperar.
 */
const ORIGENES = leerConfiguracion().origenes;

/**
 * La puerta de las partidas online: traduce mensajes de Socket.IO a llamadas a
 * la sala, y difunde a los de dentro lo que salga.
 *
 * Aqui no hay ni una regla del juego. Las reglas estan en el motor y el manejo
 * de la sala en `Sala`; esto solo conecta cables, que es lo que permite probar
 * la logica sin levantar un servidor.
 *
 * **No se manda texto a nadie**: se difunde el estado del motor y codigos de
 * suceso, y la frase la compone cada cliente en su idioma. Dos jugadores de la
 * misma sala pueden estar viendo la partida en idiomas distintos.
 */
@UseInterceptors(InterceptorDeRitmo)
@WebSocketGateway({ cors: { origin: ORIGENES ?? '*' } })
export class PasarelaPartida implements OnGatewayInit, OnGatewayDisconnect, OnModuleDestroy {
  @WebSocketServer()
  private servidor!: Server;

  private latido: ReturnType<typeof setInterval> | null = null;

  /** Desde cuando esta vacia cada sala, para recogerla si no vuelve nadie. */
  private readonly vaciasDesde = new Map<string, number>();

  constructor(
    private readonly salas: ServicioSalas,
    @Inject(CONFIGURACION) private readonly configuracion: Configuracion,
    private readonly ritmo: LimitadorDeRitmo,
  ) {}

  /**
   * Desde donde llama esa conexion, para repartirle su cupo de salas.
   *
   * Detras de un proxy inverso —que es como se despliega— la direccion del
   * socket es la del proxy y todo el mundo pareceria venir del mismo sitio, de
   * ahi `X-Forwarded-For`. **Solo se mira si se declara que hay un proxy
   * delante** (`CONFIAR_EN_PROXY`): esa cabecera la escribe quien quiera, y
   * fiarse de ella a pelo es regalar la forma de saltarse el tope por IP.
   */
  private ipDe(socket: Socket): string {
    if (this.configuracion.confiarEnProxy) {
      const reenviada = socket.handshake.headers['x-forwarded-for'];
      const primera = (Array.isArray(reenviada) ? reenviada[0] : reenviada)?.split(',')[0]?.trim();
      if (primera !== undefined && primera !== '') {
        return primera;
      }
    }
    return socket.handshake.address;
  }

  afterInit(): void {
    this.latido ??= setInterval(() => {
      this.atenderSalas();
    }, LATIDO_MS);
  }

  onModuleDestroy(): void {
    if (this.latido !== null) {
      clearInterval(this.latido);
      this.latido = null;
    }
  }

  /**
   * Se cae una conexion.
   *
   * En el lobby el puesto desaparece; con la partida en marcha se queda
   * esperando a que vuelva, y mientras tanto le juega un bot.
   */
  handleDisconnect(socket: Socket): void {
    this.ritmo.olvidar(socket.id);

    const { codigo, token } = socket.data as DatosDelSocket;
    if (codigo === undefined || token === undefined) {
      return;
    }

    const sala = this.salas.buscar(codigo);
    if (sala === null) {
      return;
    }

    sala.desconectar(token);
    if (sala.vacia && sala.estado === 'lobby') {
      this.salas.eliminar(codigo);
      return;
    }
    this.difundirSala(sala);
  }

  /**
   * Que salas estan esperando gente.
   *
   * Se pregunta, no se difunde: quien mira la lista todavia no esta en ninguna
   * sala, asi que no hay a quien difundirsela sin inventar una sala global solo
   * para eso.
   */
  @SubscribeMessage(MENSAJES_DEL_CLIENTE.salasAbiertas)
  salasAbiertas(): Resultado<readonly SalaAbierta[]> {
    const abiertas = this.salas
      .todas()
      .map((sala) => sala.resumen())
      .filter((resumen): resumen is SalaAbierta => resumen !== null);

    return { ok: true, datos: abiertas };
  }

  @SubscribeMessage(MENSAJES_DEL_CLIENTE.crearSala)
  crearSala(
    @ConnectedSocket() socket: Socket,
    @MessageBody() peticion: PeticionCrearSala,
  ): Resultado<Entrada> {
    if (!esTexto(peticion?.nombre)) {
      return { ok: false, error: 'PETICION_INVALIDA' };
    }
    if (!versionAceptada(peticion.version)) {
      return { ok: false, error: 'VERSION_INCOMPATIBLE' };
    }

    const sala = this.salas.crear({ conexion: socket.id, ip: this.ipDe(socket) });
    if (sala === null) {
      return { ok: false, error: 'DEMASIADAS_SALAS' };
    }

    const entrada = this.entrar(socket, sala, peticion.nombre);
    if (!entrada.ok) {
      this.salas.eliminar(sala.codigo);
      return entrada;
    }

    if (peticion.configuracion !== undefined) {
      const ajustada = sala.configurar(entrada.datos.token, peticion.configuracion);
      if (!ajustada.ok) {
        this.salas.eliminar(sala.codigo);
        return ajustada;
      }
    }

    return { ok: true, datos: { ...entrada.datos, sala: sala.vista() } };
  }

  @SubscribeMessage(MENSAJES_DEL_CLIENTE.unirseASala)
  unirse(
    @ConnectedSocket() socket: Socket,
    @MessageBody() peticion: PeticionUnirse,
  ): Resultado<Entrada> {
    if (!esTexto(peticion?.codigo) || !esTexto(peticion.nombre)) {
      return { ok: false, error: 'PETICION_INVALIDA' };
    }
    if (!versionAceptada(peticion.version)) {
      return { ok: false, error: 'VERSION_INCOMPATIBLE' };
    }

    const sala = this.salas.buscar(peticion.codigo);
    if (sala === null) {
      return { ok: false, error: 'SALA_NO_ENCONTRADA' };
    }

    const entrada = this.entrar(socket, sala, peticion.nombre);
    if (!entrada.ok) {
      return entrada;
    }

    this.difundirSala(sala);
    return { ok: true, datos: { ...entrada.datos, sala: sala.vista() } };
  }

  @SubscribeMessage(MENSAJES_DEL_CLIENTE.reconectar)
  reconectar(
    @ConnectedSocket() socket: Socket,
    @MessageBody() peticion: PeticionReconectar,
  ): Resultado<Reentrada> {
    if (!esTexto(peticion?.codigo) || !esTexto(peticion.token)) {
      return { ok: false, error: 'PETICION_INVALIDA' };
    }
    if (!versionAceptada(peticion.version)) {
      return { ok: false, error: 'VERSION_INCOMPATIBLE' };
    }

    const sala = this.salas.buscar(peticion.codigo);
    if (sala === null) {
      return { ok: false, error: 'SALA_NO_ENCONTRADA' };
    }

    const vuelta = sala.reconectar(peticion.token);
    if (!vuelta.ok) {
      return vuelta;
    }

    this.atar(socket, sala.codigo, peticion.token);
    this.difundirSala(sala);

    return {
      ok: true,
      datos: {
        codigo: sala.codigo,
        token: peticion.token,
        puesto: vuelta.datos,
        sala: sala.vista(),
        version: VERSION_PROTOCOLO,
        partida: sala.estadoDePartida(),
      },
    };
  }

  @SubscribeMessage(MENSAJES_DEL_CLIENTE.configurarSala)
  configurar(
    @ConnectedSocket() socket: Socket,
    @MessageBody() configuracion: PeticionCrearSala['configuracion'],
  ): Resultado<null> {
    return this.enSuSala(socket, (sala, token) => {
      const ajustada = sala.configurar(token, configuracion ?? {});
      if (ajustada.ok) {
        this.difundirSala(sala);
      }
      return ajustada;
    });
  }

  @SubscribeMessage(MENSAJES_DEL_CLIENTE.empezarPartida)
  empezar(@ConnectedSocket() socket: Socket): Resultado<null> {
    return this.enSuSala(socket, (sala, token) => {
      const empezada = sala.empezar(token);
      if (empezada.ok) {
        this.difundirSala(sala);
        this.difundirPartida(sala);
      }
      return empezada;
    });
  }

  @SubscribeMessage(MENSAJES_DEL_CLIENTE.volverAlLobby)
  volverAlLobby(@ConnectedSocket() socket: Socket): Resultado<null> {
    return this.enSuSala(socket, (sala, token) => {
      const vuelta = sala.volverAlLobby(token);
      if (vuelta.ok) {
        this.difundirSala(sala);
      }
      return vuelta;
    });
  }

  @SubscribeMessage(MENSAJES_DEL_CLIENTE.clic)
  clic(
    @ConnectedSocket() socket: Socket,
    @MessageBody() peticion: PeticionClic,
  ): Resultado<SucesoPartida> {
    if (!esEntero(peticion?.x) || !esEntero(peticion.y)) {
      return { ok: false, error: 'PETICION_INVALIDA' };
    }

    return this.enSuSala(socket, (sala, token) => {
      const jugada = sala.clic(token, peticion.x, peticion.y);
      if (jugada.ok) {
        this.difundirPartida(sala);
        this.difundirSuceso(sala, jugada.datos);
        this.difundirSiTermino(sala);
      }
      return jugada;
    });
  }

  @SubscribeMessage(MENSAJES_DEL_CLIENTE.onda)
  onda(
    @ConnectedSocket() socket: Socket,
    @MessageBody() peticion: PeticionOnda,
  ): Resultado<null> {
    if (typeof peticion?.activar !== 'boolean') {
      return { ok: false, error: 'PETICION_INVALIDA' };
    }

    return this.enSuSala(socket, (sala, token) => {
      const armada = sala.onda(token, peticion.activar);
      if (armada.ok) {
        this.difundirPartida(sala);
      }
      return armada;
    });
  }

  @SubscribeMessage(MENSAJES_DEL_CLIENTE.rendirse)
  rendirse(@ConnectedSocket() socket: Socket): Resultado<SucesoPartida> {
    return this.enSuSala(socket, (sala, token) => {
      const rendicion = sala.rendirse(token);
      if (rendicion.ok) {
        this.difundirPartida(sala);
        this.difundirSuceso(sala, rendicion.datos);
        this.difundirSiTermino(sala);
      }
      return rendicion;
    });
  }

  @SubscribeMessage(MENSAJES_DEL_CLIENTE.salir)
  salir(@ConnectedSocket() socket: Socket): Resultado<null> {
    return this.enSuSala(socket, (sala, token) => {
      sala.desconectar(token);
      void socket.leave(sala.codigo);
      socket.data = {};

      if (sala.vacia && sala.estado === 'lobby') {
        this.salas.eliminar(sala.codigo);
      } else {
        this.difundirSala(sala);
      }
      return { ok: true, datos: null };
    });
  }

  /** Mete al socket en la sala y le ata su credencial. */
  private entrar(
    socket: Socket,
    sala: Sala,
    nombre: string,
  ): Resultado<Omit<Entrada, 'sala'>> {
    const unido = sala.unirse(nombre);
    if (!unido.ok) {
      return unido;
    }

    const token = sala.tokenDe(unido.datos);
    if (token === null) {
      return { ok: false, error: 'JUGADOR_DESCONOCIDO' };
    }

    this.atar(socket, sala.codigo, token);
    return {
      ok: true,
      datos: { codigo: sala.codigo, token, puesto: unido.datos, version: VERSION_PROTOCOLO },
    };
  }

  private atar(socket: Socket, codigo: string, token: string): void {
    socket.data = { codigo, token } satisfies DatosDelSocket;
    void socket.join(codigo);
  }

  /**
   * Resuelve la sala y la credencial del socket antes de hacer nada.
   *
   * El cliente no manda su token en cada mensaje: se lo queda el servidor al
   * entrar. Asi nadie puede jugar por otro sabiendose su credencial.
   */
  private enSuSala<T>(
    socket: Socket,
    accion: (sala: Sala, token: string) => Resultado<T>,
  ): Resultado<T> {
    const { codigo, token } = socket.data as DatosDelSocket;
    if (codigo === undefined || token === undefined) {
      return { ok: false, error: 'JUGADOR_DESCONOCIDO' };
    }

    const sala = this.salas.buscar(codigo);
    if (sala === null) {
      return { ok: false, error: 'SALA_NO_ENCONTRADA' };
    }

    return accion(sala, token);
  }

  /**
   * El repaso periodico de todas las salas: reloj de turno, bots que juegan
   * por los ausentes y salas que ya no espera nadie.
   */
  private atenderSalas(): void {
    const ahora = Date.now();

    for (const sala of this.salas.todas()) {
      const sucesos = sala.atender();
      if (sucesos.length > 0) {
        this.difundirPartida(sala);
        for (const suceso of sucesos) {
          this.difundirSuceso(sala, suceso);
        }
        this.difundirSiTermino(sala);
      }

      this.recogerSiEstaVacia(sala, ahora);
    }
  }

  /** Una sala sin nadie se guarda un rato por si vuelven, y luego se tira. */
  private recogerSiEstaVacia(sala: Sala, ahora: number): void {
    if (!sala.vacia) {
      this.vaciasDesde.delete(sala.codigo);
      return;
    }

    const desde = this.vaciasDesde.get(sala.codigo) ?? ahora;
    this.vaciasDesde.set(sala.codigo, desde);

    if (ahora - desde >= TTL_SALA_VACIA_MS) {
      this.vaciasDesde.delete(sala.codigo);
      this.salas.eliminar(sala.codigo);
    }
  }

  private difundirSala(sala: Sala): void {
    this.servidor.to(sala.codigo).emit(MENSAJES_DEL_SERVIDOR.sala, sala.vista());
  }

  private difundirPartida(sala: Sala): void {
    const estado = sala.estadoDePartida();
    if (estado !== null) {
      this.servidor.to(sala.codigo).emit(MENSAJES_DEL_SERVIDOR.partida, estado);
    }
  }

  private difundirSuceso(sala: Sala, suceso: SucesoPartida): void {
    this.servidor.to(sala.codigo).emit(MENSAJES_DEL_SERVIDOR.suceso, suceso);
  }

  /** Al acabar la partida cambia el estado de la sala, y hay que contarlo. */
  private difundirSiTermino(sala: Sala): void {
    if (sala.estado === 'terminada') {
      this.difundirSala(sala);
    }
  }
}
