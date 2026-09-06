import { Module } from '@nestjs/common';

import { ControladorPrincipal } from './app.controller.js';
import { ServicioPrincipal } from './app.service.js';
import { ControladorPanel } from './panel/panel.controlador.js';
import { ModuloSalas } from './salas/salas.modulo.js';

@Module({
  imports: [ModuloSalas],
  controllers: [ControladorPrincipal, ControladorPanel],
  providers: [ServicioPrincipal],
})
export class ModuloPrincipal {}
