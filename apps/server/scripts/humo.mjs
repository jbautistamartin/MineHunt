/**
 * Comprobacion de humo contra un servidor ya desplegado.
 *
 *     node scripts/humo.mjs https://minehunt.example
 *
 * Sin argumento va contra http://localhost:3000. Es lo que pide la Fase 9:
 * **que un cliente de verdad juegue una partida completa contra el servidor
 * desplegado**, y no solo contra la aplicacion levantada dentro de las
 * pruebas. Por eso habla por Socket.IO como habla la web, con el mismo
 * protocolo importado del motor, en lugar de mirar si el proceso responde.
 *
 * Comprueba tres cosas, en este orden: que se abre una sala y entran dos
 * jugadores, que la partida llega hasta el final destapando el tablero, y que
 * el limite de ritmo corta una rafaga —lo que anadio esta fase y lo unico de
 * aqui que no se ve jugando—.
 *
 * Sale con codigo 0 si todo fue bien, y con 1 en cuanto algo no cuadra, para
 * poder encadenarlo en un despliegue.
 */
import { io } from 'socket.io-client';

import {
  MENSAJES_DEL_CLIENTE,
  MENSAJES_DEL_SERVIDOR,
  VERSION_PROTOCOLO,
} from '@minehunt/game-engine';

/** Tablero pequeno: una partida entera cabe en pocas jugadas. */
const CONFIGURACION = {
  ancho: 5,
  alto: 5,
  minas: 4,
  tiempoPorTurnoSegundos: 0,
  recargaOndaSegundos: 30,
};

/** Mensajes de la rafaga con la que se tantea el limite de ritmo. */
const RAFAGA = 40;

const url = process.argv[2] ?? 'http://localhost:3000';

function conectar() {
  const cliente = io(url, { transports: ['websocket'], forceNew: true });
  return new Promise((listo, fallo) => {
    cliente.once('connect', () => listo(cliente));
    cliente.once('connect_error', fallo);
  });
}

function fallar(mensaje) {
  console.error(`[humo] FALLO: ${mensaje}`);
  process.exit(1);
}

const ana = await conectar();
const bruno = await conectar();
console.log(`[humo] dos clientes conectados a ${url}`);

const creada = await ana.emitWithAck(MENSAJES_DEL_CLIENTE.crearSala, {
  nombre: 'Ana',
  version: VERSION_PROTOCOLO,
  configuracion: CONFIGURACION,
});
if (!creada.ok) {
  fallar(`no se pudo abrir la sala: ${creada.error}`);
}
console.log(`[humo] sala ${creada.datos.codigo}`);

const unido = await bruno.emitWithAck(MENSAJES_DEL_CLIENTE.unirseASala, {
  codigo: creada.datos.codigo,
  nombre: 'Bruno',
  version: VERSION_PROTOCOLO,
});
if (!unido.ok) {
  fallar(`el segundo jugador no entro: ${unido.error}`);
}

let estado = null;
const porPuesto = [ana, bruno];
for (const cliente of porPuesto) {
  cliente.on(MENSAJES_DEL_SERVIDOR.partida, (recibido) => {
    estado = recibido;
  });
}

const empezada = await ana.emitWithAck(MENSAJES_DEL_CLIENTE.empezarPartida);
if (!empezada.ok) {
  fallar(`la partida no empezo: ${empezada.error}`);
}
while (estado === null) {
  await new Promise((seguir) => setTimeout(seguir, 20));
}

/*
 * Se clica la primera celda oculta que haya, sin pensar: aqui no se prueba a
 * jugar bien, se prueba que el servidor lleva la partida hasta el final.
 */
let jugadas = 0;
while (!estado.terminada && jugadas < 500) {
  const oculta = estado.celdas.flat().find((celda) => celda.estado === 'oculta');
  if (oculta === undefined) {
    break;
  }

  const respuesta = await porPuesto[estado.turnoDe].emitWithAck(MENSAJES_DEL_CLIENTE.clic, {
    x: oculta.x,
    y: oculta.y,
  });
  if (!respuesta.ok) {
    fallar(`jugada rechazada: ${respuesta.error}`);
  }
  jugadas += 1;
  await new Promise((seguir) => setTimeout(seguir, 10));
}

if (!estado.terminada) {
  fallar(`la partida no termino en ${jugadas} jugadas`);
}
console.log(
  `[humo] partida completa en ${jugadas} jugadas; marcador ` +
    estado.jugadores.map((jugador) => `${jugador.id}:${jugador.minasEncontradas}`).join(' '),
);

const rafaga = await Promise.all(
  Array.from({ length: RAFAGA }, () => ana.emitWithAck(MENSAJES_DEL_CLIENTE.salasAbiertas)),
);
const cortados = rafaga.filter(
  (respuesta) => !respuesta.ok && respuesta.error === 'DEMASIADAS_PETICIONES',
).length;

if (cortados === 0) {
  fallar(`una rafaga de ${RAFAGA} mensajes paso entera: el limite de ritmo no esta puesto`);
}
console.log(`[humo] limite de ritmo: ${cortados} de ${RAFAGA} mensajes cortados`);

ana.disconnect();
bruno.disconnect();
console.log('[humo] todo correcto');
process.exit(0);
