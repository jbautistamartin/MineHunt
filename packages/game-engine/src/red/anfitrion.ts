import {
  MENSAJES_DEL_CLIENTE,
  MENSAJES_DEL_SERVIDOR,
  VERSION_PROTOCOLO,
  versionesCompatibles,
  type ConfiguracionSala,
  type Entrada,
  type Reentrada,
  type Resultado,
  type SalaAbierta,
  type SucesoPartida,
} from './protocolo.js';
import type { Sala } from './sala.js';

/**
 * El servidor de una sola sala, sin cable de ninguna clase.
 *
 * Es lo mismo que `PasarelaPartida` hace en el servidor del Online —traducir
 * mensajes del protocolo a llamadas a `Sala` y difundir lo que salga— con dos
 * diferencias: aqui hay **una sala y no muchas**, y no hay Socket.IO ni Nest
 * por ningun lado. Eso es lo que permite que el anfitrion de una partida local
 * sea un telefono: el mismo codigo que manda en el servidor corre dentro del
 * WebView de quien abrio la partida.
 *
 * Quien lo envuelve pone el cable: en el telefono, Nearby Connections para los
 * invitados y una llamada directa para el propio anfitrion, que no necesita
 * radio para hablar consigo mismo.
 *
 * **Del otro lado no se fia nadie, tambien aqui.** Los mensajes llegan de otro
 * telefono con su propio APK, que puede ser de otra version o estar tocado, asi
 * que se validan igual que en la pasarela: sin eso, una coordenada que no es un
 * numero revienta dentro del manejador y quien pregunto se queda esperando una
 * respuesta que ya no llega.
 */
export class Anfitrion {
  /**
   * La credencial atada a cada conexion, que es lo que dice quien manda cada
   * mensaje.
   *
   * Va aqui y no dentro del mensaje por lo mismo que en el servidor: si el
   * token viajara en cada peticion, cualquiera que se lo supiera podria jugar
   * por otro. La conexion es la prueba de identidad, y la credencial solo se
   * vuelve a enseñar al reconectar, que es cuando la conexion ya es otra.
   */
  private readonly credenciales = new Map<string, string>();

  constructor(
    private readonly sala: Sala,
    /** Manda un mensaje del servidor a todos los que estan en la sala. */
    private readonly difundir: (evento: string, datos: unknown) => void,
  ) {}

  get codigo(): string {
    return this.sala.codigo;
  }

  /** No queda nadie dentro; una partida local sin gente ya no es partida. */
  get vacia(): boolean {
    return this.sala.vacia;
  }

  /**
   * Un mensaje del protocolo, venga por donde venga.
   *
   * Devuelve lo mismo que devolveria el acuse de recibo de Socket.IO, porque
   * es el mismo contrato: `{ ok: true, datos }` o `{ ok: false, error }`.
   */
  pedir(conexion: string, mensaje: string, datos: unknown): Resultado<unknown> {
    switch (mensaje) {
      case MENSAJES_DEL_CLIENTE.salasAbiertas:
        return this.salasAbiertas();
      case MENSAJES_DEL_CLIENTE.crearSala:
        return this.crearSala(conexion, datos);
      case MENSAJES_DEL_CLIENTE.unirseASala:
        return this.unirse(conexion, datos);
      case MENSAJES_DEL_CLIENTE.reconectar:
        return this.reconectar(conexion, datos);
      case MENSAJES_DEL_CLIENTE.configurarSala:
        return this.configurar(conexion, datos);
      case MENSAJES_DEL_CLIENTE.empezarPartida:
        return this.empezar(conexion);
      case MENSAJES_DEL_CLIENTE.volverAlLobby:
        return this.volverAlLobby(conexion);
      case MENSAJES_DEL_CLIENTE.clic:
        return this.clic(conexion, datos);
      case MENSAJES_DEL_CLIENTE.onda:
        return this.onda(conexion, datos);
      case MENSAJES_DEL_CLIENTE.rendirse:
        return this.rendirse(conexion);
      case MENSAJES_DEL_CLIENTE.salir:
        return this.salir(conexion);
      default:
        return { ok: false, error: 'PETICION_INVALIDA' };
    }
  }

  /**
   * Se cae una conexion.
   *
   * En el lobby el puesto desaparece; con la partida en marcha se queda
   * esperando a que vuelva, y mientras tanto le juega un bot. Igual que en el
   * servidor, porque es la misma `Sala` la que lo decide.
   */
  desconectar(conexion: string): void {
    const token = this.credenciales.get(conexion);
    this.credenciales.delete(conexion);
    if (token === undefined) {
      return;
    }

    this.sala.desconectar(token);
    this.difundirSala();
  }

