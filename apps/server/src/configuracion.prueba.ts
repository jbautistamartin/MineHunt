import { leerConfiguracion } from './configuracion.js';

/** Sin entorno ninguno: lo que se usa en el portatil de casa. */
function vacio(): NodeJS.ProcessEnv {
  return {} as NodeJS.ProcessEnv;
}

describe('leerConfiguracion', () => {
  it('sin nada puesto, arranca con los valores por defecto', () => {
    const configuracion = leerConfiguracion(vacio(), () => undefined);

    expect(configuracion.puerto).toBe(3000);
    expect(configuracion.maxSalasPorIp).toBe(4);
    expect(configuracion.maxSalasPorConexion).toBe(2);
    expect(configuracion.maxMensajesPorSegundo).toBe(20);
    expect(configuracion.confiarEnProxy).toBe(false);
    expect(configuracion.enProduccion).toBe(false);
  });

  it('lo que se pone por entorno manda', () => {
    const configuracion = leerConfiguracion(
      {
        PORT: '8080',
        MAX_SALAS_POR_IP: '10',
        MAX_SALAS_POR_CONEXION: '3',
        MAX_MENSAJES_POR_SEGUNDO: '50',
        CONFIAR_EN_PROXY: 'si',
      } as NodeJS.ProcessEnv,
      () => undefined,
    );

    expect(configuracion.puerto).toBe(8080);
    expect(configuracion.maxSalasPorIp).toBe(10);
    expect(configuracion.maxSalasPorConexion).toBe(3);
    expect(configuracion.maxMensajesPorSegundo).toBe(50);
    expect(configuracion.confiarEnProxy).toBe(true);
  });

  /**
   * Un tope que no es un numero es un tope que alguien creia haber puesto: se
   * usa el de por defecto, pero se dice en voz alta.
   */
  it('un valor que no vale se sustituye por el de por defecto, avisando', () => {
    const avisos: string[] = [];
    const configuracion = leerConfiguracion(
      { MAX_SALAS_POR_IP: 'muchas', PORT: '-1' } as NodeJS.ProcessEnv,
      (mensaje) => avisos.push(mensaje),
    );

    expect(configuracion.maxSalasPorIp).toBe(4);
    expect(configuracion.puerto).toBe(3000);
    expect(avisos).toHaveLength(2);
    expect(avisos.join(' ')).toContain('MAX_SALAS_POR_IP');
    expect(avisos.join(' ')).toContain('PORT');
  });

  /** Cero seria «sin tope», y eso no se pone sin querer. */
  it('un tope en cero no se acepta', () => {
    const configuracion = leerConfiguracion(
      { MAX_MENSAJES_POR_SEGUNDO: '0' } as NodeJS.ProcessEnv,
      () => undefined,
    );

    expect(configuracion.maxMensajesPorSegundo).toBe(20);
  });

  describe('origenes permitidos', () => {
    it('sin la variable se deja pasar a cualquiera, que es lo comodo en casa', () => {
      expect(leerConfiguracion(vacio(), () => undefined).origenes).toBeNull();
    });

    it('se parten por comas y se limpian los espacios', () => {
      const configuracion = leerConfiguracion(
        { ORIGENES_PERMITIDOS: 'https://minehunt.example , http://localhost:4200' } as NodeJS.ProcessEnv,
        () => undefined,
      );

      expect(configuracion.origenes).toEqual([
        'https://minehunt.example',
        'http://localhost:4200',
      ]);
    });

    /**
     * En produccion el comodin es justo lo que esta fase viene a quitar, asi
     * que se puede seguir arrancando pero no en silencio.
     */
    it('en produccion sin origenes se avisa a gritos', () => {
      const avisos: string[] = [];
      const configuracion = leerConfiguracion(
        { NODE_ENV: 'production' } as NodeJS.ProcessEnv,
        (mensaje) => avisos.push(mensaje),
      );

      expect(configuracion.origenes).toBeNull();
      expect(configuracion.enProduccion).toBe(true);
      expect(avisos.join(' ')).toContain('ORIGENES_PERMITIDOS');
    });
  });
});
