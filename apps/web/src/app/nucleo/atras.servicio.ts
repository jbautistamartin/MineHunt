import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

import { ServicioPartida } from './partida.servicio';

/** A donde lleva el boton de atras desde la pantalla en la que se pulsa. */
export type DestinoAtras = 'menu' | 'partida' | 'salir-de-la-app';

/**
 * Que hace el boton (o el gesto) de atras del telefono en cada pantalla.
 *
 * Hay que decidirlo a mano: por defecto Capacitor tira del historial del
 * WebView, y ahi estan todas las idas y venidas entre el mapa de niveles y la
 * partida, asi que "atras" acababa llevando a pantallas que no tenian nada que
 * ver con lo que el jugador estaba viendo.
 *
 * - Desde cualquier pantalla se vuelve **al menu principal**, que es de donde
 *   se sale a todo lo demas. Tambien desde el Multijugador Online: ahi no se
 *   pregunta, porque la sala sigue esperando con la credencial guardada y se
 *   puede volver a ella.
 * - Desde el menu principal se **sale de la aplicacion**, que es lo que espera
 *   cualquiera en Android.
 * - Desde una partida no se decide aqui: se pide la salida y la atiende la
 *   pantalla de partida, que es la que sabe si hay que **preguntar** antes de
 *   dejarla a medias y a donde volver despues.
 *
 * Solo se engancha en nativo. En el navegador el atras es el del navegador y
 * ya funciona.
 */
@Injectable({ providedIn: 'root' })
export class ServicioBotonAtras {
  private readonly router = inject(Router);
  private readonly partida = inject(ServicioPartida);

  /**
   * El jugador ha pedido salir de la partida con el boton de atras. La
   * pantalla de partida la atiende y la despeja con `salidaAtendida()`.
   */
  private readonly salidaPedidaInterna = signal(false);
  readonly salidaPedida = this.salidaPedidaInterna.asReadonly();

  /** Engancha el boton de atras del telefono. En el navegador no hace nada. */
  escuchar(): void {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    void App.addListener('backButton', () => {
      this.pulsar();
    });
  }

  /** El atras desde esa ruta; separado del plugin para poder probarlo. */
  destinoDesde(url: string): DestinoAtras {
    if (url.startsWith('/partida')) {
      return this.partida.hayPartida() ? 'partida' : 'menu';
    }
    // La ruta puede traer parametros o fragmento; la raiz es lo que quede
    // antes de ellos.
    return /^\/?($|[?#])/.test(url) ? 'salir-de-la-app' : 'menu';
  }

  /** Atras pulsado. Sin argumento, desde donde este el jugador ahora. */
  pulsar(url: string = this.router.url): void {
    switch (this.destinoDesde(url)) {
      case 'partida':
        this.salidaPedidaInterna.set(true);
        return;
      case 'salir-de-la-app':
        if (Capacitor.isNativePlatform()) {
          void App.exitApp();
        }
        return;
      default:
        void this.router.navigate(['/']);
    }
  }

  /** La pantalla de partida ya ha atendido la peticion de salir. */
  salidaAtendida(): void {
    this.salidaPedidaInterna.set(false);
  }
}
