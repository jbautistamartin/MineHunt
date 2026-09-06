import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';

import { Online } from './online';

/** Textos de uno de los dos idiomas que se sirven en /assets/i18n/. */
function traducciones(idioma: 'es' | 'en'): Record<string, unknown> {
  const ruta = resolve(process.cwd(), 'public/assets/i18n', `${idioma}.json`);
  return JSON.parse(readFileSync(ruta, 'utf8')) as Record<string, unknown>;
}

describe('Online', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideTranslateService({}),
      ],
    });
  });

  it('sin sala, lo primero es entrar en una', () => {
    const fixture = TestBed.createComponent(Online);
    fixture.detectChanges();
    const elemento = fixture.nativeElement as HTMLElement;

    expect(elemento.querySelector('.entrada')).not.toBeNull();
    expect(elemento.querySelector('.lobby')).toBeNull();
    expect(elemento.querySelector('mh-tablero')).toBeNull();
  });

  /** Sin nombre no se puede crear una sala: el servidor lo rechazaria. */
  it('no deja crear una sala sin nombre', () => {
    const fixture = TestBed.createComponent(Online);
    fixture.detectChanges();
    const elemento = fixture.nativeElement as HTMLElement;

    const crear = elemento.querySelector('button.principal');
    expect(crear?.hasAttribute('disabled')).toBe(true);
  });

  it('sienta y quita bots, hasta tres', () => {
    const fixture = TestBed.createComponent(Online);
    const pantalla = fixture.componentInstance;

    for (let intento = 0; intento < 5; intento += 1) {
      pantalla.anadirBot();
    }

    // Con cuatro puestos en la mesa, tres es el maximo de bots.
    expect(pantalla.nivelesIA()).toHaveLength(3);

    pantalla.cambiarNivelDeBot(0, '5');
    pantalla.quitarBot(1);

    expect(pantalla.nivelesIA()).toEqual([5, 3]);
  });

  /** El servidor los rechazaria, pero mejor no dejar ni pedirlo. */
  it('no deja crear una sala con un tablero imposible', () => {
    const fixture = TestBed.createComponent(Online);
    const pantalla = fixture.componentInstance;
    pantalla.nombre.set('Ana');

    expect(pantalla.puedeCrear()).toBe(true);

    pantalla.minas.set(pantalla.totalCeldas());

    expect(pantalla.ajustesValidos()).toBe(false);
    expect(pantalla.puedeCrear()).toBe(false);
  });

  /**
   * Una clave sin traducir se ve a la primera, y aqui ademas la ve alguien que
   * esta esperando a otra persona al otro lado.
   */
  it('esta escrito en los dos idiomas', () => {
    const claves = [
      'titulo',
      'lema',
      'nombre',
      'crear',
      'codigo',
      'unirse',
      'volver',
      'menu',
      'salir',
      'tu',
      'tu_turno',
      'esperando_turno',
      'sustituido',
      'caido',
      'otra',
      'espera_otra',
      'copiar',
      'copiado',
      'sin_servidor',
      'bot',
    ];
    const enCompartir = ['boton', 'titulo', 'texto'];
    const enAbiertas = ['titulo', 'actualizar', 'ninguna', 'detalle', 'con_bots'];
    const enAjustes = ['boton', 'publica', 'publica_ayuda', 'privada_ayuda', 'bots',
      'sin_bots', 'anadir_bot', 'quitar'];
    const enSala = ['codigo', 'comparte', 'jugadores', 'anfitrion', 'ausente', 'ajustes',
      'empezar', 'faltan', 'esperando'];
    const enServidor = ['boton', 'ayuda', 'guardar', 'restablecer'];
    const errores = [
      'SALA_NO_ENCONTRADA',
      'SALA_LLENA',
      'SALA_EN_JUEGO',
      'SALA_EN_LOBBY',
      'NO_ES_EL_ANFITRION',
      'NO_ES_TU_TURNO',
      'JUGADOR_DESCONOCIDO',
      'FALTAN_JUGADORES',
      'CONFIGURACION_INVALIDA',
      'NOMBRE_INVALIDO',
      'PETICION_INVALIDA',
      'VERSION_INCOMPATIBLE',
    ];

    for (const idioma of ['es', 'en'] as const) {
      const textos = traducciones(idioma);
      const online = textos['online'] as Record<string, unknown>;
      expect(online, idioma).toBeDefined();

      for (const clave of claves) {
        expect(online[clave], `online.${clave} en ${idioma}`).toBeTruthy();
      }
      for (const clave of enSala) {
        expect(
          (online['sala'] as Record<string, string>)[clave],
          `online.sala.${clave} en ${idioma}`,
        ).toBeTruthy();
      }
      for (const clave of enCompartir) {
        expect(
          (online['compartir'] as Record<string, string>)[clave],
          `online.compartir.${clave} en ${idioma}`,
        ).toBeTruthy();
      }
      for (const clave of enAbiertas) {
        expect(
          (online['abiertas'] as Record<string, string>)[clave],
          `online.abiertas.${clave} en ${idioma}`,
        ).toBeTruthy();
      }
      for (const clave of enAjustes) {
        expect(
          (online['ajustes'] as Record<string, string>)[clave],
          `online.ajustes.${clave} en ${idioma}`,
        ).toBeTruthy();
      }
      for (const clave of enServidor) {
        expect(
          (online['servidor'] as Record<string, string>)[clave],
          `online.servidor.${clave} en ${idioma}`,
        ).toBeTruthy();
      }

      // Los codigos que manda el servidor los traduce el cliente: si falta uno,
      // el jugador ve la clave pelada justo cuando algo va mal.
      const error = textos['error'] as Record<string, string>;
      for (const codigo of errores) {
        expect(error[codigo], `error.${codigo} en ${idioma}`).toBeTruthy();
      }
    }
  });
});

describe('Online: la espera del servidor', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideTranslateService({}),
      ],
    });
  });

  /**
   * Entrar en una sala no es instantaneo y puede no llegar nunca: con el
   * servidor fuera de alcance, el acuse de recibo no vuelve. Sin esto el
   * jugador se queda mirando un boton apagado sin saber que pasa.
   */
  it('ensena que esta esperando al servidor, y deja cancelar', () => {
    const fixture = TestBed.createComponent(Online);
    fixture.componentInstance.ocupado.set(true);
    fixture.detectChanges();
    const elemento = fixture.nativeElement as HTMLElement;

    expect(elemento.querySelector('.velo')).not.toBeNull();
    expect(elemento.querySelector('.girando')).not.toBeNull();
    expect(elemento.querySelector('.velo button')).not.toBeNull();
  });

  it('sin nada pendiente no hay ninguna ventana encima', () => {
    const fixture = TestBed.createComponent(Online);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.velo')).toBeNull();
  });
});
