import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Test, TestingModule } from '@nestjs/testing';
import { saludar, VERSION_MOTOR } from '@minehunt/game-engine';

import { ControladorPrincipal } from './app.controller.js';
import { ServicioPrincipal } from './app.service.js';

describe('ControladorPrincipal', () => {
  let controlador: ControladorPrincipal;

  beforeEach(async () => {
    const modulo: TestingModule = await Test.createTestingModule({
      controllers: [ControladorPrincipal],
      providers: [ServicioPrincipal],
    }).compile();

    controlador = modulo.get<ControladorPrincipal>(ControladorPrincipal);
  });

  it('consume el motor de juego enlazado en el monorepo', () => {
    expect(controlador.obtenerSaludoDelMotor()).toBe(saludar());
  });
});

/**
 * Las cuatro versiones del monorepo van a la par, y hasta ahora solo lo
 * vigilaban las del motor y la web: la raiz y el servidor se quedaron en 0.1.0
 * cuando la Fase 8.5 subio las otras dos a 0.1.1, sin que fallara nada. Aqui
 * molesta poco y evita que el numero que se lee en un sitio no sea el de al
 * lado.
 */
describe('version del servidor', () => {
  function versionDe(ruta: string): string {
    const manifiesto = readFileSync(resolve(process.cwd(), ruta), 'utf8');
    return (JSON.parse(manifiesto) as { version: string }).version;
  }

  it('va a la par con la del motor, que es la del protocolo', () => {
    expect(versionDe('package.json')).toBe(VERSION_MOTOR);
  });

  it('va a la par con la de la raiz del monorepo', () => {
    expect(versionDe('../../package.json')).toBe(VERSION_MOTOR);
  });
});
