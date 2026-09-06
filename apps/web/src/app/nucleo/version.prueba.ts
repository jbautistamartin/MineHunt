import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { VERSION_PROTOCOLO } from '@minehunt/game-engine';

import { VERSION_APP } from './version';

describe('VERSION_APP', () => {
  /**
   * La version se enseña en pantalla desde una constante, asi que lo unico que
   * puede desincronizarla es publicar una version nueva y olvidarla aqui.
   */
  it('coincide con la del package.json de la web', () => {
    const paquete = JSON.parse(
      readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
    ) as { version: string };

    expect(VERSION_APP).toBe(paquete.version);
  });

  /**
   * La version del protocolo va a la par con la de la aplicacion.
   *
   * Es la que compara el servidor al entrar en una sala, asi que el numero que
   * el jugador lee en pantalla es el mismo que decide si puede jugar contra un
   * servidor o no. Con dos numeros distintos habia que mirar el otro, el que no
   * se ensena en ningun sitio, para entender un VERSION_INCOMPATIBLE.
   */
  it('va a la par con la version del protocolo del motor', () => {
    expect(VERSION_APP).toBe(VERSION_PROTOCOLO);
  });
});
