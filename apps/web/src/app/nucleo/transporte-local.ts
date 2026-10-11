import type { SocketMinimo } from './online.servicio';

/**
 * Lo que cabe en un mensaje de los que se mandan por la radio, en caracteres.
 *
 * Nearby admite **32 KB por payload de bytes** y ahi no cabe una partida
 * grande: un tablero de 30x30 pasa de las 900 celdas, y cada celda serializada
 * ronda los 70 bytes, asi que el estado se va por encima de los 60 KB. Hay que
 * partirlo, y el limite se cuenta en caracteres y no en bytes para no tener que
 * medir: un caracter del plano basico ocupa **como mucho tres bytes** en UTF-8,
 * asi que 8000 caracteres no pasan de 24 KB pase lo que pase. Sobra sitio para
 * el sobre, y no hay que andar contando bytes en cada envio.
 */
const MAXIMO_POR_TROZO = 8000;

/**
 * Mensajes a medias que se guardan a la vez antes de empezar a tirar los mas
 * viejos.
 *
 * Del otro lado hay otro telefono y no se fia nadie: sin tope, quien mandara
 * trozos de mensajes que no termina nunca dejaria la memoria creciendo sola.
 */
const MENSAJES_A_MEDIAS = 8;

/**
 * Lo que va dentro de un mensaje, que es lo mismo que lleva Socket.IO por su
 * cuenta: peticiones con respuesta, y difusiones sin ella.
 *
 * - `p` peticion: lleva numero para poder casarla con su respuesta.
 * - `r` respuesta: el acuse de recibo de esa peticion.
 * - `e` emision: lo que el anfitrion difunde a todos, sin respuesta.
 */
export type Marco =
  | { readonly t: 'p'; readonly id: number; readonly m: string; readonly d?: unknown }
  | { readonly t: 'r'; readonly id: number; readonly d: unknown }
  | { readonly t: 'e'; readonly m: string; readonly d: unknown };

/** Un trozo de un mensaje, con lo justo para volver a juntarlo. */
interface Sobre {
  /** Identificador del mensaje partido; los trozos se juntan por el. */
  readonly m: string;
  /** Numero de este trozo, empezando en cero. */
  readonly i: number;
  /** Cuantos trozos son en total. */
  readonly n: number;
  readonly c: string;
}

/**
 * Parte un mensaje en trozos que quepan en un payload de Nearby.
 *
 * **El corte respeta los pares suplentes.** Un emoji o un caracter fuera del
 * plano basico ocupa dos unidades en una cadena de JavaScript, y partir justo
 * por en medio deja media letra a cada lado: al volver a juntarlas sale otra
 * cosa. Como los nombres los teclea el jugador, esto pasa de verdad.
 */
export function partir(texto: string, maximo = MAXIMO_POR_TROZO): readonly string[] {
  const identificador = Math.random().toString(36).slice(2, 10);
  const trozos: string[] = [];

  let desde = 0;
  while (desde < texto.length) {
    let hasta = Math.min(desde + maximo, texto.length);
    // Si el corte cae entre las dos mitades de un caracter, se retrocede uno.
    if (hasta < texto.length && esSuplenteAlto(texto.charCodeAt(hasta - 1))) {
      hasta -= 1;
    }
    trozos.push(texto.slice(desde, hasta));
    desde = hasta;
  }

  if (trozos.length === 0) {
    trozos.push('');
  }

  return trozos.map((contenido, indice) =>
    JSON.stringify({
      m: identificador,
      i: indice,
      n: trozos.length,
      c: contenido,
    } satisfies Sobre),
  );
}

function esSuplenteAlto(codigo: number): boolean {
  return codigo >= 0xd800 && codigo <= 0xdbff;
}

/**
 * Junta los trozos que van llegando y devuelve el mensaje cuando esta entero.
 *
 * Nearby entrega los payloads de bytes en orden, pero los trozos se guardan
 * por su numero de todas formas: cuesta lo mismo y no depende de una garantia
 * que no esta escrita en ninguna parte.
 */
export class Ensamblador {
  private readonly aMedias = new Map<string, (string | undefined)[]>();

