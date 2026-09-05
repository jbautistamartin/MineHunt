/**
 * Las dos cosas del mundo exterior de las que depende una partida: el reloj y
 * el azar.
 *
 * Van inyectadas por lo mismo que en el motor. El servidor es la autoridad,
 * asi que su reloj es el bueno y su azar el que coloca las minas; y en las
 * pruebas los dos se sustituyen por otros que no se mueven, que es la unica
 * forma de comprobar un turno perdido por tiempo o de saber donde cayo cada
 * mina sin mirar donde no se debe.
 */

/** Milisegundos desde la epoca, como Date.now(). */
export type Reloj = () => number;

/** Numero en [0, 1), como Math.random(). */
export type Azar = () => number;

export const RELOJ = Symbol('reloj del servidor');
export const AZAR = Symbol('azar del servidor');
