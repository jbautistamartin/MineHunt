import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

/**
 * Pasar el codigo de una sala a quien tiene que jugar contigo.
 *
 * Hacen falta las dos cosas y no una: **el codigo no se puede seleccionar con
 * el dedo** —la aplicacion apaga la seleccion de texto para que no estorbe al
 * clicar celdas—, y en el movil copiarlo al portapapeles tampoco basta, porque
 * lo normal es querer mandarlo por donde se hable con esa persona.
 */
@Injectable({ providedIn: 'root' })
export class ServicioCompartir {
  /** Hay a donde mandarlo: la hoja de compartir del sistema. */
  readonly sePuedeCompartir =
    Capacitor.isNativePlatform() || typeof navigator.share === 'function';

  /** Abre la hoja de compartir del sistema. */
  async compartir(titulo: string, texto: string): Promise<boolean> {
    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({ title: titulo, text: texto });
        return true;
      }
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: titulo, text: texto });
        return true;
      }
    } catch {
      // Cancelar la hoja de compartir tambien llega aqui, y no es un fallo que
      // haya que contarle a nadie.
    }
    return false;
  }

  /** Copia al portapapeles. */
  async copiar(texto: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch {
      // El portapapeles moderno solo existe en contexto seguro: sirviendo la
      // web de desarrollo por http a una IP de la red local no esta, y ahi
      // todavia queda el truco de toda la vida.
      return copiarALaAntigua(texto);
    }
  }
}

function copiarALaAntigua(texto: string): boolean {
  try {
    const campo = document.createElement('textarea');
    campo.value = texto;
    campo.setAttribute('readonly', '');
    campo.style.position = 'fixed';
    campo.style.opacity = '0';
    document.body.appendChild(campo);
    campo.select();
    const copiado = document.execCommand('copy');
    document.body.removeChild(campo);
    return copiado;
  } catch {
    return false;
  }
}
