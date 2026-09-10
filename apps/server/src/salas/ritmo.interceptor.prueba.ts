import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';

import { LimitadorDeRitmo } from './limitador.js';
import { InterceptorDeRitmo } from './ritmo.interceptor.js';

/** Lo unico que el interceptor le pide a Nest: de que socket viene esto. */
function contexto(idDelSocket: string): ExecutionContext {
  return {
    switchToWs: () => ({ getClient: () => ({ id: idDelSocket }) }),
  } as unknown as ExecutionContext;
}

function manejador(respuesta: unknown, llamadas: { veces: number }): CallHandler {
  return {
    handle: () => {
      llamadas.veces += 1;
      return of(respuesta);
    },
  };
}

describe('InterceptorDeRitmo', () => {
  it('deja pasar lo que va a ritmo de persona', async () => {
    const llamadas = { veces: 0 };
    const interceptor = new InterceptorDeRitmo(new LimitadorDeRitmo(5, () => 0));

    const respuesta = await firstValueFrom(
      interceptor.intercept(contexto('socket'), manejador({ ok: true, datos: null }, llamadas)),
    );

    expect(respuesta).toEqual({ ok: true, datos: null });
    expect(llamadas.veces).toBe(1);
  });

  /**
   * Se responde por el acuse de recibo como todo lo demas, y **el manejador no
   * llega a ejecutarse**: es justo lo que protege a los que estan en la sala.
   */
  it('a quien se pasa le contesta que no, sin llegar a la sala', async () => {
    const llamadas = { veces: 0 };
    const interceptor = new InterceptorDeRitmo(new LimitadorDeRitmo(1, () => 0));
    const pedir = async (): Promise<unknown> =>
      firstValueFrom(
        interceptor.intercept(contexto('socket'), manejador({ ok: true, datos: null }, llamadas)),
      );

    await pedir();
    const segunda = await pedir();

    expect(segunda).toEqual({ ok: false, error: 'DEMASIADAS_PETICIONES' });
    expect(llamadas.veces).toBe(1);
  });

  it('el tope es de cada conexion', async () => {
    const llamadas = { veces: 0 };
    const interceptor = new InterceptorDeRitmo(new LimitadorDeRitmo(1, () => 0));

    await firstValueFrom(interceptor.intercept(contexto('ana'), manejador(null, llamadas)));
    const deBruno = await firstValueFrom(
      interceptor.intercept(contexto('bruno'), manejador({ ok: true, datos: null }, llamadas)),
    );

    expect(deBruno).toEqual({ ok: true, datos: null });
    expect(llamadas.veces).toBe(2);
  });
});
