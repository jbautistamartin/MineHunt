import type { ConfiguracionSala } from '@minehunt/game-engine';

import { Sala } from './sala.js';

/**
 * Tablero pequeno y sin reloj para las pruebas que no van del reloj.
 *
 * Con el azar clavado en 0 las minas caen siempre en las primeras celdas
 * libres, asi que las partidas salen iguales una y otra vez.
 */
const CONFIGURACION: ConfiguracionSala = {
  ancho: 4,
  alto: 4,
  minas: 3,
  tiempoPorTurnoSegundos: 0,
  recargaOndaSegundos: 30,
  publica: true,
  nivelesIA: [],
};

/** Sala con reloj y azar de mentira, que es como se puede probar. */
function crearSala(reloj = { ahora: 0 }): Sala {
  return new Sala(
    'PRUE',
    () => reloj.ahora,
    () => 0,
  );
}

/** Mete a varios jugadores y devuelve sus credenciales, en orden de puesto. */
function sentar(sala: Sala, cuantos: number): string[] {
  const tokens: string[] = [];
  for (let numero = 1; numero <= cuantos; numero += 1) {
    const unido = sala.unirse(`Jugador ${numero}`);
    expect(unido.ok).toBe(true);
    if (unido.ok) {
      tokens.push(sala.tokenDe(unido.datos) ?? '');
    }
  }
  return tokens;
}

/** Sala con la partida ya en marcha y las credenciales de quienes juegan. */
function salaJugando(cuantos = 2, reloj = { ahora: 0 }): { sala: Sala; tokens: string[] } {
  const sala = crearSala(reloj);
  const tokens = sentar(sala, cuantos);
  expect(sala.configurar(tokens[0] ?? '', CONFIGURACION).ok).toBe(true);
  expect(sala.empezar(tokens[0] ?? '').ok).toBe(true);
  return { sala, tokens };
}

describe('Sala: lobby', () => {
  it('el primero en entrar es el anfitrion', () => {
    const sala = crearSala();
    sentar(sala, 2);

    const vista = sala.vista();
    expect(vista.estado).toBe('lobby');
    expect(vista.puestos[0]?.anfitrion).toBe(true);
    expect(vista.puestos[1]?.anfitrion).toBe(false);
  });

  it('no admite mas de cuatro jugadores', () => {
    const sala = crearSala();
    sentar(sala, 4);

    expect(sala.unirse('El quinto')).toEqual({ ok: false, error: 'SALA_LLENA' });
  });

  it('rechaza un nombre vacio o demasiado largo', () => {
    const sala = crearSala();

    expect(sala.unirse('   ')).toEqual({ ok: false, error: 'NOMBRE_INVALIDO' });
    expect(sala.unirse('x'.repeat(17))).toEqual({ ok: false, error: 'NOMBRE_INVALIDO' });
  });

  it('solo el anfitrion configura y empieza', () => {
    const sala = crearSala();
    const [anfitrion, invitado] = sentar(sala, 2);

    expect(sala.configurar(invitado ?? '', CONFIGURACION)).toEqual({
      ok: false,
      error: 'NO_ES_EL_ANFITRION',
    });
    expect(sala.empezar(invitado ?? '')).toEqual({ ok: false, error: 'NO_ES_EL_ANFITRION' });
    expect(sala.empezar(anfitrion ?? '').ok).toBe(true);
  });

  it('no empieza con un solo jugador', () => {
    const sala = crearSala();
    const [anfitrion] = sentar(sala, 1);

    expect(sala.empezar(anfitrion ?? '')).toEqual({ ok: false, error: 'FALTAN_JUGADORES' });
  });

  it('rechaza una configuracion que no da un tablero jugable', () => {
    const sala = crearSala();
    const [anfitrion] = sentar(sala, 2);

    // Mas minas que celdas menos una: la primera que se clica no puede tenerla.
    expect(sala.configurar(anfitrion ?? '', { ancho: 4, alto: 4, minas: 16 })).toEqual({
      ok: false,
      error: 'CONFIGURACION_INVALIDA',
    });
    expect(sala.configurar(anfitrion ?? '', { ancho: 2 })).toEqual({
      ok: false,
      error: 'CONFIGURACION_INVALIDA',
    });
  });

  it('con la partida empezada ya no entra nadie', () => {
    const { sala } = salaJugando();

    expect(sala.unirse('Tarde')).toEqual({ ok: false, error: 'SALA_EN_JUEGO' });
  });

  /**
   * En el lobby los puestos tienen que quedar correlativos: son los ids con
   * los que se creara la partida en el motor.
   */
  it('quien se va del lobby deja su puesto a los de detras', () => {
    const sala = crearSala();
    const [anfitrion, segundo, tercero] = sentar(sala, 3);
    expect(anfitrion).toBeDefined();

    sala.desconectar(segundo ?? '');

    expect(sala.vista().puestos.map((puesto) => puesto.nombre)).toEqual([
      'Jugador 1',
      'Jugador 3',
    ]);
    // El tercero sigue siendo el mismo jugador, ahora en el puesto 1.
    expect(sala.reconectar(tercero ?? '')).toEqual({ ok: true, datos: 1 });
  });
});

