import { Injectable, inject, signal } from '@angular/core';
import type { CodigoSuceso } from '@minehunt/game-engine';

import { VIBRADOR } from './vibracion.plugin';

/** Donde se recuerda si el jugador quiere vibracion. */
const CLAVE_ALMACENAMIENTO = 'minehunt.vibracion';

/**
 * Lo que se nota en la mano cuando pasa algo en el tablero.
 *
 * Es el gemelo tactil de [ServicioSonido]: recibe los mismos codigos de suceso
 * y decide un golpe para cada uno, asi que vale igual para el Entrenamiento,
 * la Historia y el Online sin que ninguna pantalla tenga que saber nada. En el
 * telefono se nota mas que el sonido —se juega con el aparato en la mano y a
 * menudo en silencio—, y encontrar mina es justo lo que merece acuse fisico.
 *
 * En un escritorio no hay nada que vibrar y el servicio se queda callado, que
 * es tambien lo que decide que el menu no ensene su interruptor. Como el
 * sonido, esto no puede tumbar una partida: todo va envuelto en try/catch y
 * las llamadas al plugin se sueltan sin esperarlas, que un golpe tarde no le
 * sirve a nadie.
 *
 * **Quien vibra es el plugin del proyecto**, `VibracionPlugin.java`, y no
 * @capacitor/haptics, que se queda de reserva. Aquel llama al vibrador sin
 * declarar atributos, y una vibracion sin declarar sale como `USAGE_UNKNOWN`:
 * Android la considera tan prescindible como la respuesta al tacto y se la
 * traga entera con el telefono en silencio o con la respuesta tactil del
 * sistema apagada, que en muchos aparatos viene apagada de fabrica. Y lo peor
 * no es que no vibre, es que **resuelve su promesa igual**, asi que desde la
 * web no habia forma de distinguirlo de un fallo propio. El del proyecto pone
 * los atributos y devuelve un informe.
 *
 * **Se pide una duracion y no `impact`/`notification`**, que era lo primero que
 * parecia tocar. Esos dos estan pensados para el motor tactil de iOS y en
 * Android se traducen a ondas de 21 a 35 ms a media amplitud: en un telefono
 * moderno eso es un cosquilleo que no se nota teniendo el dedo en la pantalla,
 * que es exactamente cuando hay que notarlo.
 */
@Injectable({ providedIn: 'root' })
export class ServicioVibracion {
  private readonly vibrador = inject(VIBRADOR);

  /**
   * Si hay algo que vibrar: **solo en la aplicacion de Android**.
   *
   * En un navegador no se ofrece siquiera el interruptor. `navigator.vibrate`
   * existe en algun escritorio, pero no mueve nada, y un interruptor que no
   * hace nada es peor que no tenerlo. Preguntarlo una vez ahorra ademas el
   * viaje al puente de Capacitor en cada clic de una partida jugada en la web.
   */
  readonly disponibleEnElAparato = this.vibrador.esAndroid;

  private readonly activaInterna = signal(leerGuardado());

  readonly activa = this.activaInterna.asReadonly();

  private readonly ultimoInformeInterno = signal<string | null>(null);

  /**
   * Como fue el ultimo golpe, en una linea.
   *
   * No lo lee ninguna pantalla: esta para que «no vibra» deje de ser un callejon
   * sin salida. Con el telefono enchufado sale por `adb logcat chromium:I *:S`
   * junto al aviso que escribe [dar], y desde la consola del WebView se puede
   * preguntar por el.
   */
  readonly ultimoInforme = this.ultimoInformeInterno.asReadonly();

  /** Enciende o apaga la vibracion, y lo recuerda para la proxima vez. */
  alternar(): void {
    const nueva = !this.activaInterna();
    this.activaInterna.set(nueva);
    try {
      localStorage.setItem(CLAVE_ALMACENAMIENTO, nueva ? 'si' : 'no');
    } catch {
      // Sin almacenamiento se juega igual, solo que no se recuerda.
    }

    // Al encenderla se nota que se ha encendido: es la unica forma de saber
    // que el interruptor hizo algo, porque lo que enciende no pasa hasta la
    // proxima jugada.
    if (nueva) {
      this.dar(MS_DE_PRUEBA);
    }
  }

  /**
   * El golpe que corresponde a lo que acaba de pasar en la partida.
   *
   * Los codigos son los mismos que traduce la interfaz y que suenan, asi que
   * el enganche de las pantallas es el que ya existia para el sonido.
   */
  vibrarSuceso(codigo: CodigoSuceso): void {
    this.dar(golpeDelSuceso(codigo));
  }

  /** El final de la partida, que se nota distinto segun como acabara. */
  vibrarFinal(gano: boolean): void {
    this.dar(gano ? MS_GANAR : MS_PERDER);
  }