  /** El mensaje completo, o null si todavia faltan trozos. */
  juntar(trozo: string): string | null {
    let sobre: Sobre;
    try {
      sobre = JSON.parse(trozo) as Sobre;
    } catch {
      // Lo que no es un sobre no es de este juego: se tira sin ruido.
      return null;
    }

    if (
      typeof sobre?.m !== 'string' ||
      !Number.isInteger(sobre.i) ||
      !Number.isInteger(sobre.n) ||
      sobre.n < 1 ||
      sobre.i < 0 ||
      sobre.i >= sobre.n ||
      typeof sobre.c !== 'string'
    ) {
      return null;
    }

    if (sobre.n === 1) {
      return sobre.c;
    }

    // `fill` no es de adorno: un array creado por tamaño esta **disperso**, y
    // `some` se salta los huecos. Sin rellenarlo, un mensaje de nueve trozos se
    // daba por completo con el primero que llegara, y lo que salia de ahi era
    // un JSON cortado por la mitad.
    const partes =
      this.aMedias.get(sobre.m) ?? new Array<string | undefined>(sobre.n).fill(undefined);
    partes[sobre.i] = sobre.c;
    this.aMedias.set(sobre.m, partes);
    this.olvidarLosMasViejos();

    if (partes.some((parte) => parte === undefined)) {
      return null;
    }

    this.aMedias.delete(sobre.m);
    return partes.join('');
  }

  private olvidarLosMasViejos(): void {
    while (this.aMedias.size > MENSAJES_A_MEDIAS) {
      const masViejo = this.aMedias.keys().next().value;
      if (masViejo === undefined) {
        return;
      }
      this.aMedias.delete(masViejo);
    }
  }
}

/**
 * Lo comun a los dos extremos de una partida local: guardar a quien escucha
 * cada evento y avisarle cuando llega.
 *
 * `ServicioOnline` espera un socket, asi que los dos extremos tienen que
 * parecerlo; lo unico que cambia entre ellos es por donde sale el mensaje.
 */
abstract class SocketConEscuchas implements SocketMinimo {
  private readonly escuchas = new Map<string, ((datos: never) => void)[]>();
  protected cerrado = false;

  on(evento: string, escucha: (datos: never) => void): void {
    const suyas = this.escuchas.get(evento) ?? [];
    suyas.push(escucha);
    this.escuchas.set(evento, suyas);
  }

  abstract emitWithAck(evento: string, datos?: unknown): Promise<unknown>;

  abstract disconnect(): void;

  /** Avisa a quien escuche ese evento; lo usan los dos extremos. */
  protected avisar(evento: string, datos: unknown): void {
    for (const escucha of this.escuchas.get(evento) ?? []) {
      escucha(datos as never);
    }
  }
}

/**
 * El socket del que monta la partida: habla con el anfitrion que tiene dentro.
 *
 * No hay radio por medio ni hace falta: el anfitrion corre en este mismo
 * telefono, asi que la peticion es una llamada y la respuesta el valor que
 * devuelve. Se disfraza de socket para que `ServicioOnline` no tenga que saber
 * si la sala esta en un servidor o en la mano de quien juega.
 */
export class SocketDelAnfitrion extends SocketConEscuchas {
  constructor(
    private readonly preguntar: (mensaje: string, datos: unknown) => unknown,
    private readonly alCerrar: () => void,
  ) {
    super();
    // El «conectado» llega en el siguiente turno del bucle y no aqui mismo:
    // quien crea el socket todavia no ha tenido ocasion de escucharlo.
    queueMicrotask(() => {
      if (!this.cerrado) {
        this.avisar('connect', undefined);
      }
    });
  }

  emitWithAck(evento: string, datos?: unknown): Promise<unknown> {
    if (this.cerrado) {
      return Promise.resolve(null);
    }
    return Promise.resolve(this.preguntar(evento, datos));
  }

  disconnect(): void {
    if (this.cerrado) {
      return;
    }
    this.cerrado = true;
    this.alCerrar();
  }

