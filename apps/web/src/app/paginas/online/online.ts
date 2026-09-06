import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MAX_JUGADORES, type Coordenada, type NivelIA } from '@minehunt/game-engine';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { Tablero } from '../../componentes/tablero/tablero';
import { ServicioCompartir } from '../../nucleo/compartir.servicio';
import { ServicioOnline } from '../../nucleo/online.servicio';
import { ServicioServidor } from '../../nucleo/servidor';

/** A partir de aqui la cuenta atras del turno se pinta en rojo. */
const SEGUNDOS_DE_AVISO = 5;

/** Lo que se queda puesto el «copiado» despues de copiar. */
const AVISO_DE_COPIADO_MS = 2000;

/** Limites del tablero, los mismos que valida el servidor. */
const LADO_MINIMO = 4;
const LADO_MAXIMO = 30;

/** Con lo que arranca el formulario, igual que la sala por defecto. */
const AJUSTES_INICIALES = {
  ancho: 10,
  alto: 8,
  minas: 12,
  tiempoPorTurnoSegundos: 20,
  recargaOndaSegundos: 30,
} as const;

/**
 * El Multijugador Online: crear o entrar en una sala, esperar en el lobby y
 * jugar la partida.
 *
 * Las tres cosas en una pantalla porque son el mismo sitio visto en tres
 * momentos, y porque saltando de ruta se pierde de vista que la sala sigue
 * siendo la misma. Lo que manda es el estado que llega del servidor: aqui no
 * se decide nada del juego.
 *
 * El tablero es **el mismo componente** que el Entrenamiento y la Historia, y
 * las claves de los sucesos y de los errores tambien: lo unico que cambia es de
 * donde sale el estado.
 */
