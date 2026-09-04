import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { CodigoSuceso, Coordenada } from '@minehunt/game-engine';
import { TranslatePipe } from '@ngx-translate/core';

import { Tablero } from '../../componentes/tablero/tablero';
import { ServicioBotonAtras } from '../../nucleo/atras.servicio';
import { JUGADOR_HUMANO, ServicioHistoria } from '../../nucleo/historia.servicio';
import { ServicioPartida, type UltimoSuceso } from '../../nucleo/partida.servicio';

/** A partir de aqui la cuenta atras del turno se pinta en rojo. */
const SEGUNDOS_DE_AVISO = 5;

/**
 * Sucesos cuyo texto lleva la cuenta de celdas, que son los unicos que
 * necesitan una version en singular.
 *
 * MINA_ENCONTRADA se queda fuera aunque revele una sola celda: su texto no la
 * cuenta.
 */
const SUCESOS_QUE_CUENTAN: readonly CodigoSuceso[] = ['CELDA_DESPEJADA', 'ONDA_EXPANSIVA'];

/**
 * Clave del texto de un suceso, en singular cuando lo que se cuenta es una
 * sola celda.
 *
 * Hace falta porque no hay cascada automatica: un clic normal destapa siempre
 * una celda, asi que «ha despejado 1 celdas» salia en cada jugada.
 * @ngx-translate no trae plurales, de ahi el sufijo.
 */
export function claveDeSuceso(suceso: UltimoSuceso): string {
  const una = suceso.celdas === 1 && SUCESOS_QUE_CUENTAN.includes(suceso.codigo);
  return `partida.evento.${suceso.codigo}${una ? '_UNA' : ''}`;
}

/**
 * Pantalla de juego, la misma para el Entrenamiento y para la Historia.
 *
 * Los humanos comparten dispositivo y el turno va rotando (hotseat); los
 * puestos que lleva la IA juegan solos.
 *
 * La misma pantalla sirve para el Modo Historia: cuando la partida es la de un
 * nivel, la cabecera lo dice y el final ofrece pasar al siguiente en lugar de
 * volver a la configuracion del Entrenamiento. Quien apunta el resultado es
 * ServicioHistoria, que vigila el estado por su cuenta.
 */
