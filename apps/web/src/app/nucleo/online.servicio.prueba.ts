import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  MENSAJES_DEL_CLIENTE,
  MENSAJES_DEL_SERVIDOR,
  VERSION_PROTOCOLO,
  type Entrada,
  type Resultado,
  type VistaSala,
} from '@minehunt/game-engine';

import {
  CREADOR_DE_SOCKET,
  ServicioOnline,
  type CreadorDeSocket,
  type SocketMinimo,
} from './online.servicio';

const CLAVE = 'minehunt.online';

/**
 * Un socket de mentira.
 *
 * Levantar un servidor de verdad aqui seria probar el servidor otra vez, y eso
 * ya lo hacen sus e2e. Lo que se prueba en este lado es que se manda lo que hay
 * que mandar y que lo que llega acaba en las senales.
 */
class SocketFalso implements SocketMinimo {
  readonly enviados: { mensaje: string; datos: unknown }[] = [];
  readonly respuestas = new Map<string, unknown>();
  desconectado = false;
  private readonly escuchas = new Map<string, (datos: never) => void>();

  on(evento: string, escucha: (datos: never) => void): void {
    this.escuchas.set(evento, escucha);
  }

  emitWithAck(mensaje: string, datos?: unknown): Promise<unknown> {
    this.enviados.push({ mensaje, datos });
    return Promise.resolve(this.respuestas.get(mensaje) ?? { ok: true, datos: null });
  }

  disconnect(): void {
    this.desconectado = true;
  }

  /** Lo que difundiria el servidor. */
  difundir(evento: string, datos: unknown): void {
    this.escuchas.get(evento)?.(datos as never);
  }

  /** Lo ultimo que se mando con ese nombre. */
  ultimo(mensaje: string): unknown {
    return [...this.enviados].reverse().find((envio) => envio.mensaje === mensaje)?.datos;
  }
}

const SALA: VistaSala = {
  codigo: 'ABCD',
  estado: 'lobby',
  configuracion: {
    ancho: 10,
    alto: 8,
    minas: 12,
    tiempoPorTurnoSegundos: 20,
    recargaOndaSegundos: 30,
    publica: true,
    nivelesIA: [],
  },
  puestos: [
    {
      id: 0,
      nombre: 'Ana',
      conectado: true,
      anfitrion: true,
      sustituido: false,
      bot: false,
      nivel: null,
    },
  ],
};

function entrada(puesto = 0): Entrada {
  return {
    codigo: 'ABCD',
    token: 'credencial-de-ana',
    puesto,
    sala: SALA,
    version: VERSION_PROTOCOLO,
  };
}

function entradaCorrecta(puesto = 0): Resultado<Entrada> {
  return { ok: true, datos: entrada(puesto) };
}

/** Como el falso, pero el servidor no contesta jamas. */
class SocketMudo extends SocketFalso {
  override emitWithAck(mensaje: string, datos?: unknown): Promise<unknown> {
    this.enviados.push({ mensaje, datos });
    return new Promise<unknown>(() => undefined);
  }
}

let socket: SocketFalso;

function crear(): ServicioOnline {
  socket = new SocketFalso();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      { provide: CREADOR_DE_SOCKET, useValue: ((): SocketMinimo => socket) satisfies CreadorDeSocket },
    ],
  });
  return TestBed.inject(ServicioOnline);
}

