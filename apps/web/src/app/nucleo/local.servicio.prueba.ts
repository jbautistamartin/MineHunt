import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MENSAJES_DEL_CLIENTE, VERSION_PROTOCOLO } from '@minehunt/game-engine';

import {
  RADIO_CERCANA,
  type EstadoPermisos,
  type RadioCercana,
  type SucesoCercano,
} from './cercanos.plugin';
import { ServicioLocal } from './local.servicio';
import { ServicioOnline } from './online.servicio';
import { partir } from './transporte-local';

/**
 * Una radio de mentira.
 *
 * Nearby necesita radios de verdad y no hay emulador que las levante, asi que
 * esta es la unica forma de probar lo que pasa cuando llega un invitado sin
 * tener dos telefonos en la mano. Guarda lo que se le manda y deja empujar
 * hacia dentro lo que el aparato diria.
 */
class RadioFalsa implements RadioCercana {
  disponible = true;
  concedidos = true;
  vecesQuePidioPermiso = 0;
  anunciadoComo: string | null = null;
  buscando = false;
  parada = false;
  conectadoA: string | null = null;
  readonly enviados: { ids: readonly string[]; texto: string }[] = [];

  private escucha: ((suceso: SucesoCercano) => void) | null = null;

  comprobarPermisos(): Promise<EstadoPermisos> {
    return Promise.resolve(this.informe());
  }

  pedirPermisos(): Promise<EstadoPermisos> {
    this.vecesQuePidioPermiso += 1;
    return Promise.resolve(this.informe());
  }

  anunciar(nombre: string): Promise<void> {
    this.anunciadoComo = nombre;
    return Promise.resolve();
  }

  buscar(): Promise<void> {
    this.buscando = true;
    return Promise.resolve();
  }

  dejarDeBuscar(): Promise<void> {
    this.buscando = false;
    return Promise.resolve();
  }

  conectar(id: string): Promise<void> {
    this.conectadoA = id;
    return Promise.resolve();
  }

  enviar(ids: readonly string[], texto: string): Promise<void> {
    this.enviados.push({ ids, texto });
    return Promise.resolve();
  }

  parar(): Promise<void> {
    this.parada = true;
    this.anunciadoComo = null;
    this.buscando = false;
    return Promise.resolve();
  }

  escuchar(escucha: (suceso: SucesoCercano) => void): Promise<() => void> {
    this.escucha = escucha;
    return Promise.resolve(() => {
      this.escucha = null;
    });
  }

  /** Lo que diria el aparato: se empuja desde la prueba. */
  soltar(suceso: SucesoCercano): void {
    this.escucha?.(suceso);
  }

  private informe(): EstadoPermisos {
    return { concedidos: this.concedidos, faltan: this.concedidos ? [] : ['bluetooth'] };
  }
}

