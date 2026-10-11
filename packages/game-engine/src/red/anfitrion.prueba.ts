import { describe, expect, it } from 'vitest';

import { Anfitrion } from './anfitrion.js';
import type { EstadoPartida } from '../tipos.js';
import {
  MENSAJES_DEL_CLIENTE,
  MENSAJES_DEL_SERVIDOR,
  VERSION_PROTOCOLO,
  type ConfiguracionSala,
  type Entrada,
  type Reentrada,
  type VistaSala,
} from './protocolo.js';
import { Sala } from './sala.js';

/**
 * Tablero pequeno y sin reloj, con el azar clavado en 0: las minas caen
 * siempre en las mismas celdas y la partida sale igual una y otra vez.
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

/** Lo que el anfitrion difundio, en orden, para poder mirarlo luego. */
interface Difundido {
  readonly evento: string;
  readonly datos: unknown;
}

interface Montaje {
  readonly anfitrion: Anfitrion;
  readonly difundido: Difundido[];
  readonly reloj: { ahora: number };
}

function montar(): Montaje {
  const reloj = { ahora: 0 };
  let credenciales = 0;
  const sala = new Sala(
    'PRUE',
    () => reloj.ahora,
    () => 0,
    () => {
      credenciales += 1;
      return `credencial-${String(credenciales)}`;
    },
  );

  const difundido: Difundido[] = [];
  const anfitrion = new Anfitrion(sala, (evento, datos) => {
    difundido.push({ evento, datos });
  });

  return { anfitrion, difundido, reloj };
}

/** Monta la sala y sienta en ella a quien la abrio. */
function abrir(montaje: Montaje, nombre = 'Ana'): Entrada {
  const creada = montaje.anfitrion.pedir('anfitrion', MENSAJES_DEL_CLIENTE.crearSala, {
    nombre,
    version: VERSION_PROTOCOLO,
    configuracion: CONFIGURACION,
  });

  expect(creada.ok).toBe(true);
  if (!creada.ok) {
    throw new Error('no se pudo abrir la sala');
  }
  return creada.datos as Entrada;
}

/** Entra un invitado por su propia conexion. */
function unir(montaje: Montaje, conexion: string, nombre: string): Entrada {
  const unido = montaje.anfitrion.pedir(conexion, MENSAJES_DEL_CLIENTE.unirseASala, {
    codigo: 'PRUE',
    nombre,
    version: VERSION_PROTOCOLO,
  });

  expect(unido.ok).toBe(true);
  if (!unido.ok) {
    throw new Error('no se pudo entrar en la sala');
  }
  return unido.datos as Entrada;
}

/** El ultimo estado de partida difundido, que es el que ve el jugador. */
function ultimaPartida(difundido: readonly Difundido[]): EstadoPartida {
  const partidas = difundido.filter((uno) => uno.evento === MENSAJES_DEL_SERVIDOR.partida);
  const ultima = partidas.at(-1);
  expect(ultima).toBeDefined();
  return ultima?.datos as EstadoPartida;
}

