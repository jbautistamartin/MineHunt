import { Controller, Get } from '@nestjs/common';

import { ServicioPrincipal } from './app.service.js';

@Controller()
export class ControladorPrincipal {
  constructor(private readonly servicioPrincipal: ServicioPrincipal) {}

  @Get('motor')
  obtenerSaludoDelMotor(): string {
    return this.servicioPrincipal.obtenerSaludoDelMotor();
  }
}
