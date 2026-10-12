import { compararVersiones, ServicioActualizacion } from './actualizacion.servicio';
import { VERSION_APP } from './version';

/** Una respuesta de GitHub con lo poco que el servicio le pide. */
function releaseDe(etiqueta: string): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      tag_name: etiqueta,
      html_url: `https://github.com/jbautistamartin/MineHunt/releases/tag/${etiqueta}`,
    }),
  } as unknown as Response;
}

/** La respuesta de un repositorio sin releases publicados. */
function sinReleases(): Response {
  return { ok: false, status: 404, json: async () => ({}) } as unknown as Response;
}

describe('Comparacion de versiones', () => {
  /**
   * Es la razon de que esta funcion exista: como texto, «1.10.0» va *antes* que
   * «1.9.0», asi que comparar cadenas dejaria de avisar a partir de la decima.
   */
  it('compara numeros y no texto', () => {
    expect(compararVersiones('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect('1.10.0' < '1.9.0').toBe(true); // la comparacion que NO se hace
  });

  it('la mayor pesa mas que la menor y que el parche', () => {
    expect(compararVersiones('2.0.0', '1.99.99')).toBeGreaterThan(0);
    expect(compararVersiones('1.1.2', '1.1.1')).toBeGreaterThan(0);
  });

  it('da igual la v del tag y lo que cuelgue detras', () => {
    expect(compararVersiones('v1.2.3', '1.2.3')).toBe(0);
    expect(compararVersiones('1.2.3-rc1', '1.2.3')).toBe(0);
    expect(compararVersiones('1.2.3+abc123', '1.2.3')).toBe(0);
  });

  it('rellena con ceros lo que falta', () => {
    expect(compararVersiones('1.2', '1.2.0')).toBe(0);
    expect(compararVersiones('2', '1.9.9')).toBeGreaterThan(0);
  });

  /** Una etiqueta que no se entiende no puede decidir que hay version nueva. */
  it('no compara lo que no es una version', () => {
    expect(compararVersiones('ultima', '0.1.1')).toBeNull();
    expect(compararVersiones('1.2.3.4', '0.1.1')).toBeNull();
    expect(compararVersiones('', '0.1.1')).toBeNull();
  });
});

describe('Aviso de version nueva', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('avisa cuando la publicada es mas nueva que la que se juega', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => releaseDe('v99.0.0')));
    const servicio = new ServicioActualizacion();

    await servicio.comprobar();

    expect(servicio.novedad()?.version).toBe('99.0.0');
    // El enlace deja de ir a la pagina del proyecto y va al release.
    expect(servicio.pagina()).toContain('/releases/tag/v99.0.0');
  });

  it('no avisa de la version que ya se esta jugando', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => releaseDe(`v${VERSION_APP}`)));
    const servicio = new ServicioActualizacion();

    await servicio.comprobar();

    expect(servicio.novedad()).toBeNull();
  });

  it('no avisa de una publicada mas vieja', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => releaseDe('v0.0.1')));
    const servicio = new ServicioActualizacion();

    await servicio.comprobar();

    expect(servicio.novedad()).toBeNull();
  });

  /** Mientras no haya ningun release, la API responde 404. No es una averia. */
  it('se calla si todavia no hay releases publicados', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sinReleases()));
    const servicio = new ServicioActualizacion();

    await servicio.comprobar();

    expect(servicio.novedad()).toBeNull();
    expect(servicio.pagina()).not.toContain('/releases/tag/');
  });

  it('se calla si no hay red', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('sin red'))));
    const servicio = new ServicioActualizacion();

    await servicio.comprobar();

    expect(servicio.novedad()).toBeNull();
  });

  /**
   * El limite de la API sin autenticar son 60 peticiones por hora e IP, asi que
   * abrir el juego diez veces en una tarde no son diez preguntas.
   */
  it('no pregunta dos veces el mismo dia', async () => {
    const red = vi.fn(async () => releaseDe('v99.0.0'));
    vi.stubGlobal('fetch', red);

    await new ServicioActualizacion().comprobar();
    await new ServicioActualizacion().comprobar();

    expect(red).toHaveBeenCalledTimes(1);
  });

  /**
   * Lo que se encontro no se olvida al cerrar el juego: dentro del mismo dia no se vuelve a
   * preguntar, y sin esto el punto del menu desaparecia en la segunda apertura.
   */
  it('recuerda la version encontrada al volver a abrir', async () => {
    const red = vi.fn(async () => releaseDe('v99.0.0'));
    vi.stubGlobal('fetch', red);

    await new ServicioActualizacion().comprobar();
    const alVolverAAbrir = new ServicioActualizacion();

    expect(alVolverAAbrir.novedad()?.version).toBe('99.0.0');
    expect(alVolverAAbrir.pagina()).toContain('/releases/tag/v99.0.0');
    // Y sin volver a preguntar: lo recordado basta.
    await alVolverAAbrir.comprobar();
    expect(red).toHaveBeenCalledTimes(1);
  });

  /** En cuanto se juega la version de la que se avisaba, el aviso se va con ella. */
  it('olvida el aviso cuando la publicada ya es la que se juega', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => releaseDe('v99.0.0')));
    const servicio = new ServicioActualizacion();
    await servicio.comprobar();
    expect(servicio.novedad()).not.toBeNull();

    // Ahora el ultimo release es el que esta instalado.
    vi.stubGlobal('fetch', vi.fn(async () => releaseDe(`v${VERSION_APP}`)));
    await servicio.comprobar(true);

    expect(servicio.novedad()).toBeNull();
    expect(new ServicioActualizacion().novedad()).toBeNull();
  });

  /** Sin red no se pierde lo que ya se sabia: se apunta el intento y se deja el aviso. */
  it('un fallo de red no borra el aviso que ya habia', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => releaseDe('v99.0.0')));
    const servicio = new ServicioActualizacion();
    await servicio.comprobar();

    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('sin red'))));
    await servicio.comprobar(true);

    expect(servicio.novedad()?.version).toBe('99.0.0');
  });

  it('pero pregunta igual si se le insiste a mano', async () => {
    const red = vi.fn(async () => releaseDe('v99.0.0'));
    vi.stubGlobal('fetch', red);

    const servicio = new ServicioActualizacion();
    await servicio.comprobar();
    await servicio.comprobar(true);

    expect(red).toHaveBeenCalledTimes(2);
  });
});
