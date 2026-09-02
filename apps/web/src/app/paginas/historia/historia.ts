import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NIVELES_POR_ZONA, TOTAL_ZONAS, type NivelHistoria } from '@minehunt/game-engine';
import { TranslatePipe } from '@ngx-translate/core';

import { ServicioHistoria } from '../../nucleo/historia.servicio';

/** Un nivel con el estado en que lo ve el jugador, listo para pintar. */
interface NivelPintado {
  readonly nivel: NivelHistoria;
  readonly superado: boolean;
  readonly desbloqueado: boolean;
}

/** Los niveles de una zona, con el numero de zona que los agrupa. */
interface ZonaPintada {
  readonly numero: number;
  readonly niveles: readonly NivelPintado[];
  /** La zona esta abierta si al menos uno de sus niveles lo esta. */
  readonly abierta: boolean;
}

/**
 * Pantalla de seleccion de niveles del Modo Historia.
 *
 * Ensena los cincuenta niveles agrupados en zonas, con los superados marcados
 * y los que aun no tocan bloqueados, y deja ver de que va un nivel antes de
 * entrar: tablero, minas, rivales y reloj. Solo se avanza ganando, asi que el
 * ultimo desbloqueado es el que hay que sacar.
 *
 * No habla con el motor: eso lo hace ServicioHistoria a traves de
 * ServicioPartida, como el resto de las pantallas.
 */
@Component({
  selector: 'mh-historia',
  imports: [TranslatePipe, RouterLink],
  templateUrl: './historia.html',
  styleUrl: './historia.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Historia {
  private readonly historia = inject(ServicioHistoria);
  private readonly router = inject(Router);

  readonly totalNiveles = this.historia.totalNiveles;
  readonly totalSuperados = this.historia.totalSuperados;
  readonly completada = this.historia.completada;
  readonly nivelesPorZona = NIVELES_POR_ZONA;

  /** Borrar el progreso no se puede deshacer, asi que se pregunta antes. */
  readonly confirmandoReinicio = signal(false);

  /** Nivel del que se estan mirando los detalles, o null si no hay ninguno. */
  private readonly elegido = signal<NivelHistoria | null>(null);

  /**
   * Nivel seleccionado: el que se este mirando o, mientras no se toque nada,
   * el ultimo desbloqueado, que es donde se quedo la partida.
   */
  readonly seleccionado = computed<NivelHistoria | null>(
    () => this.elegido() ?? this.historia.niveles[this.historia.progreso().desbloqueado - 1] ?? null,
  );

  /** Los cincuenta niveles repartidos por zonas, con su estado. */
  readonly zonas = computed<readonly ZonaPintada[]>(() =>
    Array.from({ length: TOTAL_ZONAS }, (_valor, indice) => {
      const numero = indice + 1;
      const niveles = this.historia.niveles
        .filter((nivel) => nivel.zona === numero)
        .map((nivel) => ({
          nivel,
          superado: this.historia.estaSuperado(nivel.numero),
          desbloqueado: this.historia.estaDesbloqueado(nivel.numero),
        }));

      return { numero, niveles, abierta: niveles.some((pintado) => pintado.desbloqueado) };
    }),
  );

  /** Se puede entrar al nivel que se esta mirando. */
  readonly puedeJugar = computed(() => {
    const nivel = this.seleccionado();
    return nivel !== null && this.historia.estaDesbloqueado(nivel.numero);
  });

  /** Ese nivel ya se gano alguna vez: entrar seria rejugarlo. */
  readonly seleccionadoSuperado = computed(() => {
    const nivel = this.seleccionado();
    return nivel !== null && this.historia.estaSuperado(nivel.numero);
  });

  /** Porcentaje de niveles superados, para la barra de progreso. */
  readonly porcentaje = computed(() =>
    Math.round((this.totalSuperados() / this.totalNiveles) * 100),
  );

  /** Cuantas celdas tiene el tablero del nivel que se esta mirando. */
  readonly celdasDelNivel = computed(() => {
    const nivel = this.seleccionado();
    return nivel === null ? 0 : nivel.ancho * nivel.alto;
  });

  /** Proporcion de minas del nivel elegido, en porcentaje. */
  readonly densidadDelNivel = computed(() => {
    const nivel = this.seleccionado();
    return nivel === null ? 0 : Math.round((nivel.minas / (nivel.ancho * nivel.alto)) * 100);
  });

  /** Niveles de IA de los rivales del nivel elegido, para listarlos. */
  readonly rivalesDelNivel = computed(() =>
    (this.seleccionado()?.rivales ?? []).map((nivelIA, indice) => ({
      idJugador: indice + 1,
      nivelIA,
    })),
  );

  seleccionar(nivel: NivelHistoria): void {
    this.elegido.set(nivel);
  }

  /** Entra al nivel elegido: monta la partida y salta a la pantalla de juego. */
  jugar(): void {
    const nivel = this.seleccionado();
    if (nivel === null || !this.historia.jugar(nivel)) {
      return;
    }
    void this.router.navigate(['/partida']);
  }

  pedirReinicio(): void {
    this.confirmandoReinicio.set(true);
  }

  cancelarReinicio(): void {
    this.confirmandoReinicio.set(false);
  }

  confirmarReinicio(): void {
    this.confirmandoReinicio.set(false);
    this.historia.reiniciarProgreso();
    this.elegido.set(null);
  }
}
