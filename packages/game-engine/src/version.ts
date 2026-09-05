/**
 * Version del motor, que es tambien la del protocolo de las partidas online.
 *
 * Vive en su propio modulo porque la necesitan tanto el indice como
 * `red/protocolo.ts`, y si la tuviera el indice el protocolo tendria que
 * importar de quien le importa a el.
 *
 * **Al subirla, sube tambien la del `package.json` del paquete y la de
 * `index.prueba.ts`**, que compara las tres.
 */
export const VERSION_MOTOR = '0.7.0';