  /**
   * El unico sitio que habla con el aparato.
   *
   * Se suelta sin esperarla: un golpe que llega tarde no le sirve a nadie, y
   * una partida no se puede caer porque el aparato no vibre. Lo que si se hace
   * con la respuesta es **apuntarla**: son tres caminos y hasta ahora los tres
   * fallaban en silencio, que es como se llega a un «no vibra» que no hay por
   * donde coger.
   */
  private dar(duracion: number | null): void {
    if (duracion === null || !this.disponibleEnElAparato || !this.activaInterna()) {
      return;
    }

    void this.intentar(duracion);
  }

  /** Los tres caminos, del bueno al de emergencia. */
  private async intentar(duracion: number): Promise<void> {
    try {
      const informe = await this.vibrador.conElPlugin(duracion);
      this.apuntar(
        informe.hayVibrador
          ? `plugin del proyecto, via ${informe.via}, ${duracion} ms`
          : 'el aparato dice que no tiene vibrador',
      );
      return;
    } catch (fallo) {
      this.apuntar(`el plugin del proyecto fallo (${describir(fallo)}); probando con haptics`);
    }

    // De aqui en adelante es red de seguridad: un APK sin el plugin registrado,
    // o un puente que no cargo. Vibrara flojo o no vibrara, pero no se queda
    // callado sin decir por que.
    try {
      await this.vibrador.conHaptics(duracion);
      this.apuntar(`haptics, ${duracion} ms`);
      return;
    } catch (fallo) {
      this.apuntar(`haptics fallo (${describir(fallo)}); probando con el navegador`);
    }

    try {
      const vibro = this.vibrador.conElNavegador(duracion);
      this.apuntar(vibro ? `navigator.vibrate, ${duracion} ms` : 'navigator.vibrate lo rechazo');
    } catch (fallo) {
      this.apuntar(`no quedaba por donde vibrar (${describir(fallo)})`);
    }
  }

  private apuntar(informe: string): void {
    this.ultimoInformeInterno.set(informe);
    console.info(`[MineHunt/vibracion] ${informe}`);
  }
}

/** Lo que se puede contar de un fallo sin dar por hecho que sea un Error. */
function describir(fallo: unknown): string {
  return fallo instanceof Error ? fallo.message : String(fallo);
}

/**
 * Lo que dura el golpe de encender el interruptor.
 *
 * Es el unico golpe que el jugador provoca a proposito para comprobar que
 * esto funciona, asi que **no puede quedar en duda**: mas largo que cualquier
 * jugada corriente. Con 60 ms no se sabia si el telefono habia vibrado flojo o
 * no habia vibrado, que es justo lo que no debe pasar en un interruptor.
 */
const MS_DE_PRUEBA = 200;

/** El final, que se nota mas largo que cualquier jugada: se acabo. */
const MS_GANAR = 220;
const MS_PERDER = 320;

/**
 * Cuanto vibra cada suceso, en milisegundos. Aparte para poder probarlo.
 *
 * Es la decision de diseno de todo esto —que la mina se note distinta de un
 * clic cualquiera— y no depende de que haya un telefono delante, asi que vive
 * fuera del servicio y se comprueba sin plugin de por medio.
 *
 * Las cifras son de escala humana y no de catalogo: por debajo de unos 20 ms
 * no se distingue nada con el dedo apoyado, y por encima de medio segundo
 * cansa en un juego que es todo clics.
 */
export function golpeDelSuceso(codigo: CodigoSuceso): number | null {
  switch (codigo) {
    // Lo unico que puntua, y lo unico que se tiene que notar de verdad: el
    // golpe mas largo de la partida, para no confundirlo con un clic.
    case 'MINA_ENCONTRADA':
      return 180;
    // El clic que no da mina cede el turno: un toque corto basta.
    case 'CELDA_DESPEJADA':
      return 30;
    case 'ONDA_EXPANSIVA':
      return 90;
    // Perder el turno por tiempo es lo unico que pasa sin tocar nada: tiene
    // que notarse aunque se este mirando a otro lado.
    case 'TURNO_PERDIDO':
      return 150;
    case 'JUGADOR_RENDIDO':
      return 120;
    default:
      return null;
  }
}

/**
 * Si el jugador quiere vibracion.
 *
 * Por defecto si, como el sonido: un telefono que no responde al dedo parece
 * roto. Lo guardado se valida como todo lo demas, que ese texto lo puede haber
 * escrito cualquiera.
 */
function leerGuardado(): boolean {
  try {
    return localStorage.getItem(CLAVE_ALMACENAMIENTO) !== 'no';
  } catch {
    return true;
  }
}
