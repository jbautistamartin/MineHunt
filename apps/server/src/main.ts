import { NestFactory } from '@nestjs/core';

import { ModuloPrincipal } from './app.module.js';

/** Puerto por defecto del servidor de MineHunt. */
const PUERTO_POR_DEFECTO = 3000;

async function arrancar(): Promise<void> {
  const aplicacion = await NestFactory.create(ModuloPrincipal);
  await aplicacion.listen(process.env['PORT'] ?? PUERTO_POR_DEFECTO);
}

await arrancar();
