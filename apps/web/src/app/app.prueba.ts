import { TestBed } from '@angular/core/testing';

import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('crea el componente raiz', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('consume el motor de juego enlazado en el monorepo', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance.saludoMotor()).toBe(
      'MineHunt: motor de juego 0.0.0 listo',
    );
  });
});