describe('ServicioLocal', () => {
  let radio: RadioFalsa;
  let local: ServicioLocal;
  let online: ServicioOnline;

  beforeEach(() => {
    localStorage.clear();
    radio = new RadioFalsa();

    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), { provide: RADIO_CERCANA, useValue: radio }],
    });

    local = TestBed.inject(ServicioLocal);
    online = TestBed.inject(ServicioOnline);
  });

  afterEach(async () => {
    // La sala del anfitrion lleva un latido: sin cerrar queda un temporizador
    // vivo entre pruebas.
    await local.cerrar();
  });

  it('pide el permiso solo cuando falta', async () => {
    expect(await local.asegurarPermisos()).toBe(true);
    expect(radio.vecesQuePidioPermiso).toBe(0);
    expect(local.permisos()).toBe('concedidos');
  });

  it('se queda en denegados si el jugador dice que no', async () => {
    radio.concedidos = false;

    expect(await local.asegurarPermisos()).toBe(false);
    expect(radio.vecesQuePidioPermiso).toBe(1);
    expect(local.permisos()).toBe('denegados');
  });

  it('al abrir la pantalla mira el permiso pero no lo pide', async () => {
    radio.concedidos = false;

    expect(await local.comprobarPermisos()).toBe(false);

    expect(radio.vecesQuePidioPermiso).toBe(0);
    // Sigue en «sin-pedir»: no se ha denegado nada, es que no se ha preguntado.
    expect(local.permisos()).toBe('sin-pedir');
  });

  it('sin permiso no enciende la radio a buscar', async () => {
    radio.concedidos = false;

    await local.buscar();

    expect(radio.buscando).toBe(false);
    expect(local.buscando()).toBe(false);
  });

  it('deja de barrer la radio en cuanto se monta una partida propia', async () => {
    await local.buscar();
    expect(radio.buscando).toBe(true);

    await local.abrir('Ana', {});

    expect(radio.buscando).toBe(false);
    expect(radio.anunciadoComo).toBe('Ana');
  });

  it('publica las partidas que la radio va encontrando, y las quita al perderlas', async () => {
    await local.buscar();

    radio.soltar({ tipo: 'encontrada', id: 'uno', nombre: 'Ana' });
    radio.soltar({ tipo: 'encontrada', id: 'dos', nombre: 'Berta' });
    expect(local.cercanas().map((una) => una.nombre)).toEqual(['Ana', 'Berta']);

    radio.soltar({ tipo: 'perdida', id: 'uno' });
    expect(local.cercanas().map((una) => una.nombre)).toEqual(['Berta']);
  });

  it('no repite una partida que la radio encuentra dos veces', async () => {
    await local.buscar();

    radio.soltar({ tipo: 'encontrada', id: 'uno', nombre: 'Ana' });
    radio.soltar({ tipo: 'encontrada', id: 'uno', nombre: 'Ana' });

    expect(local.cercanas()).toHaveLength(1);
  });

  it('abrir anuncia la partida y sienta de anfitrion a quien la abrio', async () => {
    const abierta = await local.abrir('Ana', { ancho: 8, alto: 8, minas: 10 });

    expect(abierta).toBe(true);
    expect(radio.anunciadoComo).toBe('Ana');
    expect(local.anunciando()).toBe(true);
    expect(online.sala()?.puestos).toHaveLength(1);
    expect(online.sala()?.puestos[0]?.nombre).toBe('Ana');
    expect(online.puesto()).toBe(0);
  });

  it('un invitado que llega por la radio entra en la sala y recibe respuesta', async () => {
    await local.abrir('Ana', {});
    const codigo = online.sala()?.codigo ?? '';
    radio.enviados.length = 0;

    radio.soltar({ tipo: 'conectada', id: 'inv', nombre: 'Berta' });
    for (const trozo of partir(
      JSON.stringify({
        t: 'p',
        id: 1,
        m: MENSAJES_DEL_CLIENTE.unirseASala,
        d: { codigo, nombre: 'Berta', version: VERSION_PROTOCOLO },
      }),
    )) {
      radio.soltar({ tipo: 'mensaje', id: 'inv', texto: trozo });
    }

    expect(online.sala()?.puestos).toHaveLength(2);
    expect(online.sala()?.puestos[1]?.nombre).toBe('Berta');
    // Le vuelve la respuesta a su peticion, y ademas la difusion de la sala.
    expect(radio.enviados.length).toBeGreaterThan(0);
    expect(radio.enviados.every((uno) => uno.ids.includes('inv'))).toBe(true);
  });

  it('cuando un invitado se cae, su puesto se va de la sala del lobby', async () => {
    await local.abrir('Ana', {});
    const codigo = online.sala()?.codigo ?? '';

    radio.soltar({ tipo: 'conectada', id: 'inv', nombre: 'Berta' });
    for (const trozo of partir(
      JSON.stringify({
        t: 'p',
        id: 1,
        m: MENSAJES_DEL_CLIENTE.unirseASala,
        d: { codigo, nombre: 'Berta', version: VERSION_PROTOCOLO },
      }),
    )) {
      radio.soltar({ tipo: 'mensaje', id: 'inv', texto: trozo });
    }
    expect(online.sala()?.puestos).toHaveLength(2);

    radio.soltar({ tipo: 'desconectada', id: 'inv' });

    expect(online.sala()?.puestos).toHaveLength(1);
  });

  it('no se traga un mensaje que no es del protocolo', async () => {
    await local.abrir('Ana', {});
    radio.enviados.length = 0;

    radio.soltar({ tipo: 'conectada', id: 'inv', nombre: 'Berta' });
    radio.soltar({ tipo: 'mensaje', id: 'inv', texto: 'esto no es un sobre' });

    expect(radio.enviados).toHaveLength(0);
    expect(online.sala()?.puestos).toHaveLength(1);
  });

  it('cerrar apaga la radio y devuelve el transporte de siempre', async () => {
    await local.abrir('Ana', {});

    await local.cerrar();

    expect(radio.parada).toBe(true);
    expect(local.anunciando()).toBe(false);
    expect(local.cercanas()).toHaveLength(0);
  });

  it('guarda lo que la radio dice que no pudo hacer', async () => {
    await local.buscar();

    radio.soltar({ tipo: 'fallo', motivo: 'CONEXION_FALLIDA' });

    expect(local.fallo()).toBe('CONEXION_FALLIDA');
  });
});