@Component({
  selector: 'mh-online',
  imports: [TranslatePipe, FormsModule, Tablero],
  templateUrl: './online.html',
  styleUrl: './online.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Online {
  private readonly online = inject(ServicioOnline);
  private readonly servidor = inject(ServicioServidor);
  private readonly compartidor = inject(ServicioCompartir);
  private readonly traductor = inject(TranslateService);
  private readonly router = inject(Router);

  readonly conexion = this.online.conexion;
  readonly sala = this.online.sala;
  readonly partida = this.online.partida;
  readonly puesto = this.online.puesto;
  readonly esMiTurno = this.online.esMiTurno;
  readonly miOnda = this.online.miOnda;
  readonly segundosDeRecarga = this.online.segundosDeRecarga;
  readonly segundosDeTurno = this.online.segundosDeTurno;
  readonly ultimoSuceso = this.online.ultimoSuceso;
  readonly ultimoError = this.online.ultimoError;
  readonly salasAbiertas = this.online.salasAbiertas;

  /** Se puede mandar el codigo por donde se hable con esa persona. */
  readonly sePuedeCompartir = this.compartidor.sePuedeCompartir;
  /** El codigo acaba de copiarse: se dice y se quita solo. */
  readonly copiado = signal(false);

  /** Lo que el jugador escribe antes de entrar. */
  readonly nombre = signal(this.online.credencialGuardada()?.nombre ?? '');
  readonly codigo = signal('');

  /**
   * Ajustes de la sala que se va a crear.
   *
   * Son los mismos que los del Modo Entrenamiento y con los mismos textos: el
   * que ya sabe montar una partida local no tiene que aprender nada nuevo.
   */
  readonly ancho = signal<number>(AJUSTES_INICIALES.ancho);
  readonly alto = signal<number>(AJUSTES_INICIALES.alto);
  readonly minas = signal<number>(AJUSTES_INICIALES.minas);
  readonly tiempoPorTurno = signal<number>(AJUSTES_INICIALES.tiempoPorTurnoSegundos);
  readonly recargaOnda = signal<number>(AJUSTES_INICIALES.recargaOndaSegundos);
  readonly publica = signal(true);
  readonly nivelesIA = signal<readonly NivelIA[]>([]);
  readonly ajustandoSala = signal(false);

  readonly ladoMinimo = LADO_MINIMO;
  readonly ladoMaximo = LADO_MAXIMO;
  readonly maxBots = MAX_JUGADORES - 1;
  readonly niveles: readonly NivelIA[] = [1, 2, 3, 4, 5];
  readonly urlDelServidor = signal(this.servidor.url());
  readonly ajustandoServidor = signal(false);
  readonly confirmandoRendicion = signal(false);
  /** Hay una peticion en marcha: los botones se apagan mientras tanto. */
  readonly ocupado = signal(false);
  /**
   * La lista de salas va y viene por su cuenta.
   *
   * No usa `ocupado` a proposito: es lo primero que se pide al abrir la
   * pantalla, y si el servidor no contesta no puede dejar apagado el boton de
   * crear una sala, que es justo lo que uno intentaria a continuacion.
   */
  readonly cargandoSalas = signal(false);

  readonly hayCredencial = this.online.hayCredencial;

  readonly totalCeldas = computed(() => this.ancho() * this.alto());
  /** Al menos una celda sin mina: la primera que se clica. */
  readonly minasMaximas = computed(() => Math.max(1, this.totalCeldas() - 1));
  readonly densidad = computed(() =>
    Math.round((this.minas() / Math.max(1, this.totalCeldas())) * 100),
  );

  readonly ajustesValidos = computed(
    () =>
      this.ancho() >= LADO_MINIMO &&
      this.ancho() <= LADO_MAXIMO &&
      this.alto() >= LADO_MINIMO &&
      this.alto() <= LADO_MAXIMO &&
      this.minas() >= 1 &&
      this.minas() <= this.minasMaximas(),
  );

  readonly puedeCrear = computed(
    () => this.nombre().trim().length > 0 && this.ajustesValidos() && !this.ocupado(),
  );

  /** El servidor no contesta: sin esto la pantalla se queda en blanco. */
  readonly sinServidor = computed(() => this.conexion() === 'caido' && this.sala() === null);

  readonly enLobby = computed(() => this.sala()?.estado === 'lobby');
  readonly enPartida = computed(() => this.sala() !== null && this.partida() !== null);
  readonly terminada = computed(() => this.partida()?.terminada ?? false);

  readonly soyAnfitrion = computed(() => this.puesto() === 0);

  /** Con menos de dos no se puede empezar; lo dice tambien el servidor. */
  readonly faltaGente = computed(() => (this.sala()?.puestos.length ?? 0) < 2);

  readonly relojApurado = computed(() => {
    const segundos = this.segundosDeTurno();
    return segundos !== null && segundos <= SEGUNDOS_DE_AVISO;
  });

  readonly porcentajeDeTurno = computed(() =>
    Math.round((this.online.fraccionDeTurno() ?? 0) * 100),
  );

  /** El boton de la onda solo tiene sentido en el propio turno. */
  readonly puedeManejarOnda = computed(
    () => !this.terminada() && this.esMiTurno() && this.miOnda() !== null,
  );

  /** Clasificacion ordenada para el marcador de fin de partida. */
  readonly clasificacion = computed(() =>
    [...(this.partida()?.jugadores ?? [])].sort(
      (a, b) => b.minasEncontradas - a.minasEncontradas,
    ),
  );

  constructor() {
    // Lo primero al abrir la pantalla: que salas hay. De paso se ve si el
    // servidor esta ahi antes de que nadie escriba ningun nombre.
    void this.actualizarSalas();
  }

  /** Nombre con el que se conoce a un puesto; el del servidor manda. */
  nombreDe(id: number): string {
    return this.sala()?.puestos[id]?.nombre ?? '';
  }

  /** Ese puesto lo ocupa un bot desde el principio, no una persona caida. */
  esBot(id: number): boolean {
    return this.sala()?.puestos[id]?.bot ?? false;
  }

  /** Ese puesto se cayo y le esta jugando un bot. */
  sustituido(id: number): boolean {
    return this.sala()?.puestos[id]?.sustituido ?? false;
  }

  conectado(id: number): boolean {
    return this.sala()?.puestos[id]?.conectado ?? false;
  }

  segundosDeRecargaDe(milisegundos: number): number {
    return Math.ceil(milisegundos / 1000);
  }

  /** Vuelve a preguntar que salas estan esperando gente. */
  async actualizarSalas(): Promise<void> {
    this.cargandoSalas.set(true);
    try {
      await this.online.pedirSalasAbiertas();
    } finally {
      this.cargandoSalas.set(false);
    }
  }

  /** Entra en una de las salas de la lista, sin teclear el codigo. */
  async entrarEn(codigo: string): Promise<void> {
    this.codigo.set(codigo);
    await this.unirse();
  }

  /** Copia el codigo de la sala: no se puede seleccionar con el dedo. */
  async copiarCodigo(): Promise<void> {
    const codigo = this.sala()?.codigo ?? '';
    if (await this.compartidor.copiar(codigo)) {
      this.copiado.set(true);
      setTimeout(() => {
        this.copiado.set(false);
      }, AVISO_DE_COPIADO_MS);
    }
  }

  /** Abre la hoja de compartir del sistema con el codigo dentro. */
  async compartirCodigo(): Promise<void> {
    const codigo = this.sala()?.codigo ?? '';
    await this.compartidor.compartir(
      this.traductor.instant('online.compartir.titulo') as string,
      this.traductor.instant('online.compartir.texto', { codigo }) as string,
    );
  }

  alternarAjustesDeSala(): void {
    this.ajustandoSala.update((abierto) => !abierto);
  }

  cambiarNumero(senal: { set: (valor: number) => void }, valor: string): void {
    const numero = Number.parseInt(valor, 10);
    if (Number.isInteger(numero)) {
      senal.set(numero);
    }
  }

  /** Sienta un bot mas, si es que cabe. */
  anadirBot(): void {
    if (this.nivelesIA().length < this.maxBots) {
      this.nivelesIA.update((niveles) => [...niveles, 3]);
    }
  }

  quitarBot(indice: number): void {
    this.nivelesIA.update((niveles) => niveles.filter((_nivel, puesto) => puesto !== indice));
  }

  cambiarNivelDeBot(indice: number, valor: string): void {
    const nivel = Number.parseInt(valor, 10) as NivelIA;
    this.nivelesIA.update((niveles) =>
      niveles.map((anterior, puesto) => (puesto === indice ? nivel : anterior)),
    );
  }

  async crearSala(): Promise<void> {
    await this.conPaciencia(() =>
      this.online.crearSala(this.nombre(), {
        ancho: this.ancho(),
        alto: this.alto(),
        minas: this.minas(),
        tiempoPorTurnoSegundos: this.tiempoPorTurno(),
        recargaOndaSegundos: this.recargaOnda(),
        publica: this.publica(),
        nivelesIA: this.nivelesIA(),
      }),
    );
  }

  async unirse(): Promise<void> {
    await this.conPaciencia(() => this.online.unirse(this.codigo(), this.nombre()));
  }

  /** Vuelve a la sala que quedo a medias, si el servidor todavia la guarda. */
  async volverALaSala(): Promise<void> {
    await this.conPaciencia(() => this.online.volverALaSala());
  }

  async empezar(): Promise<void> {
    await this.conPaciencia(() => this.online.empezar());
  }

  async jugar(coordenada: Coordenada): Promise<void> {
    await this.online.clic(coordenada.x, coordenada.y);
  }

  /** Boton derecho: la onda se lanza sobre esa celda directamente. */
  async jugarConOnda(coordenada: Coordenada): Promise<void> {
    await this.online.clicConOnda(coordenada.x, coordenada.y);
  }

  async alternarOnda(): Promise<void> {
    await this.online.onda(this.miOnda()?.estado !== 'activo');
  }

  pedirRendicion(): void {
    this.confirmandoRendicion.set(true);
  }

  cancelarRendicion(): void {
    this.confirmandoRendicion.set(false);
  }

  async confirmarRendicion(): Promise<void> {
    this.confirmandoRendicion.set(false);
    await this.online.rendirse();
  }

  /** Terminada la partida, la sala vuelve al lobby para jugar otra. */
  async otraPartida(): Promise<void> {
    await this.conPaciencia(() => this.online.otraPartida());
  }

  /** Deja la sala y vuelve al menu principal. */
  async salir(): Promise<void> {
    await this.online.salir();
    await this.router.navigate(['/']);
  }

  alternarAjusteDelServidor(): void {
    this.urlDelServidor.set(this.servidor.url());
    this.ajustandoServidor.update((abierto) => !abierto);
  }

  /** Guarda a que servidor se juega; false si la direccion no valia. */
  guardarServidor(): boolean {
    const guardada = this.servidor.cambiar(this.urlDelServidor());
    if (guardada) {
      this.ajustandoServidor.set(false);
    }
    return guardada;
  }

  restablecerServidor(): void {
    this.servidor.restablecer();
    this.urlDelServidor.set(this.servidor.url());
  }

  /** Apaga los botones mientras la peticion va y vuelve. */
  private async conPaciencia(accion: () => Promise<unknown>): Promise<void> {
    this.ocupado.set(true);
    try {
      await accion();
    } finally {
      this.ocupado.set(false);
    }
  }
}
