import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TOTAL_NIVELES, TOTAL_ZONAS } from '@minehunt/game-engine';
import { provideTranslateService } from '@ngx-translate/core';

import { ServicioHistoria } from '../../nucleo/historia.servicio';
import { ServicioPartida } from '../../nucleo/partida.servicio';
import { Historia } from './historia';

/** Botones de nivel de la rejilla, en el orden en que se pintan. */
function botonesDeNivel(elemento: HTMLElement): HTMLButtonElement[] {
  return [...elemento.querySelectorAll<HTMLButtonElement>('button.nivel')];
}

describe('Historia', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideTranslateService({}),
      ],
    });
  });

  it('pinta los cincuenta niveles repartidos en zonas', () => {
    const fixture = TestBed.createComponent(Historia);
    fixture.detectChanges();
    const elemento = fixture.nativeElement as HTMLElement;

    expect(elemento.querySelectorAll('.zona')).toHaveLength(TOTAL_ZONAS);
    expect(botonesDeNivel(elemento)).toHaveLength(TOTAL_NIVELES);
  });

  it('al empezar solo se puede entrar al primer nivel', () => {
    const fixture = TestBed.createComponent(Historia);
    fixture.detectChanges();

    const botones = botonesDeNivel(fixture.nativeElement as HTMLElement);
    expect(botones[0]?.disabled).toBe(false);
    expect(botones.slice(1).every((boton) => boton.disabled)).toBe(true);
    // Y el que se ofrece jugar es ese mismo, sin tener que elegirlo.
    expect(fixture.componentInstance.seleccionado()?.numero).toBe(1);
    expect(fixture.componentInstance.puedeJugar()).toBe(true);
  });

  it('mirar un nivel bloqueado no deja jugarlo', () => {
    const fixture = TestBed.createComponent(Historia);
    const componente = fixture.componentInstance;
    fixture.detectChanges();

    componente.seleccionar(TestBed.inject(ServicioHistoria).niveles[9]!);
    fixture.detectChanges();

    expect(componente.seleccionado()?.numero).toBe(10);
    expect(componente.puedeJugar()).toBe(false);
    expect((fixture.nativeElement as HTMLElement).querySelector('.aviso')).not.toBeNull();
  });

  it('jugar monta la partida del nivel y salta a la pantalla de juego', async () => {
    const fixture = TestBed.createComponent(Historia);
    const partida = TestBed.inject(ServicioPartida);
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.detectChanges();

    fixture.componentInstance.jugar();

    expect(navegar).toHaveBeenCalledWith(['/partida']);
    expect(TestBed.inject(ServicioHistoria).nivelEnCurso()?.numero).toBe(1);
    expect(partida.estado()?.ancho).toBe(TestBed.inject(ServicioHistoria).niveles[0]!.ancho);

    partida.abandonar();
    navegar.mockRestore();
  });

  it('borrar el progreso pide confirmacion antes', () => {
    const fixture = TestBed.createComponent(Historia);
    const componente = fixture.componentInstance;
    const historia = TestBed.inject(ServicioHistoria);
    fixture.detectChanges();

    componente.pedirReinicio();
    expect(componente.confirmandoReinicio()).toBe(true);

    componente.cancelarReinicio();
    expect(componente.confirmandoReinicio()).toBe(false);

    componente.confirmarReinicio();
    expect(componente.confirmandoReinicio()).toBe(false);
    expect(historia.progreso()).toEqual({ desbloqueado: 1, superados: [] });
  });
});
