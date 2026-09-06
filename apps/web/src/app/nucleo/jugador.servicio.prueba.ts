import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ServicioJugador } from './jugador.servicio';

const CLAVE = 'minehunt.jugador';

function crear(): ServicioJugador {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  return TestBed.inject(ServicioJugador);
}

describe('ServicioJugador', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('empieza sin nombre', () => {
    expect(crear().nombre()).toBe('');
  });

  it('recuerda el nombre para la proxima vez', () => {
    crear().recordar('Ana');

    expect(localStorage.getItem(CLAVE)).toBe('Ana');
    expect(crear().nombre()).toBe('Ana');
  });

  /** El servidor lo rechazaria, asi que se recorta aqui igual que alli. */
  it('quita los espacios de los lados y corta a dieciseis caracteres', () => {
    const servicio = crear();

    servicio.recordar('  Ana  ');
    expect(servicio.nombre()).toBe('Ana');

    servicio.recordar('Un nombre larguisimo que no cabe');
    expect(servicio.nombre()).toHaveLength(16);
  });

  it('borrarlo lo olvida del todo', () => {
    const servicio = crear();
    servicio.recordar('Ana');

    servicio.recordar('   ');

    expect(servicio.nombre()).toBe('');
    expect(localStorage.getItem(CLAVE)).toBeNull();
  });

  /** Ese texto lo puede haber escrito cualquiera: se valida al leerlo. */
  it('recorta tambien lo que estuviera guardado de antes', () => {
    localStorage.setItem(CLAVE, '   Un nombre larguisimo que no cabe   ');

    expect(crear().nombre()).toHaveLength(16);
  });
});