describe('Sala: bots en la mesa', () => {
  it('el anfitrion sienta bots y cuentan como jugadores', () => {
    const sala = crearSala();
    const [anfitrion] = sentar(sala, 1);

    expect(sala.configurar(anfitrion ?? '', { ...CONFIGURACION, nivelesIA: [3, 5] }).ok).toBe(
      true,
    );

    const puestos = sala.vista().puestos;
    expect(puestos).toHaveLength(3);
    expect(puestos[0]?.bot).toBe(false);
    expect(puestos[1]).toMatchObject({ bot: true, nivel: 3 });
    expect(puestos[2]).toMatchObject({ bot: true, nivel: 5 });
    // Con un humano y dos bots ya hay partida.
    expect(sala.empezar(anfitrion ?? '').ok).toBe(true);
  });

  /** Los ids del motor tienen que ser correlativos y los humanos van delante. */
  it('quien entra se sienta delante de los bots', () => {
    const sala = crearSala();
    const [anfitrion] = sentar(sala, 1);
    sala.configurar(anfitrion ?? '', { ...CONFIGURACION, nivelesIA: [3] });

    const unido = sala.unirse('Bruno');

    expect(unido).toEqual({ ok: true, datos: 1 });
    expect(sala.vista().puestos.map((puesto) => puesto.bot)).toEqual([false, false, true]);
  });

  it('no caben mas de cuatro entre humanos y bots', () => {
    const sala = crearSala();
    const [anfitrion] = sentar(sala, 2);

    expect(sala.configurar(anfitrion ?? '', { ...CONFIGURACION, nivelesIA: [3, 3, 3] })).toEqual({
      ok: false,
      error: 'SALA_LLENA',
    });
  });

  it('rechaza un nivel de bot que no existe', () => {
    const sala = crearSala();
    const [anfitrion] = sentar(sala, 1);

    expect(
      sala.configurar(anfitrion ?? '', {
        ...CONFIGURACION,
        nivelesIA: [9 as unknown as 5],
      }),
    ).toEqual({ ok: false, error: 'CONFIGURACION_INVALIDA' });
  });

  it('el bot juega su turno sin que nadie se lo pida', () => {
    const reloj = { ahora: 0 };
    const sala = crearSala(reloj);
    const [anfitrion] = sentar(sala, 1);
    sala.configurar(anfitrion ?? '', { ...CONFIGURACION, nivelesIA: [3] });
    sala.empezar(anfitrion ?? '');
    sala.clic(anfitrion ?? '', 3, 3); // cede el turno al bot

    // Lleva su ritmo: no juega en el mismo instante.
    expect(sala.atender()).toEqual([]);

    reloj.ahora = 1000;
    const sucesos = sala.atender();

    expect(sucesos).toHaveLength(1);
    expect(sucesos[0]?.jugador).toBe(1);
  });

  it('una sala de un humano y bots no esta vacia cuando el humano esta', () => {
    const sala = crearSala();
    const [anfitrion] = sentar(sala, 1);
    sala.configurar(anfitrion ?? '', { ...CONFIGURACION, nivelesIA: [3] });

    expect(sala.vacia).toBe(false);

    sala.desconectar(anfitrion ?? '');
    // Con la partida sin empezar el humano se va del todo y solo quedan bots.
    expect(sala.vacia).toBe(true);
  });
});

