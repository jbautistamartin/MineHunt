# Los proyectos de MineHunt

Qué es cada pieza del repositorio, qué contiene y qué reglas la gobiernan. Es el
mapa: para el detalle de cada tema están los otros documentos de esta carpeta.

MineHunt es un **buscaminas invertido**: el objetivo es *encontrar* minas, no
evitarlas. Por turnos, de 2 a 4 jugadores, humanos o bots. Quien encuentra mina
la anota y **sigue jugando**; quien no, cede el turno, y también lo pierde si se
le acaba el tiempo. Gana quien más minas encuentre.

## De un vistazo

Es un monorepo de npm workspaces con **tres paquetes**:

| Paquete | Qué es | Depende de |
|---|---|---|
| `packages/game-engine` | Las reglas del juego, en TypeScript puro. | nada |
| `apps/web` | La aplicación que juega la gente: navegador y Android. | el motor |
| `apps/server` | El servidor de las partidas online. | el motor |

```
                 packages/game-engine
                  (las reglas, puras)
                    ▲             ▲
                    │             │
             apps/web        apps/server
          (lo que se ve)   (la autoridad)
                    └──── Socket.IO ────┘
```

**La decisión estructural del proyecto es que hay una sola implementación de las
reglas.** El cliente y el servidor no tienen cada uno su versión: importan el
mismo paquete. Lógica de juego nueva va ahí, nunca en un componente de Angular
ni en un gateway de NestJS; esos dos solo orquestan y presentan.

## `packages/game-engine` — el motor

Librería de TypeScript **pura**: sin Angular, sin DOM, sin nada del navegador y
sin nada de Node. Se puede ejecutar en los dos lados porque no sabe en cuál está.

| Fichero | Qué hace |
|---|---|
| `tablero.ts` | El tablero: reparto de minas, revelado, cascada y cálculo de adyacencias. |
| `motor.ts` | `MotorJuego`: turnos, marcador, onda expansiva, reloj, rendición y fin de partida. |
| `tipos.ts` | Los tipos públicos y los códigos (`CodigoSuceso`, `CodigoError`). |
| `ia/analisis.ts` | Traduce el tablero visible a restricciones y saca deducciones. |
| `ia/jugador-ia.ts` | `JugadorIA`: los cinco niveles de bot. |
| `historia/niveles.ts` | Los 50 niveles del Modo Historia, generados con una progresión documentada. |
| `historia/progreso.ts` | Funciones puras sobre el progreso: qué está desbloqueado y qué superado. |
| `red/protocolo.ts` | El contrato del multijugador online: nombres de mensajes y forma de los datos. |
| `version.ts` | `VERSION_MOTOR`, que es también la versión del protocolo. |

Reglas que no se negocian aquí:

- **Nunca llama al reloj del sistema.** El tiempo entra por `OpcionesPartida.ahora`
  y el azar por `aleatorio`. Por eso el motor no tiene temporizadores propios:
  quien lo usa pregunta.
- **`obtenerEstado()` no revela nada oculto** mientras se juega. Es lo que hace
  jugable a la IA sin trampas y lo que impide que un cliente manipulado vea las
  minas: los bots y los jugadores reciben exactamente lo mismo.
- El `red/protocolo.ts` **no tiene reglas de juego**: está aquí porque es el
  vocabulario común de cliente y servidor, y los dos ya dependen del paquete.

Se prueba con Vitest, sin nada alrededor. Los dos apps consumen su **`dist/`
compilado**, no su código fuente: por eso hay que recompilarlo antes de probar
nada que lo use.

## `apps/web` — la aplicación

Angular 22 con componentes *standalone*, textos con `@ngx-translate` y
empaquetado a Android con Capacitor. **La app de Android es esta misma web dentro
de un WebView**: no hay una segunda implementación de nada.

Dentro de `src/app`:

- **`nucleo/`** — los servicios con estado. `ServicioPartida` (la partida local,
  el único que habla con el motor), `ServicioOnline` (su gemelo, pero con el
  estado llegando del servidor), `ServicioHistoria` (niveles y progreso),
  `ServicioIdioma`, `ServicioAjustes`, `ServicioServidor` (a qué servidor se
  juega), `ServicioBotonAtras` (qué hace el atrás del teléfono), `ServicioSonido`
  (los efectos, sintetizados con Web Audio) y `version.ts`.
