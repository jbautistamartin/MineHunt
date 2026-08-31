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

  it('responde en la raiz que el servidor esta operativo', () => {
    return request(aplicacion.getHttpServer()).get('/').expect(200).expect(/operativo/);
  });

  it('expone el saludo del motor de juego', () => {
    return request(aplicacion.getHttpServer())
      .get('/motor')
      .expect(200)
      .expect(saludar());
  });
});
