import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  type OnDestroy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { MAX_JUGADORES, type Coordenada, type NivelIA } from '@minehunt/game-engine';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ResumenFinal } from '../../componentes/resumen-final/resumen-final';
import { Tablero } from '../../componentes/tablero/tablero';
import { ServicioCompartir } from '../../nucleo/compartir.servicio';
import { ServicioJugador } from '../../nucleo/jugador.servicio';
import { ServicioLocal } from '../../nucleo/local.servicio';
import { ServicioOnline } from '../../nucleo/online.servicio';
import { ServicioServidor } from '../../nucleo/servidor';
import { ServicioSonido } from '../../nucleo/sonido.servicio';
import { ServicioVibracion } from '../../nucleo/vibracion.servicio';

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
 * El multijugador: crear o entrar en una sala, esperar en el lobby y jugar la
 * partida.
 *
 * Las tres cosas en una pantalla porque son el mismo sitio visto en tres
 * momentos, y porque saltando de ruta se pierde de vista que la sala sigue
 * siendo la misma. Lo que manda es el estado que llega de quien tenga la sala:
 * aqui no se decide nada del juego.
 *
 * **Sirve a los dos modos.** En `/online` la sala vive en el servidor y en
 * `/local` en el telefono de al lado, y eso solo cambia la primera de las tres
 * partes —con quien se juega y como se le encuentra—; el lobby y la partida son
 * los mismos hasta el pixel. Lo dice el dato `modo` de la ruta, y `ServicioLocal`
 * se encarga de que `ServicioOnline` hable por la radio en vez de por el socket.
 *
 * El tablero es **el mismo componente** que el Entrenamiento y la Historia, y
 * las claves de los sucesos y de los errores tambien: lo unico que cambia es de
 * donde sale el estado.
 */