- **`paginas/`** — las pantallas, con carga diferida: `inicio` (el menú),
  `configuracion` (montar un Entrenamiento), `partida`, `historia` (el mapa de
  niveles), `online` y `ayuda`.
- **`componentes/`** — lo reutilizable: el `tablero`, que es **el mismo en los
  tres modos de juego**, el `resumen-final` (las estadísticas de la partida, el
  mismo en los tres) y el selector de idioma.
- **`herramientas/`** (fuera de `src`) — los generadores de iconos, que sacan
  del icono maestro los recursos de Android y los PNG del manifiesto de la web.

Tres modos que comparten componentes: **Entrenamiento** (motor local, hotseat y
bots), **Historia** (50 niveles, progreso en `localStorage`) y **Multijugador
Online** (el motor local se sustituye por el estado que llega del servidor).

Reglas propias:

- **Ningún texto visible va escrito en el código.** Todo pasa por una clave de
  traducción, y las claves se añaden a `es.json` y `en.json` en el mismo cambio.
- **Lo que sale de `localStorage` se valida entero antes de usarse**, y si algo no
  cuadra se descarta el lote: ese texto lo puede haber escrito cualquiera y
  sobrevive a los cambios de versión.
- Las pruebas van con Vitest sobre jsdom, así que no hace falta ni Chrome ni
  Karma.

## `apps/server` — el servidor

NestJS con Socket.IO. Lleva las salas del Multijugador Online y **es la autoridad
del juego**: dentro de cada sala vive el único `MotorJuego` de verdad de esa
partida, y los clientes solo mandan intenciones.

- `salas/sala.ts` — una sala: quién juega, la partida, el reloj y los bots que
  sustituyen a quien se cae. No sabe nada de Socket.IO, así que se prueba entera
  sin levantar nada.
- `salas/partida.pasarela.ts` — traduce mensajes a llamadas y difunde lo que pase.
  Aquí no hay ni una regla del juego.
- `salas/salas.servicio.ts` — las salas vivas y los códigos para entrar.
- `salas/dependencias.ts` — el reloj y el azar, inyectados como en el motor.

Regla que lo define: **nunca manda texto traducido**. Emite códigos de suceso y de
error más datos crudos, y la frase la compone cada cliente en su idioma; es lo
que permite que dos jugadores de la misma sala vean la partida cada uno en el
suyo.

Tiene dos juegos de pruebas: las de la sala, que cubren las reglas sin red, y las
e2e, que levantan la aplicación y juegan partidas completas de 2, 3 y 4 jugadores
con clientes de Socket.IO de verdad.

## Lo que hay en la raíz

- Los **scripts de npm** recorren los tres paquetes: `npm run verificar` compila,
  comprueba tipos y prueba, todo seguido. Recompila el motor antes de nada,
  porque los apps consumen su `dist/`.
- Un **`.cmd` por cada tipo de ejecución**, para lanzarlos desde el Explorador sin
  abrir una consola: `arrancar-web`, `arrancar-servidor`, `arrancar-online` (las
  dos cosas a la vez, que es lo que pide el multijugador), `verificar`,
  `compilar`, `probar`, `android-apk`… Cada uno lleva dentro su documentación.
- **`CLAUDE.md`**, que se queda aquí porque es donde Claude Code lo busca.
- **`documentos/`**, con todo lo demás.

## Convenciones de todo el repositorio

1. **Todo el código en español**: variables, funciones, clases y comentarios. Solo
   se respetan los nombres de fichero que imponen Angular y Nest.
2. **Ningún texto visible escrito en el código.**
3. **El servidor nunca envía texto traducido.**
4. **La IA solo ve lo que vería un humano**, y hay pruebas que lo comprueban.
5. **TypeScript estricto** en los tres paquetes.
6. Los ficheros de prueba se llaman **`.prueba.ts`** (`.e2e-prueba.ts` los e2e), no
   `.spec.ts`; está configurado así en los tres paquetes y con otro sufijo no se
   ejecutan.

## Dónde seguir

| Para | Documento |
|---|---|
| El diseño, las fases y por qué se decidió cada cosa | [MineHunt-plan-maestro.md](MineHunt-plan-maestro.md) |
| Compilar e instalar la app de Android | [MineHunt-android.md](MineHunt-android.md) |
| El multijugador online y su protocolo | [MineHunt-servidor.md](MineHunt-servidor.md) |
| Comandos, trampas y estado actual | `CLAUDE.md`, en la raíz |