describe('Anfitrion', () => {
  it('sienta de anfitrion a quien abre la partida y le deja los ajustes puestos', () => {
    const montaje = montar();
    const entrada = abrir(montaje);

    expect(entrada.puesto).toBe(0);
    expect(entrada.codigo).toBe('PRUE');
    expect(entrada.version).toBe(VERSION_PROTOCOLO);
    expect(entrada.sala.configuracion.ancho).toBe(CONFIGURACION.ancho);
  });

  it('no monta una segunda sala en el mismo telefono', () => {
    const montaje = montar();
    abrir(montaje);

    const otra = montaje.anfitrion.pedir('otra', MENSAJES_DEL_CLIENTE.crearSala, {
      nombre: 'Berta',
      version: VERSION_PROTOCOLO,
    });

    expect(otra).toEqual({ ok: false, error: 'SALA_EN_JUEGO' });
  });

  it('difunde la sala cuando entra alguien', () => {
    const montaje = montar();
    abrir(montaje);
    montaje.difundido.length = 0;

    const entrada = unir(montaje, 'invitado', 'Berta');

    expect(entrada.puesto).toBe(1);
    const sala = montaje.difundido.find((uno) => uno.evento === MENSAJES_DEL_SERVIDOR.sala);
    expect((sala?.datos as VistaSala).puestos).toHaveLength(2);
  });

  it('deja fuera a quien viene con otra version del protocolo', () => {
    const montaje = montar();
    abrir(montaje);

    const unido = montaje.anfitrion.pedir('invitado', MENSAJES_DEL_CLIENTE.unirseASala, {
      codigo: 'PRUE',
      nombre: 'Berta',
      version: '99.0.0',
    });

    expect(unido).toEqual({ ok: false, error: 'VERSION_INCOMPATIBLE' });
  });

  it('no deja entrar con un codigo que no es el de esta partida', () => {
    const montaje = montar();
    abrir(montaje);

    const unido = montaje.anfitrion.pedir('invitado', MENSAJES_DEL_CLIENTE.unirseASala, {
      codigo: 'OTRA',
      nombre: 'Berta',
      version: VERSION_PROTOCOLO,
    });

    expect(unido).toEqual({ ok: false, error: 'SALA_NO_ENCONTRADA' });
  });

  it('no deja jugar a quien no ha entrado por esa conexion', () => {
    const montaje = montar();
    abrir(montaje);
    unir(montaje, 'invitado', 'Berta');
    montaje.anfitrion.pedir('anfitrion', MENSAJES_DEL_CLIENTE.empezarPartida, undefined);

    const colado = montaje.anfitrion.pedir('desconocida', MENSAJES_DEL_CLIENTE.clic, {
      x: 0,
      y: 0,
    });

    expect(colado).toEqual({ ok: false, error: 'JUGADOR_DESCONOCIDO' });
  });

  it('no se traga una coordenada que no es un numero', () => {
    const montaje = montar();
    abrir(montaje);

    const torcido = montaje.anfitrion.pedir('anfitrion', MENSAJES_DEL_CLIENTE.clic, {
      x: 'dos',
      y: 0,
    });

    expect(torcido).toEqual({ ok: false, error: 'PETICION_INVALIDA' });
  });

  it('rechaza un mensaje que no es del protocolo', () => {
    const montaje = montar();
    abrir(montaje);

    expect(montaje.anfitrion.pedir('anfitrion', 'derriba-el-servidor', {})).toEqual({
      ok: false,
      error: 'PETICION_INVALIDA',
    });
  });

  it('difunde el estado de la partida a cada jugada, y solo al de turno', () => {
    const montaje = montar();
    abrir(montaje);
    unir(montaje, 'invitado', 'Berta');
    montaje.anfitrion.pedir('anfitrion', MENSAJES_DEL_CLIENTE.empezarPartida, undefined);

    const fueraDeTurno = montaje.anfitrion.pedir('invitado', MENSAJES_DEL_CLIENTE.clic, {
      x: 3,
      y: 3,
    });
    expect(fueraDeTurno).toEqual({ ok: false, error: 'NO_ES_TU_TURNO' });

    montaje.difundido.length = 0;
    const jugada = montaje.anfitrion.pedir('anfitrion', MENSAJES_DEL_CLIENTE.clic, { x: 3, y: 3 });

    expect(jugada.ok).toBe(true);
    expect(montaje.difundido.map((uno) => uno.evento)).toContain(MENSAJES_DEL_SERVIDOR.partida);
    expect(montaje.difundido.map((uno) => uno.evento)).toContain(MENSAJES_DEL_SERVIDOR.suceso);
  });

  it('devuelve el puesto a quien vuelve con su credencial desde otra conexion', () => {
    const montaje = montar();
    abrir(montaje);
    const invitado = unir(montaje, 'invitado', 'Berta');
    montaje.anfitrion.pedir('anfitrion', MENSAJES_DEL_CLIENTE.empezarPartida, undefined);

    montaje.anfitrion.desconectar('invitado');
    const vuelta = montaje.anfitrion.pedir('invitado-2', MENSAJES_DEL_CLIENTE.reconectar, {
      codigo: 'PRUE',
      token: invitado.token,
      version: VERSION_PROTOCOLO,
    });

    expect(vuelta.ok).toBe(true);
    if (vuelta.ok) {
      const reentrada = vuelta.datos as Reentrada;
      expect(reentrada.puesto).toBe(invitado.puesto);
      expect(reentrada.partida).not.toBeNull();
    }
  });

  it('difunde la sala cuando alguien se cae', () => {
    const montaje = montar();
    abrir(montaje);
    unir(montaje, 'invitado', 'Berta');
    montaje.difundido.length = 0;

    montaje.anfitrion.desconectar('invitado');

    const sala = montaje.difundido.find((uno) => uno.evento === MENSAJES_DEL_SERVIDOR.sala);
    expect((sala?.datos as VistaSala).puestos).toHaveLength(1);
  });

  it('atender juega por el que se cayo, y lo cuenta', () => {
    const montaje = montar();
    abrir(montaje);
    unir(montaje, 'invitado', 'Berta');
    montaje.anfitrion.pedir('anfitrion', MENSAJES_DEL_CLIENTE.empezarPartida, undefined);

    // Le toca al anfitrion (puesto 0) y se cae. La gracia se cuenta desde el
    // primer repaso que lo ve caido, no desde que se cayo, asi que hacen falta
    // dos: el que arranca la cuenta y el que la encuentra cumplida.
    montaje.anfitrion.desconectar('anfitrion');
    montaje.difundido.length = 0;
    montaje.anfitrion.atender();
    montaje.reloj.ahora += 10_000;
    montaje.anfitrion.atender();

    expect(ultimaPartida(montaje.difundido).jugadores[0]?.estadisticas.clics).toBeGreaterThan(0);
  });

  it('atender no difunde nada mientras no pasa nada', () => {
    const montaje = montar();
    abrir(montaje);
    unir(montaje, 'invitado', 'Berta');
    montaje.anfitrion.pedir('anfitrion', MENSAJES_DEL_CLIENTE.empezarPartida, undefined);
    montaje.difundido.length = 0;

    montaje.anfitrion.atender();

    expect(montaje.difundido).toHaveLength(0);
  });

  it('la lista de salas abiertas es esta sala, y solo mientras espera gente', () => {
    const montaje = montar();
    abrir(montaje);

    const enLobby = montaje.anfitrion.pedir(
      'invitado',
      MENSAJES_DEL_CLIENTE.salasAbiertas,
      undefined,
    );
    expect(enLobby.ok && (enLobby.datos as unknown[]).length).toBe(1);

    unir(montaje, 'invitado', 'Berta');
    montaje.anfitrion.pedir('anfitrion', MENSAJES_DEL_CLIENTE.empezarPartida, undefined);

    const jugando = montaje.anfitrion.pedir(
      'otra',
      MENSAJES_DEL_CLIENTE.salasAbiertas,
      undefined,
    );
    expect(jugando.ok && (jugando.datos as unknown[]).length).toBe(0);
  });
});