describe('ServicioOnline', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('al crear la sala guarda el puesto, la sala y la credencial', async () => {
    const online = crear();
    socket.respuestas.set(MENSAJES_DEL_CLIENTE.crearSala, entradaCorrecta());

    expect(await online.crearSala('Ana')).toBe(true);

    expect(online.puesto()).toBe(0);
    expect(online.sala()?.codigo).toBe('ABCD');
    expect(online.credencialGuardada()?.token).toBe('credencial-de-ana');
    expect(localStorage.getItem(CLAVE)).toContain('credencial-de-ana');
  });

  /** El servidor no deja entrar a un cliente de otra version. */
  it('manda la version del protocolo al entrar', async () => {
    const online = crear();
    socket.respuestas.set(MENSAJES_DEL_CLIENTE.crearSala, entradaCorrecta());
    await online.crearSala('Ana');

    expect(socket.ultimo(MENSAJES_DEL_CLIENTE.crearSala)).toMatchObject({
      nombre: 'Ana',
      version: VERSION_PROTOCOLO,
    });
  });

  it('el codigo de sala se manda en mayusculas y sin espacios', async () => {
    const online = crear();
    socket.respuestas.set(MENSAJES_DEL_CLIENTE.unirseASala, entradaCorrecta(1));

    await online.unirse('  abcd ', 'Bruno');

    expect(socket.ultimo(MENSAJES_DEL_CLIENTE.unirseASala)).toMatchObject({ codigo: 'ABCD' });
  });

  it('publica el error del servidor sin traducirlo', async () => {
    const online = crear();
    socket.respuestas.set(MENSAJES_DEL_CLIENTE.unirseASala, {
      ok: false,
      error: 'SALA_NO_ENCONTRADA',
    });

    expect(await online.unirse('ZZZZ', 'Bruno')).toBe(false);

    expect(online.ultimoError()).toBe('SALA_NO_ENCONTRADA');
    expect(online.sala()).toBeNull();
  });

  it('lo que difunde el servidor acaba en las senales', async () => {
    const online = crear();
    socket.respuestas.set(MENSAJES_DEL_CLIENTE.crearSala, entradaCorrecta());
    await online.crearSala('Ana');

    socket.difundir(MENSAJES_DEL_SERVIDOR.suceso, {
      codigo: 'MINA_ENCONTRADA',
      jugador: 1,
      celdas: 1,
    });

    // Se guarda el codigo, nunca el texto ya traducido: cada jugador lo lee en
    // su idioma.
    expect(online.ultimoSuceso()).toEqual({ codigo: 'MINA_ENCONTRADA', jugador: 1, celdas: 1 });
  });

  it('pregunta que salas estan esperando gente', async () => {
    const online = crear();
    socket.respuestas.set(MENSAJES_DEL_CLIENTE.salasAbiertas, {
      ok: true,
      datos: [{ codigo: 'ABCD', anfitrion: 'Ana', jugadores: 1, maximo: 4, bots: 0 }],
    });

    await online.pedirSalasAbiertas();

    expect(online.salasAbiertas()).toEqual([
      { codigo: 'ABCD', anfitrion: 'Ana', jugadores: 1, maximo: 4, bots: 0 },
    ]);
  });

  it('el clic manda las coordenadas y nada mas', async () => {
    const online = crear();
    socket.respuestas.set(MENSAJES_DEL_CLIENTE.crearSala, entradaCorrecta());
    await online.crearSala('Ana');

    await online.clic(3, 4);

    expect(socket.ultimo(MENSAJES_DEL_CLIENTE.clic)).toEqual({ x: 3, y: 4 });
  });

  it('sin sala no se manda nada al servidor', async () => {
    const online = crear();

    expect(await online.clic(0, 0)).toBe(false);
    expect(socket.enviados).toHaveLength(0);
  });

  it('vuelve a la sala guardada con la credencial', async () => {
    localStorage.setItem(
      CLAVE,
      JSON.stringify({ codigo: 'ABCD', token: 'credencial-de-ana', nombre: 'Ana' }),
    );
    const online = crear();
    socket.respuestas.set(MENSAJES_DEL_CLIENTE.reconectar, {
      ok: true,
      datos: { ...entrada(), partida: null },
    });

    expect(online.hayCredencial()).toBe(true);
    expect(await online.volverALaSala()).toBe(true);

    expect(socket.ultimo(MENSAJES_DEL_CLIENTE.reconectar)).toMatchObject({
      codigo: 'ABCD',
      token: 'credencial-de-ana',
    });
  });

  /**
   * Si la sala ya no existe hay que olvidarla: si no, el jugador se queda
   * intentando volver a una partida que no esta.
   */
  it('olvida la credencial si el servidor ya no la reconoce', async () => {
    localStorage.setItem(
      CLAVE,
      JSON.stringify({ codigo: 'ABCD', token: 'vieja', nombre: 'Ana' }),
    );
    const online = crear();
    socket.respuestas.set(MENSAJES_DEL_CLIENTE.reconectar, {
      ok: false,
      error: 'SALA_NO_ENCONTRADA',
    });

    expect(await online.volverALaSala()).toBe(false);

    expect(online.hayCredencial()).toBe(false);
    expect(localStorage.getItem(CLAVE)).toBeNull();
    expect(online.ultimoError()).toBe('SALA_NO_ENCONTRADA');
  });

  it('descarta una credencial guardada que no tiene forma de credencial', () => {
    localStorage.setItem(CLAVE, '{"codigo":42}');

    expect(crear().hayCredencial()).toBe(false);
  });

  it('salir deja la sala, olvida la credencial y corta', async () => {
    const online = crear();
    socket.respuestas.set(MENSAJES_DEL_CLIENTE.crearSala, entradaCorrecta());
    await online.crearSala('Ana');

    await online.salir();

    expect(socket.enviados.some((envio) => envio.mensaje === MENSAJES_DEL_CLIENTE.salir)).toBe(
      true,
    );
    expect(socket.desconectado).toBe(true);
    expect(online.hayCredencial()).toBe(false);
    expect(online.sala()).toBeNull();
  });
});

describe('ServicioOnline: cuando el servidor no contesta', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  /**
   * Crear una sala puede no llegar nunca: con el servidor apagado o fuera de
   * alcance el acuse de recibo no vuelve. El jugador tiene que poder rendirse
   * de esperar sin recargar la aplicacion.
   */
  it('cancelar la espera termina la peticion y corta la conexion', async () => {
    socket = new SocketMudo();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: CREADOR_DE_SOCKET,
          useValue: ((): SocketMinimo => socket) satisfies CreadorDeSocket,
        },
      ],
    });
    const online = TestBed.inject(ServicioOnline);

    const creando = online.crearSala('Ana');
    // Sin esto, la promesa de arriba no se resolveria jamas.
    online.cancelarEspera();

    expect(await creando).toBe(false);
    expect(socket.desconectado).toBe(true);
    expect(online.sala()).toBeNull();
  });
});
