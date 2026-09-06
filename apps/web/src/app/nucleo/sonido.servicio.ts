import { Injectable, signal } from '@angular/core';
import type { CodigoSuceso } from '@minehunt/game-engine';

/** Donde se recuerda si el jugador quiere sonido. */
const CLAVE_ALMACENAMIENTO = 'minehunt.sonido';

/** Volumen general: los efectos acompanan, no tapan. */
const VOLUMEN = 0.22;

/**
 * Los sonidos del juego, sintetizados al vuelo con Web Audio.
 *
 * **No hay ni un fichero de audio en el repositorio**, y es a proposito: cuatro
 * efectos cortos salen de un oscilador y una envolvente, no hay que buscarles
 * licencia, no engordan el APK y suenan igual en el navegador y dentro del
 * WebView. Un dia que hagan falta samples de verdad, este servicio es el unico
 * sitio que hay que cambiar.
 *
 * Nada de esto puede tumbar una partida: si el navegador no trae Web Audio o
 * se niega a sonar, el juego sigue como si nada. Por eso todo va envuelto en
 * try/catch y el contexto se crea tarde, con el primer sonido, que para
 * entonces ya hubo un clic del jugador —los navegadores no dejan sonar antes—.
 */
@Injectable({ providedIn: 'root' })
export class ServicioSonido {
  private contexto: AudioContext | null = null;
  private readonly activoInterno = signal(leerGuardado());

  readonly activo = this.activoInterno.asReadonly();

  /** Enciende o apaga el sonido, y lo recuerda para la proxima vez. */
  alternar(): void {
    const nuevo = !this.activoInterno();
    this.activoInterno.set(nuevo);
    try {
      localStorage.setItem(CLAVE_ALMACENAMIENTO, nuevo ? 'si' : 'no');
    } catch {
      // Sin almacenamiento se juega igual, solo que no se recuerda.
    }
  }

  /**
   * Suena lo que acaba de pasar en la partida.
   *
   * Los codigos son los mismos que traduce la interfaz, asi que vale igual
   * para el Entrenamiento, la Historia y el Online.
   */
  reproducirSuceso(codigo: CodigoSuceso): void {
    switch (codigo) {
      case 'MINA_ENCONTRADA':
        this.detonacion();
        break;
      case 'CELDA_DESPEJADA':
        this.tono(660, 0.07, 'triangle');
        break;
      case 'ONDA_EXPANSIVA':
        this.barrido();
        break;
      case 'TURNO_PERDIDO':
        this.tono(300, 0.16, 'sine');
        this.tono(200, 0.22, 'sine', 0.12);
        break;
      case 'JUGADOR_RENDIDO':
        this.tono(220, 0.3, 'sine');
        break;
    }
  }

  /**
   * El toque de cualquier boton de la interfaz.
   *
   * Es corto y flojo a proposito: acompana al dedo, no compite con lo que pasa
   * en el tablero. Las celdas no pasan por aqui —tienen su propio sonido, que
   * dice ademas que salio de ese clic— y por eso quien lo dispara las excluye.
   */
  clicDeInterfaz(): void {
    this.tono(880, 0.05, 'triangle', 0, 0.45);
  }

  /** El final de la partida, que suena distinto segun como acabara. */
  reproducirFinal(gano: boolean): void {
    const notas = gano ? [523, 659, 784] : [392, 330, 262];
    notas.forEach((nota, paso) => {
      this.tono(nota, 0.18, 'triangle', paso * 0.11);
    });
  }

  /** La mina: un golpe de ruido con una caida grave debajo. */
  private detonacion(): void {
    const contexto = this.abrirContexto();
    if (contexto === null) {
      return;
    }

    try {
      const duracion = 0.35;
      const ruido = contexto.createBufferSource();
      ruido.buffer = this.ruidoBlanco(contexto, duracion);

      // El filtro es lo que convierte el siseo en un golpe: sin el suena a
      // radio mal sintonizada.
      const filtro = contexto.createBiquadFilter();
      filtro.type = 'lowpass';
      filtro.frequency.setValueAtTime(1800, contexto.currentTime);
      filtro.frequency.exponentialRampToValueAtTime(120, contexto.currentTime + duracion);

      const volumen = contexto.createGain();
      volumen.gain.setValueAtTime(VOLUMEN, contexto.currentTime);
      volumen.gain.exponentialRampToValueAtTime(0.0001, contexto.currentTime + duracion);

      ruido.connect(filtro).connect(volumen).connect(contexto.destination);
      ruido.start();
      ruido.stop(contexto.currentTime + duracion);
    } catch {
      // Un efecto que no suena no puede estropear una partida.
    }

    this.tono(90, 0.3, 'sine', 0, 0.6);
  }

