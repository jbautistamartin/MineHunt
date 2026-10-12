# @minehunt/web

El **cliente de MineHunt**: Angular 22 con componentes standalone, señales y
carga diferida por pantalla. Es a la vez la web, la aplicación instalable y
—dentro de un WebView de Capacitor— la app de Android, cuyo proyecto nativo vive
en [`android/`](android). No hay una segunda implementación del juego: el APK
lleva este mismo bundle.

Las reglas no están aquí. Viven en `@minehunt/game-engine`, y en los modos
online el estado llega hecho del servidor; esta aplicación presenta y orquesta.

## Comandos

Desde la raíz del monorepo, con `--workspace @minehunt/web`:

| Comando | Qué hace |
|---|---|
| `arrancar` | `ng serve`, el juego en `localhost:4200`. |
| `compilar` | `ng build` a `dist/web/browser`. |
| `probar` / `probar:ver` | Vitest sobre jsdom (sin Chrome ni Karma). |
| `verificar-tipos` | `tsc --noEmit` de la aplicación y de las pruebas. |
| `sincronizar-android` | `ng build` + `cap sync`. |
| `apk-android` / `aab-android` | Lo anterior y Gradle, para el APK o el AAB. |
| `abrir-android` | Abre el proyecto nativo en Android Studio. |
| `recursos-android` / `recursos-web` | Rasterizan el icono maestro y reparten las densidades y los PNG del manifiesto. |

Recuerda que la web consume el `dist/` compilado del motor: si tocas el motor,
recompílalo antes de lanzar estas pruebas.

## Cómo está repartido

- `src/app/nucleo/` — los servicios con estado: idioma, ajustes, partida,
  historia, online, local, sonido, vibración y el botón de atrás.
  **`ServicioPartida` es el único que habla con el motor.**
- `src/app/paginas/` — las pantallas enrutadas: el menú, la configuración del
  Entrenamiento, la partida, el mapa de la Historia, el multijugador, la ayuda y
  «Acerca de».
- `src/app/componentes/` — lo reutilizable, el tablero entre otras cosas: el
  mismo en los cuatro modos.
- `public/assets/i18n/` — los textos, en español y en inglés. Se tocan los dos
  en el mismo cambio.

## Documentación

- [**El cliente**](../../documentos/MineHunt-web.md) — desarrollo, build de
  producción, presupuestos de tamaño, aplicación instalable e iconos.
- [**Android**](../../documentos/MineHunt-android.md) — requisitos, ciclo de
  compilación, firma y publicación.
- [**El mapa del repositorio**](../../documentos/MineHunt-proyectos.md) y la
  [portada](../../README.md).
