import { Module } from '@nestjs/common';

import { ControladorPrincipal } from './app.controller.js';
import { ServicioPrincipal } from './app.service.js';
import { ModuloSalas } from './salas/salas.modulo.js';

@Module({
  imports: [ModuloSalas],
  controllers: [ControladorPrincipal],
  providers: [ServicioPrincipal],
})
export class ModuloPrincipal {}
