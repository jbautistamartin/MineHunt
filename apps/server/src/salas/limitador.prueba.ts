import { LimitadorDeRitmo } from './limitador.js';

describe('LimitadorDeRitmo', () => {
  it('deja pasar mientras no se pase del tope', () => {
    const limitador = new LimitadorDeRitmo(3, () => 0);

    expect(limitador.admite('socket')).toBe(true);
    expect(limitador.admite('socket')).toBe(true);
    expect(limitador.admite('socket')).toBe(true);
    expect(limitador.admite('socket')).toBe(false);
  });

  it('el tope es de cada conexion, no del servidor entero', () => {
    const limitador = new LimitadorDeRitmo(1, () => 0);

    expect(limitador.admite('ana')).toBe(true);
    expect(limitador.admite('bruno')).toBe(true);
    expect(limitador.admite('ana')).toBe(false);
  });

  it('al segundo siguiente se vuelve a poder', () => {
    const reloj = { ahora: 0 };
    const limitador = new LimitadorDeRitmo(2, () => reloj.ahora);

    limitador.admite('socket');
    limitador.admite('socket');
    expect(limitador.admite('socket')).toBe(false);

    reloj.ahora = 1001;
    expect(limitador.admite('socket')).toBe(true);
  });

  /**
   * Lo rechazado no cuenta: si contara, a quien se pasa le bastaria con seguir
   * insistiendo para no salir nunca de la ventana.
   */
  it('insistir no alarga el castigo', () => {
    const reloj = { ahora: 0 };
    const limitador = new LimitadorDeRitmo(1, () => reloj.ahora);

    expect(limitador.admite('socket')).toBe(true);
    for (let intento = 0; intento < 50; intento += 1) {
      reloj.ahora += 10;
      expect(limitador.admite('socket')).toBe(false);
    }

    reloj.ahora = 1001;
    expect(limitador.admite('socket')).toBe(true);
  });

  it('olvidar una conexion le devuelve su cupo entero', () => {
    const limitador = new LimitadorDeRitmo(1, () => 0);

    expect(limitador.admite('socket')).toBe(true);
    expect(limitador.admite('socket')).toBe(false);

    limitador.olvidar('socket');

    expect(limitador.admite('socket')).toBe(true);
  });
});
