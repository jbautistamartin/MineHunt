# CLAUDE.md

Este fichero proporciona orientación a Claude Code (claude.ai/code) al trabajar con el código de este repositorio.

## Estado actual del repositorio

**Fase 0 completada** (rama `feature/estructura-monorepo`): el monorepo existe y los tres paquetes compilan, tipan y pasan sus pruebas. Todavía **no hay lógica de juego** — eso es la Fase 1.

`MineHunt-plan-maestro.md` es la fuente de verdad del diseño: define las fases, el alcance exacto de cada una y qué NO debe implementarse todavía. Léelo antes de tocar nada.

## Comandos

Desde la raíz, los scripts recorren los tres workspaces (`--workspaces --if-present`):

```bash
npm run compilar          # tsc --build | nest build | ng build
npm run probar            # vitest en los tres paquetes
npm run verificar-tipos   # tsc --noEmit en los tres
```

Para un paquete concreto, `--workspace @minehunt/<nombre>`:

```bash
npm run probar --workspace @minehunt/game-engine
npm run probar:ver --workspace @minehunt/game-engine   # modo watch
npm run arrancar --workspace @minehunt/web             # ng serve
npm run arrancar:dev --workspace @minehunt/server      # nest start --watch
npm run probar:e2e --workspace @minehunt/server
```

Una sola prueba: `npx vitest run -t "nombre de la prueba"` dentro del paquete, o `npx vitest run ruta/al/fichero.prueba.ts`.

**Los ficheros de prueba usan el sufijo `.prueba.ts`** (`.e2e-prueba.ts` para los e2e), no `.spec.ts`. Está configurado en `vitest.config.ts`, en `angular.json` (`test.options.include`) y en los `tsconfig.*.json`; si añades un test con otro sufijo, no se ejecutará.

## Versiones fijadas

Angular 22 exige **TypeScript >=6.0 <6.1**, así que el monorepo va con **TypeScript 6.0.3** — no lo subas a la 7 (el compilador nativo) sin comprobar antes que Angular lo acepta. Node 24 LTS, Angular 22.1, NestJS 12, Vitest 4.1. Los tres paquetes usan Vitest; Angular lo hace con jsdom, así que no hace falta Chrome ni Karma.

## Qué es MineHunt

Buscaminas **invertido**: el objetivo es *encontrar* minas, no evitarlas. Multijugador por turnos (2-4 jugadores, humanos y/o bots). Un clic revela o bien una mina (que se anota en el marcador del jugador) o bien un número de minas adyacentes, con revelado en cascada en celdas vacías. Existe un ítem de "despeje amplio" con tiempo de recarga. Gana quien más minas encuentre.

## Convenciones no negociables

1. **Todo el código en español.** Nombres de variables, funciones, clases y comentarios en español, sin excepción (`crearPartida`, `clicCelda`, `obtenerEstado`, `ModuloPrincipal`, `ServicioPrincipal`). Los *nombres de fichero* que imponen Angular y el CLI de Nest se mantienen (`app.module.ts`, `app.config.ts`, `main.ts`) para no romper sus schematics; lo que va en español es el contenido.
2. **Ningún texto visible hardcodeado.** Todo texto de UI se referencia por clave de `@ngx-translate/core` y vive en `assets/i18n/es.json` y `assets/i18n/en.json`. Al añadir una pantalla o mensaje, se añaden las claves en **ambos** ficheros en el mismo cambio.
3. **El servidor nunca envía texto traducido.** Emite códigos de evento en español (`MINA_ENCONTRADA`, `TURNO_SIGUIENTE`, `PARTIDA_TERMINADA`) más datos crudos; el cliente compone el texto en el idioma del jugador que mira. Esto permite que dos jugadores en la misma partida la vean cada uno en su idioma.
4. **La IA solo ve lo que vería un humano.** Los bots reciben el estado *visible* del tablero; jamás la posición de minas ocultas. Debe haber tests que lo verifiquen.
5. **TypeScript estricto** en todos los paquetes.

## Arquitectura prevista

Monorepo con npm workspaces (o pnpm):

- `packages/game-engine` — librería TypeScript **pura**: sin Angular, sin DOM, sin dependencias de runtime del navegador. Contiene generación de tablero, revelado y cascada, cálculo de adyacencias, turnos, marcador, ítem de despeje, módulo de IA y la tabla declarativa de niveles del Modo Historia.
- `apps/web` — Angular 18+ con standalone components; consume `game-engine` como dependencia de workspace. Se empaqueta a Android con Capacitor (Fase 5).
- `apps/server` — NestJS + Socket.IO; consume **la misma** `game-engine` como fuente de verdad autoritativa (valida cada clic y difunde el estado).

Ya scaffolded y enlazados entre sí: `apps/web` y `apps/server` declaran `@minehunt/game-engine` como dependencia (`"*"`, resuelta por npm workspaces mediante junction) y ambos lo importan de verdad, con pruebas que lo comprueban — así una rotura del enlace del monorepo sale en los tests.

La decisión estructural clave es que el motor de juego es una sola implementación compartida entre cliente y servidor. Lógica de juego nueva va en `game-engine`, nunca en un componente Angular ni en un gateway de NestJS; esos dos solo orquestan y presentan.

En el cliente conviven tres modos que comparten los mismos componentes de tablero: Entrenamiento (motor local, hotseat + bots), Historia (progresión de ~20 niveles, progreso en localStorage/IndexedDB) y Multijugador Online (el motor local se sustituye por el estado que llega del servidor).

## Idioma de la interfaz

Detección al arrancar con `navigator.language`: `es-*` → español, cualquier otro → inglés por defecto. Un selector manual sobrescribe la detección y la elección se persiste en localStorage. Dentro del WebView de Android `navigator.language` puede no ser fiable: usar `@capacitor/device` si hace falta.
