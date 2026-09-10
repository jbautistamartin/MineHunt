import { leerConfiguracion, type Configuracion } from '../configuracion.js';
import { ServicioSalas, type Dueno } from './salas.servicio.js';

/** La configuracion de siempre, con los topes que pida cada prueba. */
function configuracion(cambios: Partial<Configuracion> = {}): Configuracion {
  return { ...leerConfiguracion({} as NodeJS.ProcessEnv, () => undefined), ...cambios };
}

function servicio(cambios: Partial<Configuracion> = {}): ServicioSalas {
  return new ServicioSalas(
    () => 0,
    () => 0,
    configuracion(cambios),
  );
}

const ANA: Dueno = { conexion: 'socket-ana', ip: '10.0.0.1' };

describe('ServicioSalas', () => {
  it('abre salas con codigos distintos y las encuentra por su codigo', () => {
    const salas = servicio();

    const primera = salas.crear(ANA);
    const segunda = salas.crear(ANA);

    expect(primera).not.toBeNull();
    expect(segunda).not.toBeNull();
    expect(primera?.codigo).not.toBe(segunda?.codigo);
    expect(salas.buscar(primera?.codigo ?? '')).toBe(primera);
  });

  /** Se teclea a mano, y nadie escribe el codigo en mayusculas. */
  it('busca sin distinguir mayusculas ni espacios', () => {
    const salas = servicio();
    const sala = salas.crear(ANA);

    expect(salas.buscar(` ${(sala?.codigo ?? '').toLowerCase()} `)).toBe(sala);
  });

  describe('topes', () => {
    /**
     * Las salas viven en memoria y abrirlas es gratis: sin tope, una sola
     * pestana se queda con el servidor entero.
     */
    it('una conexion no puede abrir mas salas de las suyas', () => {
      const salas = servicio({ maxSalasPorConexion: 2 });

      expect(salas.crear(ANA)).not.toBeNull();
      expect(salas.crear(ANA)).not.toBeNull();
      expect(salas.crear(ANA)).toBeNull();
    });

    it('cerrar una sala le devuelve el hueco a quien la abrio', () => {
      const salas = servicio({ maxSalasPorConexion: 1 });

      const sala = salas.crear(ANA);
      expect(salas.crear(ANA)).toBeNull();

      salas.eliminar(sala?.codigo ?? '');

      expect(salas.crear(ANA)).not.toBeNull();
    });

    /** Abrir pestanas nuevas es cambiar de conexion, no de sitio. */
    it('cambiar de conexion no salta el tope de la IP', () => {
      const salas = servicio({ maxSalasPorConexion: 1, maxSalasPorIp: 2 });

      expect(salas.crear({ conexion: 'pestana-1', ip: '10.0.0.1' })).not.toBeNull();
      expect(salas.crear({ conexion: 'pestana-2', ip: '10.0.0.1' })).not.toBeNull();
      expect(salas.crear({ conexion: 'pestana-3', ip: '10.0.0.1' })).toBeNull();
    });

    /**
     * Detras del router de una casa salen todos con la misma IP, pero desde
     * otra casa no: el tope de uno no puede dejar fuera al vecino.
     */
    it('el tope de una IP no afecta a otra', () => {
      const salas = servicio({ maxSalasPorIp: 1 });

      expect(salas.crear({ conexion: 'a', ip: '10.0.0.1' })).not.toBeNull();
      expect(salas.crear({ conexion: 'b', ip: '10.0.0.1' })).toBeNull();
      expect(salas.crear({ conexion: 'c', ip: '10.0.0.2' })).not.toBeNull();
    });
  });
});
