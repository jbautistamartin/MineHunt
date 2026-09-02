import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MotorJuego, type Coordenada, type EstadoPartida } from '@minehunt/game-engine';

import { Tablero } from './tablero';

/**
 * Estado de partida reproducible: con aleatorio a 0 y primer clic en (2,2),
 * las minas caen en (0,0) y (1,0) de un 3x3.
 */
function estadoDePrueba(): EstadoPartida {
  const partida = MotorJuego.crearPartida(3, 3, 2, 2, { aleatorio: () => 0 });
  // La cascada solo sale de la onda: sin ella, el clic destaparia una sola celda.
  partida.activarOnda();
  partida.clicCelda(2, 2); // J0 gasta la onda y arrastra la cascada
  partida.clicCelda(0, 0); // J1 encuentra una mina
  return partida.obtenerEstado();
}

function crearComponente(estado: EstadoPartida, bloqueado = false) {
  const fixture = TestBed.createComponent(Tablero);
  fixture.componentRef.setInput('estado', estado);
  fixture.componentRef.setInput('bloqueado', bloqueado);
  fixture.detectChanges();
  return fixture;
}

describe('Tablero', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
  });

  it('pinta una celda por posicion del tablero', () => {
    const fixture = crearComponente(estadoDePrueba());
    const celdas = fixture.nativeElement.querySelectorAll('.celda');

    expect(celdas).toHaveLength(9);
  });

  it('da a cada numero su clase de color y deja vacias las celdas sin minas alrededor', () => {
    const fixture = crearComponente(estadoDePrueba());
    const celdas = fixture.nativeElement.querySelectorAll('.celda');

    // (0,1) es la cuarta celda: tiene un 2 y por tanto la clase n2.
    const conDos = celdas[3] as HTMLElement;
    expect(conDos.classList).toContain('despejada');
    expect(conDos.classList).toContain('n2');
    expect(conDos.textContent?.trim()).toBe('2');

    // (0,2) esta despejada con un 0: no lleva clase de numero ni texto.
    const conCero = celdas[6] as HTMLElement;
    expect(conCero.classList).toContain('despejada');
    expect(conCero.classList).not.toContain('n0');
    expect(conCero.textContent?.trim()).toBe('');
  });

  it('marca la mina encontrada con el color del jugador que la encontro', () => {
    const fixture = crearComponente(estadoDePrueba());
    const mina = fixture.nativeElement.querySelectorAll('.celda')[0] as HTMLElement;

    expect(mina.classList).toContain('mina');
    // La encontro el jugador 1.
    expect(mina.classList).toContain('jugador-1');
  });

  it('el boton derecho avisa por su propia salida y se come el menu del navegador', () => {
    const fixture = crearComponente(estadoDePrueba());
    const alternas: Coordenada[] = [];
    fixture.componentInstance.celdaPulsadaAlterna.subscribe((celda: Coordenada) => {
      alternas.push(celda);
    });

    const celdas = fixture.nativeElement.querySelectorAll('.celda');
    const evento = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    // (2,0) es la tercera celda y sigue oculta.
    (celdas[2] as HTMLButtonElement).dispatchEvent(evento);

    expect(alternas).toEqual([{ x: 2, y: 0 }]);
    // Sin esto saldria el menu contextual del navegador en plena partida.
    expect(evento.defaultPrevented).toBe(true);
  });

  it('el boton derecho sobre el tablero bloqueado no avisa de nada', () => {
    const fixture = crearComponente(estadoDePrueba(), true);
    const alternas: Coordenada[] = [];
    fixture.componentInstance.celdaPulsadaAlterna.subscribe((celda: Coordenada) => {
      alternas.push(celda);
    });

    const celdas = fixture.nativeElement.querySelectorAll('.celda');
    (celdas[2] as HTMLButtonElement).dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true }),
    );

    expect(alternas).toEqual([]);
  });

  it('avisa de la celda pulsada solo si sigue oculta', () => {
    const fixture = crearComponente(estadoDePrueba());
    const pulsaciones: Coordenada[] = [];
    fixture.componentInstance.celdaPulsada.subscribe((celda: Coordenada) => {
      pulsaciones.push(celda);
    });

    const celdas = fixture.nativeElement.querySelectorAll('.celda');
    // (2,0) es la tercera celda y sigue oculta: la cascada no llego hasta ella.
    (celdas[2] as HTMLButtonElement).click();
    // (0,1) ya esta despejada: su boton esta deshabilitado.
    (celdas[3] as HTMLButtonElement).click();

    expect(pulsaciones).toEqual([{ x: 2, y: 0 }]);
  });

  it('no deja pulsar nada con el tablero bloqueado', () => {
    const fixture = crearComponente(estadoDePrueba(), true);
    const pulsaciones: Coordenada[] = [];
    fixture.componentInstance.celdaPulsada.subscribe((celda: Coordenada) => {
      pulsaciones.push(celda);
    });

    const celdas = fixture.nativeElement.querySelectorAll('.celda');
    (celdas[2] as HTMLButtonElement).click();

    expect(pulsaciones).toHaveLength(0);
  });

  /**
   * Al acabar la partida el motor destapa el tablero entero. Las minas que no
   * se llevo nadie no llevan color de jugador: se pintan apagadas para que se
   * distingan de las que si puntuaron.
   */
  it('pinta sin duenno las minas que salen al acabar la partida', () => {
    const partida = MotorJuego.crearPartida(3, 3, 2, 2, { aleatorio: () => 0 });
    partida.clicCelda(2, 2); // J0, sin mina: cede
    partida.clicCelda(0, 0); // J1 encuentra una mina
    partida.rendirse(1); // se queda J0 solo: se acaba con una mina sin destapar

    const fixture = crearComponente(partida.obtenerEstado(), true);
    const celdas = fixture.nativeElement.querySelectorAll('.celda');

    const encontrada = celdas[0] as HTMLElement;
    expect(encontrada.classList).toContain('mina');
    expect(encontrada.classList).toContain('jugador-1');
    expect(encontrada.classList).not.toContain('sin-duenno');

    // (1,0) escondia la otra mina y no la encontro nadie.
    const huerfana = celdas[1] as HTMLElement;
    expect(huerfana.classList).toContain('mina');
    expect(huerfana.classList).toContain('sin-duenno');
    expect(huerfana.querySelector('.glifo')).not.toBeNull();

    // Y no queda ni una celda tapada.
    expect(fixture.nativeElement.querySelectorAll('.celda.oculta')).toHaveLength(0);
  });
});
