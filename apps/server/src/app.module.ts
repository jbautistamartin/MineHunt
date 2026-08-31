import { Module } from '@nestjs/common';

import { ControladorPrincipal } from './app.controller.js';
import { ServicioPrincipal } from './app.service.js';

@Module({
  imports: [],
  controllers: [ControladorPrincipal],
  providers: [ServicioPrincipal],
})
export class ModuloPrincipal {}
