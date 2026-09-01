/**
 * Version de la aplicacion web, la que se enseña al jugador.
 *
 * Va a mano y no importada de package.json: traerse el package.json al bundle
 * por un solo string no compensa. Lo que evita que se quede atras es
 * `version.prueba.ts`, que falla si deja de coincidir con el package.json.
 *
 * No es la version del motor de juego (`VERSION_MOTOR`), que va por su cuenta.
 */
export const VERSION_APP = '0.0.1';