@Component({
  selector: 'mh-partida',
  imports: [TranslatePipe, Tablero],
  templateUrl: './partida.html',
  styleUrl: './partida.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Partida {
  private readonly servicio = inject(ServicioPartida);
  private readonly historia = inject(ServicioHistoria);
  private readonly atras = inject(ServicioBotonAtras);
  private readonly router = inject(Router);

  readonly estado = this.servicio.estado;
  readonly ultimoSuceso = this.servicio.ultimoSuceso;
  readonly ultimoError = this.servicio.ultimoError;
  readonly esTurnoDeBot = this.servicio.esTurnoDeBot;
  readonly ondaDelTurno = this.servicio.ondaDelTurno;
  readonly segundosDeRecarga = this.servicio.segundosDeRecarga;
  readonly segundosDeTurno = this.servicio.segundosDeTurno;
  readonly fraccionDeTurno = this.servicio.fraccionDeTurno;
  readonly soloMiran = this.servicio.soloMiran;

  /** La funcion de arriba, para que la plantilla pueda llamarla. */
  readonly claveDeSuceso = claveDeSuceso;

  /** Rendirse es irreversible, asi que se pide confirmacion. */
  readonly confirmandoRendicion = signal(false);

  /**
   * Dejar la partida a medias con el boton de atras del telefono tambien se
   * pregunta: es un gesto que se hace sin mirar y se lleva la partida por
   * delante. El de la pantalla no, porque hay que ir a buscarlo.
   */
  readonly confirmandoSalida = signal(false);

  /** Ultimos segundos del turno: la barra avisa cambiando de color. */
  readonly relojApurado = computed(() => {
    const segundos = this.segundosDeTurno();
    return segundos !== null && segundos <= SEGUNDOS_DE_AVISO;
  });

  /** Ancho de la barra del reloj, en porcentaje. */
  readonly porcentajeDeTurno = computed(() =>
    Math.round((this.fraccionDeTurno() ?? 0) * 100),
  );

  /** El boton de la onda solo tiene sentido en el turno de un humano. */
  readonly puedeManejarOnda = computed(
    () => !this.terminada() && !this.esTurnoDeBot() && this.ondaDelTurno() !== null,
  );

  /**
   * Hay alguien a quien rendir: el humano de turno o, si es el unico humano de
   * la mesa, el aunque en ese momento este pensando un bot.
   */
  readonly puedeRendirse = computed(() => this.servicio.humanoQuePuedeRendirse() !== null);

  /**
   * «Abandonar» tira la partida entera y vuelve por donde se entro.
   *
   * Con dos jugadores no se enseña mientras se pueda rendir: rendirse deja al
   * rival solo, con lo que la partida termina igual, pero ademas destapa el
   * tablero y enseña el marcador final. Teniendo los dos botones, eran dos
   * formas de lo mismo. Con tres o mas si son cosas distintas —rendirse deja
   * la partida viva y a quien se rinde de espectador— y con la mesa entera de
   * bots, donde no hay a quien rendir, es la unica salida.
   *
   * Con la partida terminada no sale ninguno de los dos: de ahi se sale por el
   * recuadro del final, que ya ofrece revancha, nivel siguiente o volver.
   */
  readonly puedeAbandonar = computed(
    () =>
      !this.terminada() &&
      ((this.estado()?.jugadores.length ?? 0) > 2 || !this.puedeRendirse()),
  );

  readonly terminada = computed(() => this.estado()?.terminada ?? false);

  /** Nivel de Historia que se esta jugando, o null si es Entrenamiento. */
  readonly nivelHistoria = this.historia.nivelEnCurso;

  /** El nivel se ha superado: partida terminada y ganada por el humano. */
  readonly nivelSuperado = computed(() => {
    const estado = this.estado();
    return (
      this.nivelHistoria() !== null &&
      (estado?.terminada ?? false) &&
      !estado?.empate &&
      estado?.ganador === JUGADOR_HUMANO
    );
  });

  /** Nivel al que se pasa tras superar este, o null si era el ultimo. */
  readonly siguienteNivel = computed(() => {
    const nivel = this.nivelHistoria();
    return nivel === null ? null : this.historia.siguienteDe(nivel.numero);
  });

  /** Clasificacion ordenada para el marcador de fin de partida. */
  readonly clasificacion = computed(() =>
    [...(this.estado()?.jugadores ?? [])].sort(
      (a, b) => b.minasEncontradas - a.minasEncontradas,
    ),
  );

  constructor() {
    // Si se entra a /partida sin partida en curso (recarga o enlace directo),
    // se vuelve al menu principal en lugar de mostrar una pantalla vacia.
    effect(() => {
      if (!this.servicio.hayPartida()) {
        void this.router.navigate(['/']);
      }
    });

    // El boton de atras solo pide salir; quien sabe si hay algo que perder es
    // esta pantalla. Con la partida ya terminada no hay nada que preguntar.
    effect(() => {
      if (!this.atras.salidaPedida()) {
        return;
      }
      this.atras.salidaAtendida();
      if (this.terminada()) {
        this.abandonar();
      } else {
        this.confirmandoSalida.set(true);
      }
    });
  }

  /** Deja la partida de verdad: es lo mismo que el boton de abandonar. */
  confirmarSalida(): void {
    this.confirmandoSalida.set(false);
    this.abandonar();
  }

  cancelarSalida(): void {
    this.confirmandoSalida.set(false);
  }

  jugar(coordenada: Coordenada): void {
    this.servicio.clicEnCelda(coordenada.x, coordenada.y);
  }

  /** Boton derecho: la onda expansiva se lanza sobre esa celda directamente. */
  jugarConOnda(coordenada: Coordenada): void {
    this.servicio.clicConOnda(coordenada.x, coordenada.y);
  }

  /** Primer paso: enseña la confirmacion en lugar de rendirse de golpe. */
  pedirRendicion(): void {
    this.confirmandoRendicion.set(true);
  }

  cancelarRendicion(): void {
    this.confirmandoRendicion.set(false);
  }

  confirmarRendicion(): void {
    this.confirmandoRendicion.set(false);
    this.servicio.rendirse();
  }

  /** Arma o desarma la onda expansiva antes de clicar. */
  alternarOnda(): void {
    if (this.ondaDelTurno()?.estado === 'activo') {
      this.servicio.desactivarOnda();
    } else {
      this.servicio.activarOnda();
    }
  }

  revancha(): void {
    this.confirmandoRendicion.set(false);
    this.servicio.revancha();
  }

  /**
   * Deja la partida y vuelve por donde se entro: al mapa de niveles si es
   * Historia y a la configuracion si es Entrenamiento, que es desde donde se
   * monta otra.
   *
   * Se navega antes de descartar la partida por lo mismo que en volverAlMapa:
   * el effect que vigila que no haya partida devolveria al menu principal.
   */
  abandonar(): void {
    if (this.nivelHistoria() !== null) {
      this.volverAlMapa();
      return;
    }
    void this.router.navigate(['/entrenamiento']).then(() => {
      this.servicio.abandonar();
    });
  }

  /** Entra directamente al nivel siguiente, sin pasar por el mapa. */
  jugarSiguienteNivel(): void {
    const siguiente = this.siguienteNivel();
    if (siguiente !== null) {
      this.confirmandoRendicion.set(false);
      this.historia.jugar(siguiente);
    }
  }

  /**
   * Deja el nivel y vuelve al mapa.
   *
   * Se navega antes de descartar la partida: al salir de la pantalla se
   * destruye tambien el effect que devuelve al menu cuando no hay partida, que
   * si no se llevaria por delante este destino.
   */
  volverAlMapa(): void {
    void this.router.navigate(['/historia']).then(() => {
      this.historia.salir();
    });
  }

  /** Los jugadores se numeran desde 1 de cara al jugador. */
  numeroDe(idJugador: number): number {
    return idJugador + 1;
  }

  esBot(idJugador: number): boolean {
    return this.servicio.esBot(idJugador);
  }

  /** Nivel del bot que ocupa ese puesto, o null si es humano. */
  nivelDeBot(idJugador: number): number | null {
    return this.servicio.nivelDeBot(idJugador);
  }

  /**
   * Segundos que le faltan a ese jugador para recuperar su onda.
   * Se muestra en el marcador para poder vigilar tambien la de los rivales.
   */
  segundosDeRecargaDe(recargaRestanteMs: number): number {
    return Math.ceil(recargaRestanteMs / 1000);
  }

  /**
   * Clave de traduccion del nombre de un jugador.
   * Los puestos de la IA se llaman "Bot" para distinguirlos de un vistazo.
   */
  claveNombre(idJugador: number): string {
    return this.servicio.esBot(idJugador) ? 'partida.bot' : 'partida.jugador';
  }
}
