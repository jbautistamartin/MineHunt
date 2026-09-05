import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  MENSAJES_DEL_CLIENTE,
  MENSAJES_DEL_SERVIDOR,
  VERSION_PROTOCOLO,
  type Entrada,
  type EstadoPartida,
  type Reentrada,
  type Resultado,
  type SucesoPartida,
  type VistaSala,
} from '@minehunt/game-engine';
import { io, type Socket } from 'socket.io-client';

import { ModuloPrincipal } from './../src/app.module.js';
import { AZAR, RELOJ } from './../src/salas/dependencias.js';

/** Tablero pequeno: una partida entera cabe en pocas jugadas. */
const CONFIGURACION = {
  ancho: 4,
  alto: 4,
  minas: 3,
  tiempoPorTurnoSegundos: 0,
  recargaOndaSegundos: 30,
};

/**
 * Partidas de verdad, con clientes de Socket.IO hablando con el servidor.
 *
 * El reloj y el azar del servidor se sustituyen por unos de mentira: asi las
 * minas caen siempre en el mismo sitio y el tiempo solo avanza cuando la
 * prueba lo dice, que es la unica forma de comprobar un turno perdido o un bot
 * entrando a sustituir sin esperar de verdad.
 */
describe('Salas multijugador (e2e)', () => {
  let aplicacion: INestApplication<Server>;
  let url: string;
  const reloj = { ahora: 0 };
  const clientes: Socket[] = [];

  beforeEach(async () => {
    reloj.ahora = 0;

    const modulo = await Test.createTestingModule({ imports: [ModuloPrincipal] })
      .overrideProvider(RELOJ)
      .useValue(() => reloj.ahora)
      .overrideProvider(AZAR)
      .useValue(() => 0)
      .compile();

    aplicacion = modulo.createNestApplication();
    await aplicacion.listen(0);

    const direccion = aplicacion.getHttpServer().address() as AddressInfo;
    url = `http://127.0.0.1:${direccion.port}`;
  });

  afterEach(async () => {
    for (const cliente of clientes) {
      cliente.disconnect();
    }
    clientes.length = 0;
    await aplicacion.close();
  });

  /** Un cliente conectado, ya listo para hablar. */
  async function conectar(): Promise<Socket> {
    const cliente = io(url, { transports: ['websocket'], forceNew: true });
    clientes.push(cliente);
    await new Promise<void>((seguir) => cliente.once('connect', () => { seguir(); }));
    return cliente;
  }

  /**
   * Manda una peticion y espera el acuse de recibo.
   *
   * emitWithAck parametriza el nombre del evento y no la respuesta, asi que la
   * forma del resultado se pone aqui una vez en lugar de en cada llamada.
   */
  async function pedir<T>(
    cliente: Socket,
    mensaje: string,
    datos?: unknown,
  ): Promise<Resultado<T>> {
    return (await cliente.emitWithAck(mensaje, datos)) as Resultado<T>;
  }

  /** Espera al proximo mensaje de ese nombre. Se llama antes de provocarlo. */
  function esperar<T>(cliente: Socket, mensaje: string): Promise<T> {
    return new Promise<T>((seguir) => {
      cliente.once(mensaje, (datos: T) => { seguir(datos); });
    });
  }

  /**
   * Espera al primer mensaje que cumpla la condicion.
   *
   * Hace falta cuando ya venia otro de camino: el acuse de recibo y la difusion
   * son mensajes distintos, asi que al terminar una peticion puede quedar sin
   * recoger la difusion de la anterior.
   */
  function esperarQue<T>(
    cliente: Socket,
    mensaje: string,
    condicion: (datos: T) => boolean,
  ): Promise<T> {
    return new Promise<T>((seguir) => {
      const escuchar = (datos: T): void => {
        if (condicion(datos)) {
          cliente.off(mensaje, escuchar);
          seguir(datos);
        }
      };
      cliente.on(mensaje, escuchar);
    });
  }

  /** Monta una sala con la gente pedida; devuelve un cliente por puesto. */
  async function montarSala(jugadores: number): Promise<{ codigo: string; sockets: Socket[] }> {
    const anfitrion = await conectar();
    const creada = await pedir<Entrada>(anfitrion, 
      MENSAJES_DEL_CLIENTE.crearSala,
      { nombre: 'Anfitrion', configuracion: CONFIGURACION, version: VERSION_PROTOCOLO },
    );
    if (!creada.ok) {
      throw new Error(`No se pudo crear la sala: ${creada.error}`);
    }

    const sockets = [anfitrion];
    for (let numero = 2; numero <= jugadores; numero += 1) {
      const invitado = await conectar();
      const unido = await pedir<Entrada>(invitado, 
        MENSAJES_DEL_CLIENTE.unirseASala,
        { codigo: creada.datos.codigo, nombre: `Jugador ${numero}`, version: VERSION_PROTOCOLO },
      );
      expect(unido.ok).toBe(true);
      sockets.push(invitado);
    }

    return { codigo: creada.datos.codigo, sockets };
  }

  /** Arranca la partida y devuelve el primer estado que difunde el servidor. */
  async function empezar(sockets: Socket[]): Promise<EstadoPartida> {
    const primerEstado = esperar<EstadoPartida>(sockets[0] as Socket, MENSAJES_DEL_SERVIDOR.partida);
    const empezada = await pedir<null>((sockets[0] as Socket), 
      MENSAJES_DEL_CLIENTE.empezarPartida,
    );
    expect(empezada.ok).toBe(true);
    return primerEstado;
  }

  it('dos jugadores comparten sala y el segundo ve entrar al primero', async () => {
    const anfitrion = await conectar();
    const creada = await pedir<Entrada>(anfitrion, 
      MENSAJES_DEL_CLIENTE.crearSala,
      { nombre: 'Ana', configuracion: CONFIGURACION, version: VERSION_PROTOCOLO },
    );

    expect(creada.ok).toBe(true);
    if (!creada.ok) {
      return;
    }
    expect(creada.datos.codigo).toMatch(/^[A-Z2-9]{4}$/);
    expect(creada.datos.puesto).toBe(0);
    expect(creada.datos.sala.puestos[0]?.anfitrion).toBe(true);

    const salaActualizada = esperar<VistaSala>(anfitrion, MENSAJES_DEL_SERVIDOR.sala);
    const invitado = await conectar();
    const unido = await pedir<Entrada>(invitado, 
      MENSAJES_DEL_CLIENTE.unirseASala,
      { codigo: creada.datos.codigo, nombre: 'Bruno', version: VERSION_PROTOCOLO },
    );

    expect(unido.ok).toBe(true);
    expect((await salaActualizada).puestos.map((puesto) => puesto.nombre)).toEqual([
      'Ana',
      'Bruno',
    ]);
  });

  it('no se entra en una sala que no existe', async () => {
    const cliente = await conectar();

    const unido = await pedir<Entrada>(cliente, 
      MENSAJES_DEL_CLIENTE.unirseASala,
      { codigo: 'ZZZZ', nombre: 'Nadie', version: VERSION_PROTOCOLO },
    );

    expect(unido).toEqual({ ok: false, error: 'SALA_NO_ENCONTRADA' });
  });

  it('el servidor no deja jugar a quien no tiene el turno', async () => {
    const { sockets } = await montarSala(2);
    const estado = await empezar(sockets);

    const deOtro = sockets[estado.turnoDe === 0 ? 1 : 0] as Socket;
    const jugada = await pedir<SucesoPartida>(deOtro, 
      MENSAJES_DEL_CLIENTE.clic,
      { x: 0, y: 0 },
    );

    expect(jugada).toEqual({ ok: false, error: 'NO_ES_TU_TURNO' });
  });

  /**
   * La prueba que pide el plan: varios clientes de verdad jugando una partida
   * de principio a fin contra el servidor, que es quien lleva el tablero.
   */
  it.each([2, 3, 4])('con %i jugadores se juega una partida entera', async (jugadores) => {
    const { sockets } = await montarSala(jugadores);
    const observador = sockets[0] as Socket;

    const sucesos: SucesoPartida[] = [];
    observador.on(MENSAJES_DEL_SERVIDOR.suceso, (suceso: SucesoPartida) => {
      sucesos.push(suceso);
    });

    let estado = await empezar(sockets);
    expect(estado.jugadores).toHaveLength(jugadores);

    for (let jugada = 0; jugada < 100 && !estado.terminada; jugada += 1) {
      const oculta = estado.celdas.flat().find((celda) => celda.estado === 'oculta');
      expect(oculta).toBeDefined();
      if (oculta === undefined) {
        break;
      }

      const deTurno = sockets[estado.turnoDe] as Socket;
      const siguiente = esperar<EstadoPartida>(observador, MENSAJES_DEL_SERVIDOR.partida);
      const respuesta = await pedir<SucesoPartida>(deTurno, 
        MENSAJES_DEL_CLIENTE.clic,
        { x: oculta.x, y: oculta.y },
      );

      expect(respuesta.ok).toBe(true);
      estado = await siguiente;
    }

    expect(estado.terminada).toBe(true);
    expect(estado.minasRestantes).toBe(0);
    // Nadie recibio texto: solo codigos y datos crudos, para que cada cliente
    // lo cuente en su idioma.
    expect(sucesos.length).toBeGreaterThan(0);
    expect(sucesos.every((suceso) => /^[A-Z_]+$/.test(suceso.codigo))).toBe(true);
    expect(sucesos.some((suceso) => suceso.codigo === 'MINA_ENCONTRADA')).toBe(true);
  });

  /**
   * El servidor es la autoridad, asi que del cliente no se fia: un mensaje con
   * lo que no toca se contesta con un error, no revienta dentro del manejador
   * dejando al que pregunto esperando un acuse de recibo que no llega.
   */
  it('rechaza los mensajes que no traen lo que dicen traer', async () => {
    const { sockets } = await montarSala(2);
    const estado = await empezar(sockets);
    const deTurno = sockets[estado.turnoDe] as Socket;

    expect(await pedir(deTurno, MENSAJES_DEL_CLIENTE.clic, { x: '0', y: 0 })).toEqual({
      ok: false,
      error: 'PETICION_INVALIDA',
    });
    expect(await pedir(deTurno, MENSAJES_DEL_CLIENTE.clic, {})).toEqual({
      ok: false,
      error: 'PETICION_INVALIDA',
    });
    expect(await pedir(deTurno, MENSAJES_DEL_CLIENTE.onda, { activar: 'si' })).toEqual({
      ok: false,
      error: 'PETICION_INVALIDA',
    });

    const cliente = await conectar();
    expect(
      await pedir(cliente, MENSAJES_DEL_CLIENTE.crearSala, { nombre: { truco: true }, version: VERSION_PROTOCOLO }),
    ).toEqual({ ok: false, error: 'PETICION_INVALIDA' });
  });

  /**
   * El APK instalado hace meses no puede jugar contra un servidor que ya habla
   * otro protocolo: mejor decirselo que dejarle una partida a medias.
   */
  it('un cliente de otra version no entra', async () => {
    const cliente = await conectar();

    expect(
      await pedir(cliente, MENSAJES_DEL_CLIENTE.crearSala, {
        nombre: 'Ana',
        version: '0.1.0',
      }),
    ).toEqual({ ok: false, error: 'VERSION_INCOMPATIBLE' });

    // Sin decir con cual viene, tampoco.
    expect(await pedir(cliente, MENSAJES_DEL_CLIENTE.crearSala, { nombre: 'Ana' })).toEqual({
      ok: false,
      error: 'VERSION_INCOMPATIBLE',
    });
  });

  it('terminada la partida, la sala vuelve al lobby para jugar otra', async () => {
    const { sockets } = await montarSala(2);
    const estado = await empezar(sockets);
    const anfitrion = sockets[0] as Socket;

    // Rindiendose queda uno solo en pie y la partida se acaba.
    const rendido = sockets[estado.turnoDe] as Socket;
    expect((await pedir(rendido, MENSAJES_DEL_CLIENTE.rendirse)).ok).toBe(true);

    const sala = esperarQue<VistaSala>(
      sockets[1] as Socket,
      MENSAJES_DEL_SERVIDOR.sala,
      (vista) => vista.estado === 'lobby',
    );
    expect((await pedir(anfitrion, MENSAJES_DEL_CLIENTE.volverAlLobby)).ok).toBe(true);

    expect((await sala).puestos).toHaveLength(2);
    expect((await pedir(anfitrion, MENSAJES_DEL_CLIENTE.empezarPartida)).ok).toBe(true);
  });

  it('quien se cae recupera su puesto y la partida con su credencial', async () => {
    const anfitrion = await conectar();
    const creada = await pedir<Entrada>(anfitrion, 
      MENSAJES_DEL_CLIENTE.crearSala,
      { nombre: 'Ana', configuracion: CONFIGURACION, version: VERSION_PROTOCOLO },
    );
    if (!creada.ok) {
      throw new Error(creada.error);
    }

    const invitado = await conectar();
    const unido = await pedir<Entrada>(invitado, 
      MENSAJES_DEL_CLIENTE.unirseASala,
      { codigo: creada.datos.codigo, nombre: 'Bruno', version: VERSION_PROTOCOLO },
    );
    if (!unido.ok) {
      throw new Error(unido.error);
    }

    await empezar([anfitrion, invitado]);
    invitado.disconnect();

    const vuelto = await conectar();
    const reentrada = await pedir<Reentrada>(vuelto, 
      MENSAJES_DEL_CLIENTE.reconectar,
      { codigo: creada.datos.codigo, token: unido.datos.token, version: VERSION_PROTOCOLO },
    );

    expect(reentrada.ok).toBe(true);
    if (!reentrada.ok) {
      return;
    }
    expect(reentrada.datos.puesto).toBe(1);
    expect(reentrada.datos.partida?.terminada).toBe(false);
    expect(reentrada.datos.sala.puestos[1]?.conectado).toBe(true);
  });

  it('con una credencial inventada no se recupera ningun puesto', async () => {
    const { codigo } = await montarSala(2);
    const intruso = await conectar();

    const reentrada = await pedir<Reentrada>(intruso, 
      MENSAJES_DEL_CLIENTE.reconectar,
      { codigo, token: 'no-es-mi-credencial', version: VERSION_PROTOCOLO },
    );

    expect(reentrada).toEqual({ ok: false, error: 'JUGADOR_DESCONOCIDO' });
  });

  it('si el de turno se cae, un bot juega por el y la partida sigue', async () => {
    const { sockets } = await montarSala(2);
    const estado = await empezar(sockets);
    const observador = sockets[estado.turnoDe === 0 ? 1 : 0] as Socket;

    const suceso = esperar<SucesoPartida>(observador, MENSAJES_DEL_SERVIDOR.suceso);
    (sockets[estado.turnoDe] as Socket).disconnect();

    // El reloj tiene que correr, no saltar: la espera de cortesia se cuenta
    // desde que el servidor se entera de la caida, asi que ponerlo de golpe en
    // un instante futuro deja el plazo por vencer para siempre.
    const avanzarElTiempo = setInterval(() => {
      reloj.ahora += 1000;
    }, 20);

    try {
      expect((await suceso).jugador).toBe(estado.turnoDe);
    } finally {
      clearInterval(avanzarElTiempo);
    }
  });

  it('a quien se queda pensando de mas se le pasa el turno', async () => {
    const anfitrion = await conectar();
    const creada = await pedir<Entrada>(anfitrion, 
      MENSAJES_DEL_CLIENTE.crearSala,
      {
        nombre: 'Ana',
        configuracion: { ...CONFIGURACION, tiempoPorTurnoSegundos: 10 },
        version: VERSION_PROTOCOLO,
      },
    );
    if (!creada.ok) {
      throw new Error(creada.error);
    }

    const invitado = await conectar();
    await pedir<Entrada>(invitado, MENSAJES_DEL_CLIENTE.unirseASala, {
      codigo: creada.datos.codigo,
      nombre: 'Bruno',
      version: VERSION_PROTOCOLO,
    });

    const estado = await empezar([anfitrion, invitado]);
    const suceso = esperar<SucesoPartida>(invitado, MENSAJES_DEL_SERVIDOR.suceso);

    reloj.ahora = 10_001;

    expect(await suceso).toEqual({
      codigo: 'TURNO_PERDIDO',
      jugador: estado.turnoDe,
      celdas: 0,
    });
  });
});