  /** Lo que el anfitrion difunde le llega tambien a quien lo aloja. */
  recibir(evento: string, datos: unknown): void {
    if (!this.cerrado) {
      this.avisar(evento, datos);
    }
  }
}

/**
 * El socket del invitado: habla con el anfitrion por la radio.
 *
 * Cada peticion lleva numero y se queda esperando la respuesta con ese mismo
 * numero, que es lo que Socket.IO hace por dentro con su acuse de recibo. Si
 * la conexion se corta, **las esperas se resuelven en null** en lugar de
 * quedarse colgadas: quien pregunto se entera de que no hubo respuesta, y la
 * pantalla puede decirlo.
 */
export class SocketDelInvitado extends SocketConEscuchas {
  private readonly ensamblador = new Ensamblador();
  private readonly esperando = new Map<number, (respuesta: unknown) => void>();
  private siguiente = 1;
  /** La radio ya dio linea con el anfitrion. */
  private enLinea = false;

  constructor(
    private readonly enviar: (trozos: readonly string[]) => void,
    private readonly alCerrar: () => void,
  ) {
    super();
  }

  /**
   * Quien se pone a escuchar cuando la linea ya estaba abierta se entera igual.
   *
   * El orden aqui no lo manda el socket sino la radio: la conexion con el
   * anfitrion se negocia **antes** de que `ServicioOnline` llegue a mirar, y
   * sin esto la pantalla se quedaria en «conectando» con la partida ya en
   * marcha.
   */
  override on(evento: string, escucha: (datos: never) => void): void {
    super.on(evento, escucha);
    if (evento === 'connect' && this.enLinea && !this.cerrado) {
      escucha(undefined as never);
    }
  }

  emitWithAck(evento: string, datos?: unknown): Promise<unknown> {
    if (this.cerrado) {
      return Promise.resolve(null);
    }

    const id = this.siguiente;
    this.siguiente += 1;

    const respuesta = new Promise<unknown>((resolver) => {
      this.esperando.set(id, resolver);
    });

    this.enviar(partir(JSON.stringify({ t: 'p', id, m: evento, d: datos } satisfies Marco)));
    return respuesta;
  }

  disconnect(): void {
    if (this.cerrado) {
      return;
    }
    this.cerrado = true;
    this.soltarEsperas();
    this.alCerrar();
  }

  /** La radio dice que ya hay linea con el anfitrion. */
  anunciarConexion(): void {
    this.enLinea = true;
    this.avisar('connect', undefined);
  }

  /**
   * La radio dice que se acabo la linea.
   *
   * Se sueltan las esperas antes de avisar: si no, la pantalla se entera de la
   * caida mientras alguien sigue esperando un acuse de recibo que ya no puede
   * llegar.
   */
  anunciarCaida(): void {
    this.enLinea = false;
    this.soltarEsperas();
    this.avisar('disconnect', undefined);
  }

  /** Un trozo recien llegado por la radio. */
  recibirTrozo(trozo: string): void {
    const completo = this.ensamblador.juntar(trozo);
    if (completo === null) {
      return;
    }

    let marco: Marco;
    try {
      marco = JSON.parse(completo) as Marco;
    } catch {
      return;
    }

    if (marco?.t === 'r') {
      const esperando = this.esperando.get(marco.id);
      this.esperando.delete(marco.id);
      esperando?.(marco.d);
      return;
    }

    if (marco?.t === 'e') {
      this.avisar(marco.m, marco.d);
    }
  }

  private soltarEsperas(): void {
    for (const resolver of this.esperando.values()) {
      resolver(null);
    }
    this.esperando.clear();
  }
}

/** El mensaje con el que el anfitrion difunde algo a los suyos. */
export function marcoDeEmision(evento: string, datos: unknown): readonly string[] {
  return partir(JSON.stringify({ t: 'e', m: evento, d: datos } satisfies Marco));
}

/** El mensaje con el que el anfitrion contesta a una peticion. */
export function marcoDeRespuesta(id: number, datos: unknown): readonly string[] {
  return partir(JSON.stringify({ t: 'r', id, d: datos } satisfies Marco));
}
