# CLAUDE.md

Este fichero proporciona orientación a Claude Code (claude.ai/code) al trabajar con el código de este repositorio.

## Estado actual del repositorio

El repositorio todavía **no contiene código**: solo `MineHunt-plan-maestro.md` (el plan maestro, fuente de verdad del diseño) y `MineHunt-icon.svg` (icono de la app). No existen aún `package.json`, scripts de build/test ni carpetas de código, así que **no hay comandos de build/lint/test que ejecutar**. La Fase 0 del plan es la que crea esa estructura; hasta que se ejecute, cualquier comando debe derivarse de lo que se acabe de crear, no asumirse.

Antes de implementar cualquier cosa, lee `MineHunt-plan-maestro.md`: define las fases, el alcance exacto de cada una y qué NO debe implementarse todavía en cada fase.

## Qué es MineHunt

Buscaminas **invertido**: el objetivo es *encontrar* minas, no evitarlas. Multijugador por turnos (2-4 jugadores, humanos y/o bots). Un clic revela o bien una mina (que se anota en el marcador del jugador) o bien un número de minas adyacentes, con revelado en cascada en celdas vacías. Existe un ítem de "despeje amplio" con tiempo de recarga. Gana quien más minas encuentre.

## Convenciones no negociables

1. **Todo el código en español.** Nombres de variables, funciones, clases, ficheros y comentarios en español, sin excepción (`crearPartida`, `clicCelda`, `obtenerEstado`, `estaTerminada`, `obtenerGanador`).
2. **Ningún texto visible hardcodeado.** Todo texto de UI se referencia por clave de `@ngx-translate/core` y vive en `assets/i18n/es.json` y `assets/i18n/en.json`. Al añadir una pantalla o mensaje, se añaden las claves en **ambos** ficheros en el mismo cambio.
3. **El servidor nunca envía texto traducido.** Emite códigos de evento en español (`MINA_ENCONTRADA`, `TURNO_SIGUIENTE`, `PARTIDA_TERMINADA`) más datos crudos; el cliente compone el texto en el idioma del jugador que mira. Esto permite que dos jugadores en la misma partida la vean cada uno en su idioma.
4. **La IA solo ve lo que vería un humano.** Los bots reciben el estado *visible* del tablero; jamás la posición de minas ocultas. Debe haber tests que lo verifiquen.
5. **TypeScript estricto** en todos los paquetes.

## Arquitectura prevista

Monorepo con npm workspaces (o pnpm):

- `packages/game-engine` — librería TypeScript **pura**: sin Angular, sin DOM, sin dependencias de runtime del navegador. Contiene generación de tablero, revelado y cascada, cálculo de adyacencias, turnos, marcador, ítem de despeje, módulo de IA y la tabla declarativa de niveles del Modo Historia.
- `apps/web` — Angular 18+ con standalone components; consume `game-engine` como dependencia de workspace. Se empaqueta a Android con Capacitor (Fase 5).
- `apps/server` — NestJS + Socket.IO; consume **la misma** `game-engine` como fuente de verdad autoritativa (valida cada clic y difunde el estado).

La decisión estructural clave es que el motor de juego es una sola implementación compartida entre cliente y servidor. Lógica de juego nueva va en `game-engine`, nunca en un componente Angular ni en un gateway de NestJS; esos dos solo orquestan y presentan.

En el cliente conviven tres modos que comparten los mismos componentes de tablero: Entrenamiento (motor local, hotseat + bots), Historia (progresión de ~20 niveles, progreso en localStorage/IndexedDB) y Multijugador Online (el motor local se sustituye por el estado que llega del servidor).

## Idioma de la interfaz

Detección al arrancar con `navigator.language`: `es-*` → español, cualquier otro → inglés por defecto. Un selector manual sobrescribe la detección y la elección se persiste en localStorage. Dentro del WebView de Android `navigator.language` puede no ser fiable: usar `@capacitor/device` si hace falta.
