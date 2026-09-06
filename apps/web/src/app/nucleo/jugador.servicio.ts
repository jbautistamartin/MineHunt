import { Injectable, signal } from '@angular/core';

/** Donde se recuerda como se llama el jugador. */
const CLAVE_ALMACENAMIENTO = 'minehunt.jugador';

/** Lo que acepta el servidor, que es quien manda en esto. */
const LARGO_MAXIMO = 16;

/**
 * Como se llama el jugador.
 *
 * Se guarda aparte de la credencial de la sala a proposito: **la credencial se
 * olvida al dejar la sala**, y el nombre no tiene por que irse con ella. Quien
 * juega tres partidas seguidas no quiere teclear su nombre tres veces.
 *
 * Lo que sale de localStorage se valida antes de usarse, como todo lo demas:
 * ese texto lo puede haber escrito cualquiera y sobrevive a los cambios de
 * version. Un nombre demasiado largo lo rechazaria el servidor, asi que se
 * recorta aqui igual que alli.
 */
@Injectable({ providedIn: 'root' })
export class ServicioJugador {
  private readonly nombreInterno = signal(leerGuardado());

  readonly nombre = this.nombreInterno.asReadonly();

  /**
   * Se queda con el nombre que el jugador vaya escribiendo.
   *
   * Se llama a cada cambio y no al entrar en una sala, para que tambien se
   * recuerde lo que se tecleo sin llegar a jugar.
   */
  recordar(nombre: string): void {
    const limpio = limpiar(nombre);
    this.nombreInterno.set(limpio);

    try {
      if (limpio === '') {
        localStorage.removeItem(CLAVE_ALMACENAMIENTO);
      } else {
        localStorage.setItem(CLAVE_ALMACENAMIENTO, limpio);
      }
    } catch {
      // Sin almacenamiento se juega igual, solo que no se recuerda.
    }
  }
}

function limpiar(nombre: string): string {
  return nombre.trim().slice(0, LARGO_MAXIMO);
}

function leerGuardado(): string {
  try {
    return limpiar(localStorage.getItem(CLAVE_ALMACENAMIENTO) ?? '');
  } catch {
    return '';
  }
}