  /** La onda expansiva: un barrido que se abre, como lo que hace en el tablero. */
  private barrido(): void {
    const contexto = this.abrirContexto();
    if (contexto === null) {
      return;
    }

    try {
      const duracion = 0.4;
      const oscilador = contexto.createOscillator();
      oscilador.type = 'sawtooth';
      oscilador.frequency.setValueAtTime(180, contexto.currentTime);
      oscilador.frequency.exponentialRampToValueAtTime(1200, contexto.currentTime + duracion);

      const filtro = contexto.createBiquadFilter();
      filtro.type = 'bandpass';
      filtro.frequency.setValueAtTime(600, contexto.currentTime);
      filtro.Q.setValueAtTime(2, contexto.currentTime);

      const volumen = contexto.createGain();
      volumen.gain.setValueAtTime(VOLUMEN * 0.7, contexto.currentTime);
      volumen.gain.exponentialRampToValueAtTime(0.0001, contexto.currentTime + duracion);

      oscilador.connect(filtro).connect(volumen).connect(contexto.destination);
      oscilador.start();
      oscilador.stop(contexto.currentTime + duracion);
    } catch {
      // Ver detonacion(): el sonido es opcional siempre.
    }
  }

  /** Una nota suelta con su envolvente, que es de lo que sale casi todo. */
  private tono(
    frecuencia: number,
    duracion: number,
    tipo: OscillatorType,
    retardo = 0,
    ganancia = 1,
  ): void {
    const contexto = this.abrirContexto();
    if (contexto === null) {
      return;
    }

    try {
      const empieza = contexto.currentTime + retardo;
      const oscilador = contexto.createOscillator();
      oscilador.type = tipo;
      oscilador.frequency.setValueAtTime(frecuencia, empieza);

      const volumen = contexto.createGain();
      // Empezar en 0 y subir evita el chasquido de arrancar a pleno volumen.
      volumen.gain.setValueAtTime(0.0001, empieza);
      volumen.gain.exponentialRampToValueAtTime(VOLUMEN * ganancia, empieza + 0.01);
      volumen.gain.exponentialRampToValueAtTime(0.0001, empieza + duracion);

      oscilador.connect(volumen).connect(contexto.destination);
      oscilador.start(empieza);
      oscilador.stop(empieza + duracion);
    } catch {
      // Ver detonacion().
    }
  }

  private ruidoBlanco(contexto: AudioContext, duracion: number): AudioBuffer {
    const muestras = Math.floor(contexto.sampleRate * duracion);
    const buffer = contexto.createBuffer(1, muestras, contexto.sampleRate);
    const datos = buffer.getChannelData(0);
    for (let indice = 0; indice < muestras; indice += 1) {
      datos[indice] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /**
   * El contexto de audio, creado la primera vez que hace falta.
   *
   * Devuelve null con el sonido apagado o sin Web Audio, y entonces quien
   * llama no hace nada.
   */
  private abrirContexto(): AudioContext | null {
    if (!this.activoInterno()) {
      return null;
    }

    if (this.contexto === null) {
      try {
        this.contexto = new AudioContext();
      } catch {
        return null;
      }
    }

    // El navegador puede haberlo dejado dormido: se despierta al primer sonido
    // que pida el jugador, que para entonces ya ha tocado la pantalla.
    if (this.contexto.state === 'suspended') {
      void this.contexto.resume().catch(() => undefined);
    }
    return this.contexto;
  }
}

/**
 * Si el jugador quiere sonido.
 *
 * Por defecto si: un juego suena, y apagarlo es un clic en el menu. Lo
 * guardado se valida como todo lo demas, que ese texto lo puede haber escrito
 * cualquiera.
 */
function leerGuardado(): boolean {
  try {
    return localStorage.getItem(CLAVE_ALMACENAMIENTO) !== 'no';
  } catch {
    return true;
  }
}
