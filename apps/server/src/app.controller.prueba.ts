import { Test, TestingModule } from '@nestjs/testing';

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

  it('informa de que el servidor esta operativo', () => {
    expect(controlador.obtenerEstado()).toContain('operativo');
  });

  it('consume el motor de juego enlazado en el monorepo', () => {
    expect(controlador.obtenerSaludoDelMotor()).toBe(
      'MineHunt: motor de juego 0.0.0 listo',
    );
  });
});
