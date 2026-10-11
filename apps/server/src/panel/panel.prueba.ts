import { readFileSync } from 'node:fs';

import type { InformeSala } from '@minehunt/game-engine';
import {
  contenidoDelPanel,
  escapar,
  formatearDuracion,
  ICONO,
  paginaDelPanel,
} from './panel.js';

function informe(cambios: Partial<InformeSala> = {}): InformeSala {
  return {
    codigo: 'ABCD',
    anfitrion: 'Ana',
    estado: 'lobby',
    publica: true,
    jugadores: 2,
    bots: 0,
    conectados: 2,
    maximo: 4,
    abiertaHaceMs: 45_000,
    ...cambios,
  };
}

describe('panel del servidor', () => {
  /**
   * El icono del panel es el del juego y no un dibujo parecido.
   *
   * Va copiado dentro del codigo —la imagen del servidor no lleva la carpeta
   * de documentacion—, y una copia sin vigilar se queda atras en cuanto se
   * retoca el maestro.
   */
  it('el icono es el maestro, con el tamano puesto', () => {
    const maestro = readFileSync(
      '../../documentos/MineHunt-icon.svg',
      'utf8',
    ).trim();

    expect(ICONO).toBe(
      maestro.replace(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">',
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="44" height="44" aria-hidden="true">',
      ),
    );
  });

  describe('formatearDuracion', () => {
    it('el primer minuto va en segundos', () => {
      expect(formatearDuracion(0)).toBe('0 s');
      expect(formatearDuracion(45_000)).toBe('45 s');
      expect(formatearDuracion(59_999)).toBe('59 s');
    });

    it('a partir del minuto, en minutos', () => {
      expect(formatearDuracion(60_000)).toBe('1 min');
      expect(formatearDuracion(59 * 60_000)).toBe('59 min');
    });

    it('y a partir de la hora, en horas y minutos', () => {
      expect(formatearDuracion(60 * 60_000)).toBe('1 h 00 min');
      expect(formatearDuracion(125 * 60_000)).toBe('2 h 05 min');
    });

    /** El reloj puede dar un salto atras; una sala no lleva abierta -3 s. */
    it('nunca dice un tiempo negativo', () => {
      expect(formatearDuracion(-5000)).toBe('0 s');
    });
  });

  describe('contenidoDelPanel', () => {
    it('ensena el codigo, quien la abrio y cuanto lleva', () => {
      const html = contenidoDelPanel([informe()]);

      expect(html).toContain('ABCD');
      expect(html).toContain('Sala de Ana');
      expect(html).toContain('45 s');
      expect(html).toContain('2/4 jugadores');
    });

    it('dice si esta en el lobby o jugando', () => {
      expect(contenidoDelPanel([informe()])).toContain('En el lobby');
      expect(contenidoDelPanel([informe({ estado: 'jugando' })])).toContain(
        'En partida',
      );
      expect(contenidoDelPanel([informe({ estado: 'terminada' })])).toContain(
        'Partida terminada',
      );
    });

    /**
     * El panel es para quien lleva el servidor, no para quien busca partida:
     * aqui salen tambien las privadas y las que ya empezaron.
     */
    it('ensena las privadas, marcadas como tales', () => {
      const html = contenidoDelPanel([informe({ publica: false })]);

      expect(html).toContain('ABCD');
      expect(html).toContain('Privada');
    });

    it('cuenta los bots y los que se quedaron sin conexion', () => {
      const html = contenidoDelPanel([
        informe({ jugadores: 4, bots: 1, conectados: 2 }),
      ]);

      expect(html).toContain('4/4 jugadores');
      expect(html).toContain('1 bot');
      expect(html).toContain('1 sin conexion');
    });

    it('resume cuantas salas, partidas y jugadores hay', () => {
      const html = contenidoDelPanel([
        informe({ codigo: 'AAAA', estado: 'jugando', conectados: 2 }),
        informe({ codigo: 'BBBB', estado: 'lobby', conectados: 3 }),
      ]);

      expect(html).toContain('salas activas');
      expect(html).toContain('partidas en curso');
      expect(html).toContain('<strong>5</strong>');
    });

    it('lo dice cuando no hay ninguna sala', () => {
      expect(contenidoDelPanel([])).toContain('No hay ninguna sala abierta');
    });

    /** Las cartas no bailan mientras se mira: por orden de apertura. */
    it('pone antes las que llevan mas tiempo abiertas', () => {
      const html = contenidoDelPanel([
        informe({ codigo: 'NUEV', abiertaHaceMs: 1000 }),
        informe({ codigo: 'VIEJ', abiertaHaceMs: 600_000 }),
      ]);

      expect(html.indexOf('VIEJ')).toBeLessThan(html.indexOf('NUEV'));
    });

    /**
     * El nombre lo teclea quien entra en la sala, asi que llega tal cual: sin
     * escapar, quien se llame `<script>` ejecuta lo que quiera en el navegador
     * del que esta mirando el panel.
     */
    it('escapa el nombre del anfitrion', () => {
      const html = contenidoDelPanel([
        informe({ anfitrion: '<script>malo()</script>' }),
      ]);

      expect(html).not.toContain('<script>malo()');
      expect(html).toContain('&lt;script&gt;');
    });

    it('escapar deja el texto normal como estaba', () => {
      expect(escapar('Ana & Luis')).toBe('Ana &amp; Luis');
      expect(escapar('Ana')).toBe('Ana');
    });
  });

  describe('paginaDelPanel', () => {
    it('es una pagina completa con las salas dentro', () => {
      const html = paginaDelPanel([informe()], '0.9.0');

      expect(html.startsWith('<!doctype html>')).toBe(true);
      expect(html).toContain('<title>MineHunt — servidor</title>');
      expect(html).toContain('motor 0.9.0');
      expect(html).toContain('ABCD');
    });

    /** Los colores son los de la aplicacion; si se van, deja de parecerse. */
    it('viste con la paleta del juego', () => {
      expect(paginaDelPanel([], '0.9.0')).toContain('#0d1730');
    });

    it('pide la lista sola para refrescarla, sin recargar la pagina', () => {
      expect(paginaDelPanel([], '0.9.0')).toContain('/panel/salas');
    });
  });
});