describe('Sala: la lista de salas abiertas', () => {
  it('una sala esperando gente sale con quien la abrio y cuantos hay', () => {
    const sala = crearSala();
    sentar(sala, 2);

    expect(sala.resumen()).toEqual({
      codigo: 'PRUE',
      anfitrion: 'Jugador 1',
      jugadores: 2,
      maximo: 4,
      bots: 0,
    });
  });

  /** Privada no es cerrada: se entra con el codigo, pero no se anuncia. */
  it('una sala privada no sale en la lista', () => {
    const sala = crearSala();
    const [anfitrion] = sentar(sala, 2);

    sala.configurar(anfitrion ?? '', { ...CONFIGURACION, publica: false });

    expect(sala.resumen()).toBeNull();
  });

  /** Mandar a alguien a una sala donde no puede entrar es peor que no verla. */
  it('no sale si esta llena, jugando o sin nadie dentro', () => {
    const llena = crearSala();
    sentar(llena, 4);
    expect(llena.resumen()).toBeNull();

    const { sala: jugando } = salaJugando();
    expect(jugando.resumen()).toBeNull();

    const vacia = crearSala();
    const tokens = sentar(vacia, 2);
    for (const token of tokens) {
      vacia.desconectar(token);
    }
    expect(vacia.resumen()).toBeNull();
  });
});

describe('Sala: el informe del panel', () => {
  it('cuenta quien la abrio, como va y cuanto lleva abierta', () => {
    const reloj = { ahora: 1000 };
    const sala = crearSala(reloj);
    sentar(sala, 2);
    reloj.ahora = 61_000;

    const informe = sala.informe();

    expect(informe.codigo).toBe('PRUE');
    expect(informe.anfitrion).toBe('Jugador 1');
    expect(informe.estado).toBe('lobby');
    expect(informe.jugadores).toBe(2);
    expect(informe.conectados).toBe(2);
    expect(informe.abiertaHaceMs).toBe(60_000);
  });

  /** Lo que `resumen()` esconde a los jugadores, el panel si lo ensena. */
  it('sale tambien si es privada o si ya esta jugando', () => {
    const { sala, tokens } = salaJugando();
    expect(sala.configurar(tokens[0] ?? '', { publica: false }).ok).toBe(false);

    const informe = sala.informe();

    expect(sala.resumen()).toBeNull();
    expect(informe.estado).toBe('jugando');
    expect(informe.codigo).toBe('PRUE');
  });

  it('separa los bots de las personas, y a estas de las que se cayeron', () => {
    const sala = crearSala();
    const tokens = sentar(sala, 2);
    expect(sala.configurar(tokens[0] ?? '', { ...CONFIGURACION, nivelesIA: [2] }).ok).toBe(true);
    expect(sala.empezar(tokens[0] ?? '').ok).toBe(true);
    sala.desconectar(tokens[1] ?? '');

    const informe = sala.informe();

    expect(informe.jugadores).toBe(3);
    expect(informe.bots).toBe(1);
    expect(informe.conectados).toBe(1);
  });
});

