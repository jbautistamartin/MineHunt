import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { Socket } from 'socket.io';
import { of, type Observable } from 'rxjs';

import type { Resultado } from '@minehunt/game-engine';

import { LimitadorDeRitmo } from './limitador.js';

/**
 * Corta a quien manda mensajes mas deprisa de lo que se puede jugar.
 *
 * Va de interceptor y no repartido por los manejadores por una razon de peso:
 * son once mensajes, y el que se anadiera manana se quedaria sin limite sin
 * que nadie lo notara —jugando no se toca este techo, asi que el fallo no
 * saldria hasta que alguien lo buscara a proposito—. Puesto aqui, cubre todo
 * lo que entra por la pasarela y lo que entre despues.
 *
 * **Responde por el acuse de recibo, como todos los demas**: `{ ok: false,
 * error }`, y no con una excepcion de WebSocket. Quien pregunta se entera de
 * que le han dicho que no de la misma manera que se entera de todo lo demas, y
 * el cliente no necesita un camino aparte para este caso.
 */
@Injectable()
export class InterceptorDeRitmo implements NestInterceptor {
  constructor(private readonly limitador: LimitadorDeRitmo) {}

  intercept(contexto: ExecutionContext, siguiente: CallHandler): Observable<unknown> {
    const socket = contexto.switchToWs().getClient<Socket>();

    if (!this.limitador.admite(socket.id)) {
      return of({ ok: false, error: 'DEMASIADAS_PETICIONES' } satisfies Resultado<never>);
    }

    return siguiente.handle();
  }
}
