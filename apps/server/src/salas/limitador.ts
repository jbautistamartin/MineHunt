/**
 * Cuantos mensajes se le admiten a una conexion antes de cortarle.
 *
 * Jugando esto no se toca: un clic por turno, y un turno no baja del medio
 * segundo. Existe porque **un cliente manipulado no juega**: puede mandar
 * mensajes en bucle, y como cada uno mueve el motor y difunde a toda la sala,
 * quien esta dentro de esa sala se queda sin partida.
 *
 * Es una ventana deslizante sencilla: se guardan las marcas de tiempo del
 * ultimo segundo y se cuentan. Con un tope de veinte son veinte numeros por
 * conexion, asi que no hace falta nada mas fino; un cubo de fichas ahorraria
 * memoria que aqui no falta y se leeria peor.
 *
 * **El reloj se inyecta**, como en todo el resto del proyecto: sin eso, probar
 * que el limite se suelta al segundo siguiente pediria esperar un segundo de
 * verdad en cada prueba.
 */
export class LimitadorDeRitmo {
  /** Marcas de los mensajes recientes de cada conexion. */
  private readonly recientes = new Map<string, number[]>();

  constructor(
    private readonly maxPorSegundo: number,
    private readonly ahora: () => number,
  ) {}

  /**
   * Apunta un mensaje de esa conexion y dice si se le deja pasar.
   *
   * El rechazado **no se apunta**: si contara, a quien se pasa de la raya le
   * bastaria con seguir insistiendo para no salir nunca de la ventana, y el
   * castigo duraria mientras insistiera.
   */
  admite(conexion: string): boolean {
    const ahora = this.ahora();
    const desde = ahora - 1000;

    const marcas = (this.recientes.get(conexion) ?? []).filter((marca) => marca > desde);
    if (marcas.length >= this.maxPorSegundo) {
      this.recientes.set(conexion, marcas);
      return false;
    }

    marcas.push(ahora);
    this.recientes.set(conexion, marcas);
    return true;
  }

  /** Se fue la conexion: sus marcas no le sirven ya a nadie. */
  olvidar(conexion: string): void {
    this.recientes.delete(conexion);
  }
}