describe('Sala: partida', () => {
  it('el clic solo lo admite de quien tiene el turno', () => {
    const { sala, tokens } = salaJugando();
    const deOtro = sala.estadoDePartida()?.turnoDe === 0 ? tokens[1] : tokens[0];

    expect(sala.clic(deOtro ?? '', 0, 0)).toEqual({ ok: false, error: 'NO_ES_TU_TURNO' });
  });

  it('un clic sin mina cede el turno', () => {
    const { sala, tokens } = salaJugando();

    // El primer clic nunca es mina: las minas se reparten excluyendo esa celda.
    const jugada = sala.clic(tokens[0] ?? '', 3, 3);

    expect(jugada).toEqual({
      ok: true,
      datos: { codigo: 'CELDA_DESPEJADA', jugador: 0, celdas: 1 },
    });
    expect(sala.estadoDePartida()?.turnoDe).toBe(1);
  });

  it('quien encuentra mina puntua y sigue jugando', () => {
    const { sala, tokens } = salaJugando();
    // Con el azar a 0 y el primer clic en la ultima celda, las minas caen en
    // las tres primeras del tablero.
    sala.clic(tokens[0] ?? '', 3, 3);

    const jugada = sala.clic(tokens[1] ?? '', 0, 0);

    expect(jugada).toEqual({
      ok: true,
      datos: { codigo: 'MINA_ENCONTRADA', jugador: 1, celdas: 1 },
    });
    expect(sala.estadoDePartida()?.turnoDe).toBe(1);
  });

  it('desde el lobby no se puede jugar', () => {
    const sala = crearSala();
    const [anfitrion] = sentar(sala, 2);

    expect(sala.clic(anfitrion ?? '', 0, 0)).toEqual({ ok: false, error: 'SALA_EN_LOBBY' });
  });

  it('no juega quien no esta en la sala', () => {
    const { sala } = salaJugando();

    expect(sala.clic('credencial inventada', 0, 0)).toEqual({
      ok: false,
      error: 'JUGADOR_DESCONOCIDO',
    });
  });

  it('rendirse deja al otro solo y acaba la partida', () => {
    const { sala, tokens } = salaJugando();

    const rendicion = sala.rendirse(tokens[0] ?? '');

    expect(rendicion).toEqual({
      ok: true,
      datos: { codigo: 'JUGADOR_RENDIDO', jugador: 0, celdas: 0 },
    });
    expect(sala.estado).toBe('terminada');
    expect(sala.estadoDePartida()?.ganador).toBe(1);
  });
});

describe('Sala: la revancha', () => {
  it('terminada la partida, el anfitrion devuelve la sala al lobby', () => {
    const { sala, tokens } = salaJugando();
    sala.rendirse(tokens[0] ?? '');
    expect(sala.estado).toBe('terminada');

    expect(sala.volverAlLobby(tokens[0] ?? '')).toEqual({ ok: true, datos: null });

    expect(sala.estado).toBe('lobby');
    expect(sala.estadoDePartida()).toBeNull();
    expect(sala.vista().puestos).toHaveLength(2);
    // Y se puede jugar otra con los mismos.
    expect(sala.empezar(tokens[0] ?? '').ok).toBe(true);
  });

  it('con la partida en marcha no se vuelve al lobby', () => {
    const { sala, tokens } = salaJugando();

    expect(sala.volverAlLobby(tokens[0] ?? '')).toEqual({ ok: false, error: 'SALA_EN_JUEGO' });
  });

  /**
   * Si se quedaran, la partida siguiente empezaria con puestos fantasma a los
   * que un bot juega desde el primer turno.
   */
  it('los que no volvieron se quedan fuera de la siguiente', () => {
    const { sala, tokens } = salaJugando(3);
    sala.desconectar(tokens[2] ?? '');
    sala.rendirse(tokens[0] ?? '');
    sala.rendirse(tokens[1] ?? '');

    expect(sala.volverAlLobby(tokens[0] ?? '').ok).toBe(true);

    expect(sala.vista().puestos.map((puesto) => puesto.nombre)).toEqual([
      'Jugador 1',
      'Jugador 2',
    ]);
  });

  /** Si no, la sala se queda muerta con gente dentro esperando. */
  it('si el anfitrion no volvio, la pide cualquiera', () => {
    const { sala, tokens } = salaJugando();
    sala.rendirse(tokens[0] ?? '');
    sala.desconectar(tokens[0] ?? '');

    expect(sala.volverAlLobby(tokens[1] ?? '').ok).toBe(true);
    expect(sala.vista().puestos.map((puesto) => puesto.nombre)).toEqual(['Jugador 2']);
  });

  it('con el anfitrion dentro, otro no la pide', () => {
    const { sala, tokens } = salaJugando();
    sala.rendirse(tokens[0] ?? '');

    expect(sala.volverAlLobby(tokens[1] ?? '')).toEqual({
      ok: false,
      error: 'NO_ES_EL_ANFITRION',
    });
  });
});