@Component({
  selector: 'mh-online',
  imports: [TranslatePipe, FormsModule, ResumenFinal, Tablero],
  templateUrl: './online.html',
  styleUrl: './online.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Online implements OnDestroy {
  private readonly online = inject(ServicioOnline);
  private readonly local = inject(ServicioLocal);
  private readonly servidor = inject(ServicioServidor);
  private readonly ruta = inject(ActivatedRoute);
  private readonly compartidor = inject(ServicioCompartir);
  private readonly traductor = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly sonido = inject(ServicioSonido);
  private readonly vibracion = inject(ServicioVibracion);
  private readonly jugador = inject(ServicioJugador);

  /**
   * Esta pantalla es la del Multijugador Local y no la del Online.
   *
   * Se lee una sola vez de la ruta: las dos son rutas distintas, asi que
   * cambiar de modo es cambiar de pantalla y el componente se monta de nuevo.
   */
  readonly esLocal = this.ruta.snapshot.data['modo'] === 'local';

  /** Se puede callar el juego sin salir de la partida. */
  readonly sonidoActivo = this.sonido.activo;

  /**
   * La vibracion se apaga desde la partida igual que el sonido, y por lo
   * mismo: se molesta jugando, no antes. Solo sale donde hay que vibrar.
   */
  readonly vibracionActiva = this.vibracion.activa;
  readonly hayVibracion = this.vibracion.disponibleEnElAparato;

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

  /** Partidas anunciandose ahi al lado; solo en el Multijugador Local. */
  readonly cercanas = this.local.cercanas;
  readonly buscandoCercanas = this.local.buscando;
  readonly permisosDeRadio = this.local.permisos;
  readonly falloDeRadio = this.local.fallo;
  /** El modo local solo existe en la aplicacion de Android. */
  readonly hayRadio = this.local.disponible;

  /** Se puede mandar el codigo por donde se hable con esa persona. */
  readonly sePuedeCompartir = this.compartidor.sePuedeCompartir;
  /** El codigo acaba de copiarse: se dice y se quita solo. */
  readonly copiado = signal(false);

  /**
   * Lo que el jugador escribe antes de entrar.
   *
   * Arranca con el nombre recordado: la credencial de la sala se olvida al
   * salir de ella, pero el nombre no tiene por que irse con la sala.
   */
  readonly nombre = signal(
    this.jugador.nombre() || (this.online.credencialGuardada()?.nombre ?? ''),
  );
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

  /**
   * En el Local todavia no se ha pedido el permiso de la radio.
   *
   * Mientras dure, la pantalla enseña para que sirve en lugar de una lista
   * vacia: la lista sin permiso esta vacia siempre, y eso no lo explica nadie.
   */
  readonly permisosPorPedir = computed(
    () => this.esLocal && this.permisosDeRadio() === 'sin-pedir',
  );

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

  /**
   * En Android la onda se lanza manteniendo el dedo sobre la celda: alli no
   * hay boton derecho, y el boton de la onda obliga a mirar fuera del tablero.
   *
   * Solo mientras hay onda que gastar: sin onda disponible, mantener el dedo
   * no tiene por que hacer nada distinto de un clic.
   */
  readonly pulsacionLargaLanzaOnda = computed(
    () =>
      Capacitor.isNativePlatform() &&
      this.puedeManejarOnda() &&
      this.miOnda()?.estado !== 'recargando',
  );

  /**
   * Nombre de cada jugador, en orden de puesto, para el resumen del final.
   *
   * Aqui no hay nada que traducir: son los nombres que se puso cada uno, y los
   * manda el servidor.
   */
  readonly nombresDeJugadores = computed(() =>
    (this.partida()?.jugadores ?? []).map((jugador) => this.nombreDe(jugador.id)),
  );

  /** El final ya sono: sin esto volveria a sonar a cada estado que llegara. */
  private finalSonado = false;

  constructor() {
    // Lo primero al abrir la pantalla: con quien se puede jugar. En el Online
    // eso es preguntarle al servidor que salas tiene —y de paso ver si esta
    // ahi antes de que nadie escriba ningun nombre—, y en el Local encender la
    // radio a buscar partidas cerca.
    void (this.esLocal ? this.prepararLocal() : this.actualizarSalas());

    // El nombre se recuerda segun se escribe, no al entrar en la sala: asi
    // tambien sobrevive lo que se tecleo sin llegar a jugar.
    effect(() => {
      this.jugador.recordar(this.nombre());
    });

    // Los sucesos que llegan del servidor suenan —y se notan— igual que los
    // de una partida local: son los mismos codigos.
    effect(() => {
      const suceso = this.ultimoSuceso();
      if (suceso !== null) {
        this.sonido.reproducirSuceso(suceso.codigo);
        this.vibracion.vibrarSuceso(suceso.codigo);
      }
    });

    // Aqui si se sabe quien mira la pantalla: gano si el ganador es su puesto.
    effect(() => {
      const partida = this.partida();
      if (partida === null || !partida.terminada) {
        this.finalSonado = false;
        return;
      }
      if (!this.finalSonado) {
        this.finalSonado = true;
        const gano = partida.ganador === this.puesto();
        this.sonido.reproducirFinal(gano);
        this.vibracion.vibrarFinal(gano);
      }
    });
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
    const configuracion = {
      ancho: this.ancho(),
      alto: this.alto(),
      minas: this.minas(),
      tiempoPorTurnoSegundos: this.tiempoPorTurno(),
      recargaOndaSegundos: this.recargaOnda(),
      publica: this.publica(),
      nivelesIA: this.nivelesIA(),
    };

    await this.conPaciencia(() =>
      this.esLocal
        ? this.local.abrir(this.nombre(), configuracion)
        : this.online.crearSala(this.nombre(), configuracion),
    );
  }

  /**
   * Al abrir el Multijugador Local **no se pide ningun permiso todavia**.
   *
   * Si ya estaban concedidos se empieza a buscar en el acto, y si no, la
   * pantalla explica para que son y espera a que el jugador toque el boton. El
   * dialogo del sistema sale entonces, con la explicacion ya leida.
   */
  private async prepararLocal(): Promise<void> {
    if (await this.local.comprobarPermisos()) {
      await this.buscarCercanas();
    }
  }

  /** Vuelve a barrer la radio en busca de partidas cerca. */
  async buscarCercanas(): Promise<void> {
    this.cargandoSalas.set(true);
    try {
      await this.local.buscar();
    } finally {
      this.cargandoSalas.set(false);
    }
  }

  /** Entra en una de las partidas que la radio encontro al lado. */
  async entrarEnCercana(id: string): Promise<void> {
    await this.conPaciencia(() => this.local.unirse(id, this.nombre()));
  }

  /**
   * El jugador se cansa de esperar al servidor.
   *
   * `conPaciencia` apaga `ocupado` solo, en cuanto la peticion cancelada
   * termina, asi que aqui no hay que tocarlo.
   */
  cancelarEspera(): void {
    this.online.cancelarEspera();
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

  /**
   * Deja la sala y vuelve al menu principal.
   *
   * En el Local se apaga ademas la radio, y con ella la sala si era este
   * telefono el que la tenia: alli no hay servidor que la siga guardando.
   */
  async salir(): Promise<void> {
    await this.online.salir();
    if (this.esLocal) {
      await this.local.cerrar();
    }
    await this.router.navigate(['/']);
  }

  /**
   * Irse de la pantalla por donde sea —el boton de atras tambien— apaga la
   * radio.
   *
   * Sin esto el telefono sigue anunciando una partida que ya no se esta
   * jugando, gastando bateria y apareciendo en la lista de los demas.
   */
  ngOnDestroy(): void {
    if (this.esLocal) {
      void this.local.cerrar();
    }
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

  alternarSonido(): void {
    this.sonido.alternar();
  }

  alternarVibracion(): void {
    this.vibracion.alternar();
  }
}
