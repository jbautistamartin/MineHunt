# @minehunt/server

El **servidor de MineHunt**: NestJS 12 con Socket.IO. Lleva las salas del
Multijugador Online —lobby, códigos, salas públicas y privadas, reconexión y
bots que sustituyen a quien se cae— y, en la imagen de producción, sirve además
el cliente web: el juego en `/` y el panel de salas en `/panel`.

**El servidor es la autoridad.** Dentro de cada sala corre un motor de verdad,
el mismo paquete `@minehunt/game-engine` que usa el cliente: los clientes mandan
intenciones y reciben el estado que el motor deja ver a cualquiera, así que
nadie juega fuera de su turno ni ve una mina antes de tiempo. De aquí **no sale
ni un texto traducido**, solo códigos de suceso y datos crudos, para que dos
jugadores de la misma partida puedan verla cada uno en su idioma.

## Comandos

Desde la raíz del monorepo, con `--workspace @minehunt/server`:

| Comando | Qué hace |
|---|---|
| `arrancar:dev` | `nest start --watch`, en el puerto 3000. |
| `arrancar` / `arrancar:prod` | Arranque normal y arranque de lo ya compilado. |
| `compilar` | `nest build`. |
| `probar` / `probar:ver` | Vitest: las reglas de la sala y la pasarela. |
| `probar:e2e` | Levanta la aplicación y juega partidas completas de 2, 3 y 4 jugadores con clientes de Socket.IO de verdad. **No va en `npm run verificar`.** |
| `humo -- <url>` | Juega una partida entera contra un servidor ya desplegado. Que el proceso responda no dice nada; esto sí. |
| `verificar-tipos`, `lint`, `formatear` | Lo de siempre. |

Recuerda que el servidor consume el `dist/` compilado del motor: si tocas el
motor, recompílalo antes de lanzar estas pruebas.

## Cómo está repartido

- `src/salas/` — el multijugador: la pasarela de Socket.IO, el servicio de
  salas con sus topes por quien las abre, el interceptor del límite de ritmo y
  las dependencias inyectadas (reloj y azar). Las reglas de una sala **no están
  aquí**: viven en el motor, en `red/sala.ts`, porque en el Multijugador Local
  el anfitrión es un teléfono.
- `src/panel/` — el panel de salas, para quien administra el servidor. Es el
  único sitio del proyecto con texto escrito a mano en lugar de claves de i18n.
- `src/configuracion.ts` — todo lo configurable por entorno, leído una sola vez
  al arrancar.

## Documentación

- [**El servidor**](../../documentos/MineHunt-servidor.md) — el protocolo
  completo de Socket.IO, la credencial de reconexión y los bots sustitutos.
- [**El despliegue**](../../documentos/MineHunt-despliegue.md) — la imagen
  Docker, las variables de entorno, el endurecimiento, el HTTPS y la
  comprobación de salud.
- [**El mapa del repositorio**](../../documentos/MineHunt-proyectos.md) y la
  [portada](../../README.md).