describe('Sala: reloj de turno', () => {
  it('pierde el turno quien se queda pensando', () => {
    const reloj = { ahora: 0 };
    const sala = crearSala(reloj);
    const tokens = sentar(sala, 2);
    sala.configurar(tokens[0] ?? '', { ...CONFIGURACION, tiempoPorTurnoSegundos: 10 });
    sala.empezar(tokens[0] ?? '');

    expect(sala.atender()).toEqual([]);

    reloj.ahora = 10_001;

    expect(sala.atender()).toEqual([{ codigo: 'TURNO_PERDIDO', jugador: 0, celdas: 0 }]);
    expect(sala.estadoDePartida()?.turnoDe).toBe(1);
  });
});

describe('Sala: caidas y vuelta', () => {
  it('con la partida en marcha el puesto se guarda y se recupera', () => {
    const { sala, tokens } = salaJugando();

    sala.desconectar(tokens[1] ?? '');

    expect(sala.vista().puestos[1]?.conectado).toBe(false);
    expect(sala.vista().puestos).toHaveLength(2);
    expect(sala.reconectar(tokens[1] ?? '')).toEqual({ ok: true, datos: 1 });
    expect(sala.vista().puestos[1]?.conectado).toBe(true);
  });

  it('un bot juega por el ausente cuando le toca, pero no de inmediato', () => {
    const reloj = { ahora: 0 };
    const { sala, tokens } = salaJugando(2, reloj);
    sala.clic(tokens[0] ?? '', 3, 3); // cede el turno al segundo
    sala.desconectar(tokens[1] ?? '');

    // Se le espera un poco por si vuelve de un parpadeo de la conexion.
    expect(sala.atender()).toEqual([]);
    expect(sala.vista().puestos[1]?.sustituido).toBe(false);

    reloj.ahora = 3001;
    const sucesos = sala.atender();

    expect(sucesos).toHaveLength(1);
    expect(sucesos[0]?.jugador).toBe(1);
    expect(sala.vista().puestos[1]?.sustituido).toBe(true);
  });

  it('al volver, el jugador recupera el mando y el bot se retira', () => {
    const reloj = { ahora: 0 };
    const { sala, tokens } = salaJugando(2, reloj);
    sala.clic(tokens[0] ?? '', 3, 3);
    sala.desconectar(tokens[1] ?? '');
    reloj.ahora = 3001;
    sala.atender();

    sala.reconectar(tokens[1] ?? '');
    reloj.ahora = 9000;

    expect(sala.vista().puestos[1]?.sustituido).toBe(false);
    // Ya no juega nadie por el: la partida espera a que juegue el.
    expect(sala.atender()).toEqual([]);
  });

  it('una sala sin nadie conectado se queda vacia', () => {
    const { sala, tokens } = salaJugando();

    expect(sala.vacia).toBe(false);
    for (const token of tokens) {
      sala.desconectar(token);
    }
    expect(sala.vacia).toBe(true);
  });
});