  /**
   * El repaso periodico: el reloj del turno y los bots que juegan por los
   * ausentes.
   *
   * El motor no tiene temporizadores propios y esa es la gracia; el que
   * pregunta es quien lleva la sala, que aqui es el telefono del anfitrion.
   */
  atender(): void {
    const sucesos = this.sala.atender();
    if (sucesos.length === 0) {
      return;
    }

    this.difundirPartida();
    for (const suceso of sucesos) {
      this.difundirSuceso(suceso);
    }
    this.difundirSiTermino();
  }

  private salasAbiertas(): Resultado<readonly SalaAbierta[]> {
    const resumen = this.sala.resumen();
    return { ok: true, datos: resumen === null ? [] : [resumen] };
  }

  /**
   * El anfitrion se sienta en la sala que ya monto al abrir la partida.
   *
   * La sala existe desde antes que esta llamada —la crea quien enciende la
   * radio—, asi que aqui «crear» es sentarse el primero y dejar los ajustes
   * puestos. Una segunda llamada no monta otra: en el telefono hay una sola.
   */
  private crearSala(conexion: string, datos: unknown): Resultado<Entrada> {
    const peticion = datos as { nombre?: unknown; version?: unknown; configuracion?: unknown };
    if (!esTexto(peticion?.nombre)) {
      return { ok: false, error: 'PETICION_INVALIDA' };
    }
    if (!versionAceptada(peticion.version)) {
      return { ok: false, error: 'VERSION_INCOMPATIBLE' };
    }
    if (this.sala.vista().puestos.length > 0) {
      return { ok: false, error: 'SALA_EN_JUEGO' };
    }

    const entrada = this.entrar(conexion, peticion.nombre);
    if (!entrada.ok) {
      return entrada;
    }

    if (peticion.configuracion !== undefined) {
      const ajustada = this.sala.configurar(
        entrada.datos.token,
        peticion.configuracion as Partial<ConfiguracionSala>,
      );
      if (!ajustada.ok) {
        return ajustada;
      }
    }

    return { ok: true, datos: { ...entrada.datos, sala: this.sala.vista() } };
  }

  private unirse(conexion: string, datos: unknown): Resultado<Entrada> {
    const peticion = datos as { codigo?: unknown; nombre?: unknown; version?: unknown };
    if (!esTexto(peticion?.codigo) || !esTexto(peticion.nombre)) {
      return { ok: false, error: 'PETICION_INVALIDA' };
    }
    if (!versionAceptada(peticion.version)) {
      return { ok: false, error: 'VERSION_INCOMPATIBLE' };
    }
    if (peticion.codigo.trim().toUpperCase() !== this.sala.codigo) {
      return { ok: false, error: 'SALA_NO_ENCONTRADA' };
    }

    const entrada = this.entrar(conexion, peticion.nombre);
    if (!entrada.ok) {
      return entrada;
    }

    this.difundirSala();
    return { ok: true, datos: { ...entrada.datos, sala: this.sala.vista() } };
  }

  private reconectar(conexion: string, datos: unknown): Resultado<Reentrada> {
    const peticion = datos as { codigo?: unknown; token?: unknown; version?: unknown };
    if (!esTexto(peticion?.codigo) || !esTexto(peticion.token)) {
      return { ok: false, error: 'PETICION_INVALIDA' };
    }
    if (!versionAceptada(peticion.version)) {
      return { ok: false, error: 'VERSION_INCOMPATIBLE' };
    }
    if (peticion.codigo.trim().toUpperCase() !== this.sala.codigo) {
      return { ok: false, error: 'SALA_NO_ENCONTRADA' };
    }

    const vuelta = this.sala.reconectar(peticion.token);
    if (!vuelta.ok) {
      return vuelta;
    }

    this.credenciales.set(conexion, peticion.token);
    this.difundirSala();

    return {
      ok: true,
      datos: {
        codigo: this.sala.codigo,
        token: peticion.token,
        puesto: vuelta.datos,
        sala: this.sala.vista(),
        version: VERSION_PROTOCOLO,
        partida: this.sala.estadoDePartida(),
      },
    };
  }

  private configurar(conexion: string, datos: unknown): Resultado<null> {
    return this.enLaSala(conexion, (token) => {
      const ajustada = this.sala.configurar(token, (datos ?? {}) as Partial<ConfiguracionSala>);
      if (ajustada.ok) {
        this.difundirSala();
      }
      return ajustada;
    });
  }

