import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';

import { ModuloPrincipal } from './app.module.js';
import { leerConfiguracion } from './configuracion.js';

/**
 * Donde puede estar el cliente web dentro de la imagen.
 *
 * En el contenedor la web se copia al lado del servidor compilado; corriendo
 * desde el repositorio, esta donde la deja `ng build`. Se prueban las dos y se
 * usa la primera que exista, para que `node dist/main` funcione igual en los
 * dos sitios sin una variable mas que acordarse de poner.
 */
const CANDIDATAS_DE_LA_WEB = ['../web', '../../../apps/web/dist/web/browser'];

/** Lo que atiende el servidor por su cuenta y no puede tapar la web. */
const RUTAS_DEL_SERVIDOR = ['/panel', '/motor', '/socket.io'];

async function arrancar(): Promise<void> {
  const configuracion = leerConfiguracion();
  const aplicacion = await NestFactory.create<NestExpressApplication>(ModuloPrincipal);

  /*
   * El CORS sigue haciendo falta aunque la web y el socket compartan origen:
   * la aplicacion de Android no descarga la web —lleva el bundle dentro del
   * APK— y su origen nunca va a ser el del servidor.
   */
  aplicacion.enableCors({ origin: configuracion.origenes ? [...configuracion.origenes] : true });

  servirLaWeb(aplicacion);

  await aplicacion.listen(configuracion.puerto);
}

/**
 * Sirve el cliente web desde el propio Nest.
 *
 * Un despliegue, un dominio y un certificado, y la version de navegador queda
 * en el mismo origen que el WebSocket. Sin bundle al lado —que es lo normal
 * desarrollando, cuando la web va en su `ng serve`— no se monta nada y la raiz
 * lleva al panel, que es lo unico que hay que ver ahi.
 */
function servirLaWeb(aplicacion: NestExpressApplication): void {
  const raiz = CANDIDATAS_DE_LA_WEB.map((candidata) =>
    join(import.meta.dirname, candidata),
  ).find((ruta) => existsSync(join(ruta, 'index.html')));

  if (raiz === undefined) {
    aplicacion.use((peticion: Request, respuesta: Response, siguiente: NextFunction) => {
      if (peticion.path === '/') {
        respuesta.redirect('/panel');
        return;
      }
      siguiente();
    });
    return;
  }

  aplicacion.useStaticAssets(raiz, { index: false });

  /*
   * Las rutas de Angular (/online, /historia...) no son ficheros: recargar
   * estando en una de ellas pide al servidor algo que no existe en el disco, y
   * lo que hay que devolver es la misma pagina para que el enrutador del
   * cliente haga el resto. Se deja fuera lo que atiende el servidor, y todo lo
   * que no sea una navegacion: un fichero que falta tiene que seguir siendo un
   * 404 y no un index.html disfrazado, que eso convierte cualquier ruta mal
   * escrita en una pantalla en blanco sin error.
   */
  aplicacion.use((peticion: Request, respuesta: Response, siguiente: NextFunction) => {
    const esNavegacion =
      peticion.method === 'GET' && (peticion.headers.accept ?? '').includes('text/html');
    const esDelServidor = RUTAS_DEL_SERVIDOR.some((ruta) => peticion.path.startsWith(ruta));

    if (!esNavegacion || esDelServidor) {
      siguiente();
      return;
    }

    respuesta.sendFile(join(raiz, 'index.html'));
  });
}

await arrancar();
