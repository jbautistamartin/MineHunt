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

  /**
   * El panel vive en `/panel` desde la Fase 9: la raiz la ocupa el cliente web,
   * que va dentro de la misma imagen y lo sirve el propio Nest.
   */
  it('ensena el panel de salas en /panel, y su lista aparte', async () => {
    const respuesta = await request(aplicacion.getHttpServer())
      .get('/panel')
      .expect(200)
      .expect('Content-Type', /html/);

    expect(respuesta.text).toContain('MineHunt');
    expect(respuesta.text).toContain('No hay ninguna sala abierta');

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
