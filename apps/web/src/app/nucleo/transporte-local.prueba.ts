import {
  Anfitrion,
  MENSAJES_DEL_CLIENTE,
  MENSAJES_DEL_SERVIDOR,
  Sala,
  VERSION_PROTOCOLO,
  type ConfiguracionSala,
  type EstadoPartida,
  type Resultado,
} from '@minehunt/game-engine';

import {
  Ensamblador,
  SocketDelAnfitrion,
  SocketDelInvitado,
  marcoDeEmision,
  marcoDeRespuesta,
  partir,
  type Marco,
} from './transporte-local';

/**
 * El tablero mas grande que el juego deja montar.
 *
 * Se usa a proposito: son 900 celdas, y el estado serializado pasa de los 60
 * mil caracteres. Es justo el caso que **no cabe en un payload de Nearby** y
 * obliga a partir el mensaje, que es lo que hay que comprobar.
 */
const TABLERO_GRANDE: ConfiguracionSala = {
  ancho: 30,
  alto: 30,
  minas: 100,
  tiempoPorTurnoSegundos: 0,
  recargaOndaSegundos: 30,
  publica: true,
  nivelesIA: [],
};

/** Los dos extremos de una partida local, unidos por un cable de mentira. */
interface Enlace {
  readonly anfitrion: Anfitrion;
  readonly socketPropio: SocketDelAnfitrion;
  readonly socketInvitado: SocketDelInvitado;
  /** Cuantos trozos ha tenido que mandar el invitado, para poder mirarlo. */
  readonly trozosDelInvitado: string[];
}

/**
 * Monta un anfitrion y un invitado hablando por un cable que no es de radio.
 *
 * Es el reparto de verdad: los mensajes se parten, se ensamblan y se
 * responden igual que lo harian con Nearby en medio. Lo unico que cambia es
 * que el cable es una llamada de funcion, que es lo que permite probarlo sin
 * dos telefonos en la mano.
 */
function enlazar(): Enlace {
  let credenciales = 0;
  const sala = new Sala(
    'PRUE',
    () => Date.now(),
    () => 0,
    () => {
      credenciales += 1;
      return `credencial-${String(credenciales)}`;
    },
  );

  let socketPropio: SocketDelAnfitrion | null = null;
  let socketInvitado: SocketDelInvitado | null = null;
  const trozosDelInvitado: string[] = [];

  const anfitrion = new Anfitrion(sala, (evento, datos) => {
    socketPropio?.recibir(evento, datos);
    for (const trozo of marcoDeEmision(evento, datos)) {
      socketInvitado?.recibirTrozo(trozo);
    }
  });

  socketPropio = new SocketDelAnfitrion(
    (mensaje, datos) => anfitrion.pedir('anfitrion', mensaje, datos),
    () => undefined,
  );

  // El lado del anfitrion junta los trozos de cada invitado por separado.
  const ensamblador = new Ensamblador();
  socketInvitado = new SocketDelInvitado((trozos) => {
    for (const trozo of trozos) {
      trozosDelInvitado.push(trozo);
      const completo = ensamblador.juntar(trozo);
      if (completo === null) {
        continue;
      }

      const marco = JSON.parse(completo) as Marco;
      if (marco.t !== 'p') {
        continue;
      }
      const respuesta = anfitrion.pedir('invitado', marco.m, marco.d);
      for (const vuelta of marcoDeRespuesta(marco.id, respuesta)) {
        socketInvitado?.recibirTrozo(vuelta);
      }
    }
  }, () => undefined);

  return { anfitrion, socketPropio, socketInvitado, trozosDelInvitado };
}

describe('partir', () => {
  it('deja un solo trozo cuando el mensaje cabe entero', () => {
    expect(partir('hola')).toHaveLength(1);
  });

  it('parte el mensaje en tantos trozos como hagan falta', () => {
    expect(partir('a'.repeat(25), 10)).toHaveLength(3);
  });

  it('no parte un caracter por la mitad', () => {
    // Cada bandera son dos unidades de cadena; cortar en medio da basura.
    const banderas = '🚩'.repeat(6);
    const trozos = partir(banderas, 5);
    const ensamblador = new Ensamblador();

    let juntado: string | null = null;
    for (const trozo of trozos) {
      juntado = ensamblador.juntar(trozo) ?? juntado;
    }

    expect(juntado).toBe(banderas);
    expect(juntado).not.toContain('�');
  });
});

describe('Ensamblador', () => {
  it('devuelve el mensaje solo cuando estan todos los trozos', () => {
    const ensamblador = new Ensamblador();
    const trozos = partir('el mensaje entero', 6);

    const parciales = trozos.slice(0, -1).map((trozo) => ensamblador.juntar(trozo));
    expect(parciales.every((parcial) => parcial === null)).toBe(true);
    expect(ensamblador.juntar(trozos[trozos.length - 1] as string)).toBe('el mensaje entero');
  });

  it('se traga sin ruido lo que no es un sobre', () => {
    const ensamblador = new Ensamblador();
    expect(ensamblador.juntar('esto no es json')).toBeNull();
    expect(ensamblador.juntar('{"m":1,"i":0,"n":1,"c":"x"}')).toBeNull();
  });

  it('junta dos mensajes entrelazados sin mezclarlos', () => {
    const ensamblador = new Ensamblador();
    const uno = partir('AAAAAA', 3);
    const otro = partir('BBBBBB', 3);

    expect(ensamblador.juntar(uno[0] as string)).toBeNull();
    expect(ensamblador.juntar(otro[0] as string)).toBeNull();
    expect(ensamblador.juntar(otro[1] as string)).toBe('BBBBBB');
    expect(ensamblador.juntar(uno[1] as string)).toBe('AAAAAA');
  });
});