  private empezar(conexion: string): Resultado<null> {
    return this.enLaSala(conexion, (token) => {
      const empezada = this.sala.empezar(token);
      if (empezada.ok) {
        this.difundirSala();
        this.difundirPartida();
      }
      return empezada;
    });
  }

  private volverAlLobby(conexion: string): Resultado<null> {
    return this.enLaSala(conexion, (token) => {
      const vuelta = this.sala.volverAlLobby(token);
      if (vuelta.ok) {
        this.difundirSala();
      }
      return vuelta;
    });
  }

  private clic(conexion: string, datos: unknown): Resultado<SucesoPartida> {
    const peticion = datos as { x?: unknown; y?: unknown };
    if (!esEntero(peticion?.x) || !esEntero(peticion.y)) {
      return { ok: false, error: 'PETICION_INVALIDA' };
    }
    const { x, y } = peticion;

    return this.enLaSala(conexion, (token) => {
      const jugada = this.sala.clic(token, x, y);
      if (jugada.ok) {
        this.difundirPartida();
        this.difundirSuceso(jugada.datos);
        this.difundirSiTermino();
      }
      return jugada;
    });
  }

  private onda(conexion: string, datos: unknown): Resultado<null> {
    const peticion = datos as { activar?: unknown };
    if (typeof peticion?.activar !== 'boolean') {
      return { ok: false, error: 'PETICION_INVALIDA' };
    }
    const activar = peticion.activar;

    return this.enLaSala(conexion, (token) => {
      const armada = this.sala.onda(token, activar);
      if (armada.ok) {
        this.difundirPartida();
      }
      return armada;
    });
  }

  private rendirse(conexion: string): Resultado<SucesoPartida> {
    return this.enLaSala(conexion, (token) => {
      const rendicion = this.sala.rendirse(token);
      if (rendicion.ok) {
        this.difundirPartida();
        this.difundirSuceso(rendicion.datos);
        this.difundirSiTermino();
      }
      return rendicion;
    });
  }

  private salir(conexion: string): Resultado<null> {
    return this.enLaSala(conexion, (token) => {
      this.sala.desconectar(token);
      this.credenciales.delete(conexion);
      this.difundirSala();
      return { ok: true, datos: null };
    });
  }

  /** Sienta a alguien en la sala y le ata su credencial a esta conexion. */
  private entrar(conexion: string, nombre: string): Resultado<Omit<Entrada, 'sala'>> {
    const unido = this.sala.unirse(nombre);
    if (!unido.ok) {
      return unido;
    }

    const token = this.sala.tokenDe(unido.datos);
    if (token === null) {
      return { ok: false, error: 'JUGADOR_DESCONOCIDO' };
    }

    this.credenciales.set(conexion, token);
    return {
      ok: true,
      datos: {
        codigo: this.sala.codigo,
        token,
        puesto: unido.datos,
        version: VERSION_PROTOCOLO,
      },
    };
  }

  /** Resuelve la credencial de la conexion antes de dejarle hacer nada. */
  private enLaSala<T>(conexion: string, accion: (token: string) => Resultado<T>): Resultado<T> {
    const token = this.credenciales.get(conexion);
    if (token === undefined) {
      return { ok: false, error: 'JUGADOR_DESCONOCIDO' };
    }
    return accion(token);
  }

  private difundirSala(): void {
    this.difundir(MENSAJES_DEL_SERVIDOR.sala, this.sala.vista());
  }

  private difundirPartida(): void {
    const estado = this.sala.estadoDePartida();
    if (estado !== null) {
      this.difundir(MENSAJES_DEL_SERVIDOR.partida, estado);
    }
  }

  private difundirSuceso(suceso: SucesoPartida): void {
    this.difundir(MENSAJES_DEL_SERVIDOR.suceso, suceso);
  }

  /** Al acabar la partida cambia el estado de la sala, y hay que contarlo. */
  private difundirSiTermino(): void {
    if (this.sala.estado === 'terminada') {
      this.difundirSala();
    }
  }
}

function esTexto(valor: unknown): valor is string {
  return typeof valor === 'string';
}

function esEntero(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor);
}

/**
 * Quien entra dice con que version viene, y si no coincide se queda fuera.
 *
 * Aqui pesa mas que en el Online: alli el servidor impone una sola version a
 * todos los que entran, y en una partida local cada telefono lleva el APK que
 * se instalo por su cuenta, que puede ser de meses distintos.
 */
function versionAceptada(version: unknown): boolean {
  return esTexto(version) && versionesCompatibles(version, VERSION_PROTOCOLO);
}
