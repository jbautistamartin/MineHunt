# @minehunt/game-engine

**El motor de MineHunt**, y la única implementación de las reglas: la usan igual
el cliente y el servidor. Es una librería TypeScript **pura** — sin Angular, sin
DOM y sin nada del navegador —, así que se prueba con datos y sin levantar nada.

## Qué hay dentro

| Fichero o carpeta | Qué es |
|---|---|
| `tablero.ts` | El tablero: adyacencias, revelado, despeje en cascada y la vista visible. Las minas **se reparten en el primer clic**, no al crear la partida, para poder excluir la celda clicada. |
| `motor.ts` | La partida: turnos, marcador, onda expansiva con recarga, reloj de turno, rendición y estadísticas por jugador. |
| `ia/` | `analisis.ts` traduce el tablero visible a restricciones y saca deducciones; `jugador-ia.ts` son los cinco niveles de bot. |
| `historia/` | La tabla de los 50 niveles del Modo Historia y las funciones puras del progreso. |
| `red/` | Lo que comparte el multijugador: `protocolo.ts` (los mensajes y su forma), `sala.ts` (puestos, turnos, bots, reconexión) y `anfitrion.ts` (la sala sin cable, para que el anfitrión pueda ser un teléfono). Aquí no hay Socket.IO, ni Nest, ni Angular. |

## Dos invariantes que no se tocan

- **`obtenerEstado()` no revela información oculta mientras se juega.** Una
  celda `oculta` llega con `minasAdyacentes: null` y no dice si esconde mina;
  solo se destapa todo cuando la partida ha terminado. Eso es lo que hace
  jugables a los bots sin que hagan trampas: **reciben ese mismo estado y nada
  más**, y hay pruebas que lo verifican construyendo tableros desde fuera.
- **El motor no llama al reloj del sistema ni tiene temporizadores propios.**
  La recarga de la onda y el reloj de turno corren con el tiempo, así que
  `OpcionesPartida` acepta un `ahora?: () => number` que las pruebas sustituyen
  por un reloj falso. El motor expone `tiempoRestanteDeTurnoMs()` y
  `comprobarTiempoDeTurno()`, y es quien lo usa —el cliente o el servidor— el
  que tiene que preguntar.

Todo lo público sale por [`src/index.ts`](src/index.ts); el resto es interior.
Los ficheros `*.ayuda.ts` son utilidades solo para pruebas y están fuera del
build, como los `*.prueba.ts`.

## Comandos

Desde la raíz del monorepo, con `--workspace @minehunt/game-engine`:
`compilar` (`tsc --build`), `probar`, `probar:ver`, `verificar-tipos` y
`limpiar`. La web y el servidor consumen el `dist/` compilado, no el código
fuente: **si tocas el motor, recompílalo antes de probar los otros dos
paquetes**, o se probarán contra la versión anterior.

`VERSION_MOTOR` (en `version.ts`) es también `VERSION_PROTOCOLO` y va a la par
con la versión que el jugador ve en la aplicación: si cambia el protocolo, sube
la minor, porque es lo que decide qué clientes pueden jugar contra qué
servidores.

## Documentación

[**El mapa del repositorio**](../../documentos/MineHunt-proyectos.md) ·
[**El plan maestro**](../../documentos/MineHunt-plan-maestro.md) ·
[**El servidor**](../../documentos/MineHunt-servidor.md) ·
[**El multijugador local**](../../documentos/MineHunt-local.md) ·
[portada](../../README.md)