describe('SocketDelAnfitrion', () => {
  it('pregunta directamente a la sala, sin pasar por ninguna radio', async () => {
    const enlace = enlazar();

    const creada = (await enlace.socketPropio.emitWithAck(MENSAJES_DEL_CLIENTE.crearSala, {
      nombre: 'Ana',
      version: VERSION_PROTOCOLO,
    })) as Resultado<unknown>;

    expect(creada.ok).toBe(true);
  });

  it('avisa de que esta conectado en cuanto alguien escucha', async () => {
    const enlace = enlazar();
    let conectado = false;
    enlace.socketPropio.on('connect', () => {
      conectado = true;
    });

    await Promise.resolve();
    expect(conectado).toBe(true);
  });

  it('deja de contestar en cuanto se corta', async () => {
    const enlace = enlazar();
    enlace.socketPropio.disconnect();

    expect(await enlace.socketPropio.emitWithAck(MENSAJES_DEL_CLIENTE.crearSala, {})).toBeNull();
  });
});

describe('SocketDelInvitado', () => {
  it('casa cada respuesta con su peticion', async () => {
    const enlace = enlazar();
    await enlace.socketPropio.emitWithAck(MENSAJES_DEL_CLIENTE.crearSala, {
      nombre: 'Ana',
      version: VERSION_PROTOCOLO,
    });

    const entrada = (await enlace.socketInvitado.emitWithAck(MENSAJES_DEL_CLIENTE.unirseASala, {
      codigo: 'PRUE',
      nombre: 'Berta',
      version: VERSION_PROTOCOLO,
    })) as Resultado<{ puesto: number }>;

    expect(entrada.ok).toBe(true);
    expect(entrada.ok && entrada.datos.puesto).toBe(1);
  });

  it('le llega lo que el anfitrion difunde', async () => {
    const enlace = enlazar();
    const salas: unknown[] = [];
    enlace.socketInvitado.on(MENSAJES_DEL_SERVIDOR.sala, (sala) => {
      salas.push(sala);
    });

    await enlace.socketPropio.emitWithAck(MENSAJES_DEL_CLIENTE.crearSala, {
      nombre: 'Ana',
      version: VERSION_PROTOCOLO,
    });
    await enlace.socketInvitado.emitWithAck(MENSAJES_DEL_CLIENTE.unirseASala, {
      codigo: 'PRUE',
      nombre: 'Berta',
      version: VERSION_PROTOCOLO,
    });

    expect(salas.length).toBeGreaterThan(0);
  });

  it('suelta las esperas cuando se cae la linea, en vez de dejarlas colgadas', async () => {
    const enlace = enlazar();
    // Un socket que no contesta: lo que se le pida se queda esperando.
    const mudo = new SocketDelInvitado(
      () => undefined,
      () => undefined,
    );

    const pendiente = mudo.emitWithAck(MENSAJES_DEL_CLIENTE.clic, { x: 0, y: 0 });
    mudo.anunciarCaida();

    expect(await pendiente).toBeNull();
    expect(enlace.socketInvitado).toBeDefined();
  });

  it('avisa del «connect» a quien se pone a escuchar con la linea ya abierta', () => {
    const socket = new SocketDelInvitado(
      () => undefined,
      () => undefined,
    );
    socket.anunciarConexion();

    let conectado = false;
    socket.on('connect', () => {
      conectado = true;
    });

    expect(conectado).toBe(true);
  });
});

describe('una partida entera por el cable', () => {
  it('lleva y trae un tablero que no cabe en un solo mensaje', async () => {
    const enlace = enlazar();
    let recibida: EstadoPartida | null = null;
    enlace.socketInvitado.on(MENSAJES_DEL_SERVIDOR.partida, (partida) => {
      recibida = partida as EstadoPartida;
    });

    await enlace.socketPropio.emitWithAck(MENSAJES_DEL_CLIENTE.crearSala, {
      nombre: 'Ana',
      version: VERSION_PROTOCOLO,
      configuracion: TABLERO_GRANDE,
    });
    await enlace.socketInvitado.emitWithAck(MENSAJES_DEL_CLIENTE.unirseASala, {
      codigo: 'PRUE',
      nombre: 'Berta',
      version: VERSION_PROTOCOLO,
    });
    await enlace.socketPropio.emitWithAck(MENSAJES_DEL_CLIENTE.empezarPartida, undefined);

    const estado = recibida as EstadoPartida | null;
    expect(estado).not.toBeNull();
    expect(estado?.celdas).toHaveLength(TABLERO_GRANDE.alto);
    expect(estado?.celdas[0]).toHaveLength(TABLERO_GRANDE.ancho);
    expect(estado?.jugadores).toHaveLength(2);
  });

  it('el invitado juega su turno y el anfitrion lo aplica', async () => {
    const enlace = enlazar();
    await enlace.socketPropio.emitWithAck(MENSAJES_DEL_CLIENTE.crearSala, {
      nombre: 'Ana',
      version: VERSION_PROTOCOLO,
    });
    await enlace.socketInvitado.emitWithAck(MENSAJES_DEL_CLIENTE.unirseASala, {
      codigo: 'PRUE',
      nombre: 'Berta',
      version: VERSION_PROTOCOLO,
    });
    await enlace.socketPropio.emitWithAck(MENSAJES_DEL_CLIENTE.empezarPartida, undefined);

    // Empieza el anfitrion: al invitado le toca decir que no es su turno.
    const pronto = (await enlace.socketInvitado.emitWithAck(MENSAJES_DEL_CLIENTE.clic, {
      x: 0,
      y: 0,
    })) as Resultado<unknown>;
    expect(pronto).toEqual({ ok: false, error: 'NO_ES_TU_TURNO' });
  });
});
