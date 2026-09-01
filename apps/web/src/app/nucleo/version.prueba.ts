import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
});
