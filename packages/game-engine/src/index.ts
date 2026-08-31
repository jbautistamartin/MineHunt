/**
 * Punto de entrada publico del motor de juego de MineHunt.
 *
 * Fase 0: solo el esqueleto. La logica del tablero (generacion, revelado,
 * cascada, turnos y marcador) llega en la Fase 1.
 */

/** Version del motor, util para comprobar que cliente y servidor comparten la misma. */
export const VERSION_MOTOR = '0.0.0';

/**
 * Saludo de comprobacion: confirma que el paquete compila, se exporta y se
 * puede consumir desde otros paquetes del monorepo.
 */
export function saludar(): string {
  return `MineHunt: motor de juego ${VERSION_MOTOR} listo`;
}
