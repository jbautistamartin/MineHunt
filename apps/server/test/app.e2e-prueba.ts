import type { Server } from 'node:http';

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { saludar } from '@minehunt/game-engine';
import request from 'supertest';

import { ModuloPrincipal } from './../src/app.module.js';

describe('Servidor MineHunt (e2e)', () => {
  let aplicacion: INestApplication<Server>;

  beforeEach(async () => {
    const modulo: TestingModule = await Test.createTestingModule({
      imports: [ModuloPrincipal],
    }).compile();

    aplicacion = modulo.createNestApplication();
    await aplicacion.init();
  });

  afterEach(async () => {
    await aplicacion.close();
  });

  it('ensena el panel de salas en la raiz', async () => {
    const respuesta = await request(aplicacion.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Content-Type', /html/);

    expect(respuesta.text).toContain('MineHunt');
    expect(respuesta.text).toContain('No hay ninguna sala abierta');
  });

  /** La que quedara cuando en la Fase 9 la raiz la ocupe la web del juego. */
  it('el panel tambien responde en /panel, y su lista aparte', async () => {
    await request(aplicacion.getHttpServer()).get('/panel').expect(200);

    const lista = await request(aplicacion.getHttpServer()).get('/panel/salas').expect(200);
    expect(lista.text).toContain('salas activas');
  });

  it('expone el saludo del motor de juego', () => {
    return request(aplicacion.getHttpServer())
      .get('/motor')
      .expect(200)
      .expect(saludar());
  });
});
