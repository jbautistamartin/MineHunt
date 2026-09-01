import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ServicioAjustes, type AjustesEntrenamiento } from './ajustes.servicio';

const CLAVE = 'minehunt.entrenamiento';

/** Ajustes validos de referencia; cada prueba estropea lo que necesita. */
function ajustes(cambios: Partial<AjustesEntrenamiento> = {}): AjustesEntrenamiento {
  return {
    ancho: 12,
    alto: 10,
    minas: 20,
    numJugadores: 3,
    numHumanos: 1,
    nivelesIA: [1, 4],
    recargaOndaSegundos: 25,
    tiempoPorTurnoSegundos: 12,
    ...cambios,
  };
}

describe('ServicioAjustes', () => {
  let servicio: ServicioAjustes;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    servicio = TestBed.inject(ServicioAjustes);
  });

  it('sin nada guardado no devuelve nada', () => {
    expect(servicio.cargar()).toBeNull();
  });

  it('recuerda lo que se guardo', () => {
    servicio.guardar(ajustes());

    expect(servicio.cargar()).toEqual(ajustes());
  });

  it('olvidar borra lo guardado', () => {
    servicio.guardar(ajustes());

    servicio.olvidar();

    expect(servicio.cargar()).toBeNull();
    expect(localStorage.getItem(CLAVE)).toBeNull();
  });

  it('descarta lo guardado si no es ni siquiera JSON', () => {
    localStorage.setItem(CLAVE, 'esto no es json');

    expect(servicio.cargar()).toBeNull();
  });

  it('descarta ajustes con valores imposibles', () => {
    const imposibles: Partial<AjustesEntrenamiento>[] = [
      { ancho: 500 }, // no cabe en pantalla
      { alto: 0 },
      { minas: 12 * 10 }, // no dejaria ni la celda del primer clic
      { minas: 0 },
      { numJugadores: 9 },
      { numHumanos: 4 }, // mas humanos que jugadores
      { recargaOndaSegundos: -1 },
      { tiempoPorTurnoSegundos: 9999 },
      { nivelesIA: [] },
      { nivelesIA: [7] as unknown as AjustesEntrenamiento['nivelesIA'] },
    ];

    for (const cambio of imposibles) {
      localStorage.setItem(CLAVE, JSON.stringify(ajustes(cambio)));
      expect(servicio.cargar(), JSON.stringify(cambio)).toBeNull();
    }
  });

  it('descarta ajustes a los que les falta un campo', () => {
    const incompletos = { ...ajustes() } as Record<string, unknown>;
    delete incompletos['minas'];
    localStorage.setItem(CLAVE, JSON.stringify(incompletos));

    expect(servicio.cargar()).toBeNull();
  });

  /**
   * Hay navegadores que lanzan al tocar localStorage, y quedarse sin memoria de
   * ajustes no puede impedir jugar.
   */
  it('aguanta que el navegador bloquee el almacenamiento', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });

    expect(() => servicio.guardar(ajustes())).not.toThrow();
    expect(servicio.cargar()).toBeNull();

    vi.restoreAllMocks();
  });
});
