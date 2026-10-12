/**
 * Version de la aplicacion web, la que se enseña al jugador.
 *
 * Va a mano y no importada de package.json: traerse el package.json al bundle
 * por un solo string no compensa. Lo que evita que se quede atras es
 * `version.prueba.ts`, que falla si deja de coincidir con el package.json.
 *
 * **La version del motor va a la par con esta**: `VERSION_MOTOR` es tambien
 * `VERSION_PROTOCOLO`, con la que cliente y servidor comprueban que se
 * entienden, y llevarlas separadas obligaba a mirar dos numeros para saber que
 * hablaba con que. Al subir una version se suben las dos, y `version.prueba.ts`
 * falla si dejan de coincidir.
 */
export const VERSION_APP = '1.0.1';
