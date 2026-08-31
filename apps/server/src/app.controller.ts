import { Controller, Get } from '@nestjs/common';

import { ServicioPrincipal } from './app.service.js';

@Controller()
export class ControladorPrincipal {
  constructor(private readonly servicioPrincipal: ServicioPrincipal) {}

  @Get()
  obtenerEstado(): string {
    return this.servicioPrincipal.obtenerEstado();
  }

  @Get('motor')
  obtenerSaludoDelMotor(): string {
    return this.servicioPrincipal.obtenerSaludoDelMotor();
  }
}
