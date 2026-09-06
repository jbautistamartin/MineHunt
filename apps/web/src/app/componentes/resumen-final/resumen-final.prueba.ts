import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MotorJuego, type EstadoPartida, type Jugador } from '@minehunt/game-engine';
import { provideTranslateService } from '@ngx-translate/core';

import { ResumenFinal } from './resumen-final';

/**
 * Partida de verdad, jugada hasta el final: las estadisticas salen del motor,
 * asi que montarlas a mano probaria otra cosa.
 *
 * Con el azar a 0 y el primer clic en (3,3), las minas de un 4x4 caen en
 * (0,0), (1,0) y (2,0).
 */
function partidaTerminada(): EstadoPartida {
  const partida = MotorJuego.crearPartida(4, 4, 3, 2, { aleatorio: () => 0 });
  partida.clicCelda(3, 3); // J0 despeja y cede el turno
  partida.clicCelda(0, 0); // J1 encuentra mina y repite
  partida.clicCelda(1, 0);
  partida.clicCelda(2, 0); // la ultima: se acaba la partida
  return partida.obtenerEstado();
}

function crear(estado: EstadoPartida, nombres = ['Ana', 'Luis']) {
  const fixture = TestBed.createComponent(ResumenFinal);
  fixture.componentRef.setInput('jugadores', estado.jugadores);
  fixture.componentRef.setInput('nombres', nombres);
  fixture.componentRef.setInput('ganador', estado.ganador);
  fixture.detectChanges();
  return fixture;
}

describe('ResumenFinal', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideTranslateService()],
    });
  });

  it('saca una ficha por jugador, con el nombre que le den', () => {
    const fixture = crear(partidaTerminada());
    const fichas = fixture.nativeElement.querySelectorAll('.jugador');

    expect(fichas).toHaveLength(2);
    expect((fichas[0] as HTMLElement).textContent).toContain('Luis');
  });

  /** Una tabla se lee de arriba abajo: primero el que mas encontro. */
  it('ordena de mas a menos minas', () => {
    const componente = crear(partidaTerminada()).componentInstance;

    expect(componente.filas().map((fila) => fila.id)).toEqual([1, 0]);
    expect(componente.filas()[0]?.minas).toBe(3);
  });

  it('marca al ganador', () => {
    const componente = crear(partidaTerminada()).componentInstance;

    expect(componente.filas()[0]?.ganador).toBe(true);
    expect(componente.filas()[1]?.ganador).toBe(false);
  });

  it('saca la punteria de las minas por clic', () => {
    const componente = crear(partidaTerminada()).componentInstance;

    // J1 dio tres clics y en los tres encontro mina.
    expect(componente.filas()[0]?.punteria).toBe(100);
    // J0 dio uno y no encontro ninguna.
    expect(componente.filas()[1]?.punteria).toBe(0);
  });

  /** Con la partida abandonada antes del primer clic no hay nada que dividir. */
  it('no inventa punteria si nadie llego a clicar', () => {
    const partida = MotorJuego.crearPartida(4, 4, 3, 2, { aleatorio: () => 0 });
    partida.rendirse(0);

    const componente = crear(partida.obtenerEstado()).componentInstance;

    expect(componente.filas().every((fila) => fila.punteria === null)).toBe(true);
  });

  /**
   * El motor cuenta clics, celdas, ondas y racha, pero el resumen no los pinta:
   * son el detalle de como se llego al resultado y se comian la pantalla del
   * telefono. Si alguno vuelve, que sea a proposito y no de rebote.
   */
  it('no saca mas datos que las minas y la punteria', () => {
    const fixture = crear(partidaTerminada());
    const ficha = fixture.nativeElement.querySelector('.jugador') as HTMLElement;

    expect(ficha.textContent).not.toContain('resumen.clics');
    expect(ficha.textContent).not.toContain('resumen.racha');
    expect(ficha.textContent).not.toContain('resumen.celdas');
    expect(ficha.textContent).not.toContain('resumen.ondas');
  });

  /** Una linea por jugador: el nombre a un lado y las dos cifras al otro. */
  it('pone a cada jugador en una sola fila', () => {
    const fixture = crear(partidaTerminada());
    const ficha = fixture.nativeElement.querySelector('.jugador') as HTMLElement;

    expect(ficha.querySelector('.nombre')).not.toBeNull();
    expect(ficha.querySelectorAll('.cifras > *')).toHaveLength(2);
    expect(ficha.querySelector('dl')).toBeNull();
  });

  /** Los turnos perdidos solo se ensenan a quien perdio alguno. */
  it('esconde los turnos perdidos cuando no hubo ninguno', () => {
    const fixture = crear(partidaTerminada());

    expect(fixture.nativeElement.textContent).not.toContain('resumen.turnos_perdidos');
  });

  /**
   * El estado de una partida online lo manda el servidor, y el resumen es lo
   * ultimo que puede permitirse tumbar la pantalla justo al terminar.
   */
  it('aguanta un jugador sin estadisticas en vez de reventar', () => {
    const jugadores = partidaTerminada().jugadores.map((jugador) => ({
      ...jugador,
      estadisticas: undefined as unknown as Jugador['estadisticas'],
    }));
    const fixture = TestBed.createComponent(ResumenFinal);
    fixture.componentRef.setInput('jugadores', jugadores);
    fixture.componentRef.setInput('nombres', ['Ana', 'Luis']);

    expect(() => {
      fixture.detectChanges();
    }).not.toThrow();
    expect(fixture.componentInstance.filas()[0]?.punteria).toBeNull();
  });

  it('dice quien se rindio', () => {
    const jugadores: readonly Jugador[] = partidaTerminada().jugadores.map((jugador) => ({
      ...jugador,
      rendido: jugador.id === 0,
    }));
    const fixture = TestBed.createComponent(ResumenFinal);
    fixture.componentRef.setInput('jugadores', jugadores);
    fixture.componentRef.setInput('nombres', ['Ana', 'Luis']);
    fixture.detectChanges();

    expect(fixture.componentInstance.filas()[1]?.rendido).toBe(true);
  });
});
