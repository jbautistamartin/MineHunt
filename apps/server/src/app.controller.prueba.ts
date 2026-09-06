import { Test, TestingModule } from '@nestjs/testing';
import { saludar } from '@minehunt/game-engine';

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
