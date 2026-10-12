# Documentos de MineHunt

Aquí vive toda la documentación del proyecto. **Cualquier documento nuevo va en
esta carpeta**, y se añade a este índice en el mismo cambio.

| Documento | Qué es |
|---|---|
| [MineHunt-proyectos.md](MineHunt-proyectos.md) | **El mapa del repositorio.** Qué es cada uno de los tres paquetes, qué contiene, de qué depende y qué reglas lo gobiernan. Por dónde empezar si no conoces el proyecto. |
| [MineHunt-plan-maestro.md](MineHunt-plan-maestro.md) | **La fuente de verdad del diseño.** Define las diez fases, el alcance exacto de cada una y qué no toca implementar todavía. Su apéndice final recoge las decisiones tomadas durante la implementación y **manda sobre el cuerpo del documento** siempre que haya discrepancia. |
| [MineHunt-android.md](MineHunt-android.md) | **Cómo se compila la app de Android.** Qué hace falta instalado (JDK 21, SDK 36), el ciclo `ng build` → `cap sync` → Gradle, dónde queda el APK y el AAB, de dónde salen los iconos y qué falta para publicar. |
| [MineHunt-web.md](MineHunt-web.md) | **El cliente Angular.** Cómo se desarrolla y cómo se compila para producción, qué deja `ng build` y dónde, los presupuestos de tamaño, la aplicación instalable con un manifiesto por idioma, de dónde salen los iconos y cómo funcionan el sonido y las animaciones. |
| [MineHunt-servidor.md](MineHunt-servidor.md) | **El multijugador online.** Cómo está montado el servidor de la Fase 6, el protocolo completo de Socket.IO (mensajes, respuestas y códigos), la credencial de reconexión, el bot que sustituye a quien se cae y lo que la Fase 7 va a necesitar. |
| [MineHunt-local.md](MineHunt-local.md) | **El multijugador sin servidor.** De dos a cuatro teléfonos jugando entre ellos por Nearby Connections: qué se movió al motor para que el anfitrión pueda ser un teléfono, el troceado de los mensajes, los permisos de Android versión a versión y cómo se prueba sin tener dos móviles en la mano. |
| [MineHunt-despliegue.md](MineHunt-despliegue.md) | **El despliegue del servidor.** Qué lleva la imagen Docker y por qué el cliente web va dentro, las variables de entorno, el endurecimiento de la Fase 9 (topes de salas, límite de ritmo, CORS), el proxy inverso con HTTPS, la comprobación de salud y cómo se recupera el servicio. |
| [MineHunt-icon.svg](MineHunt-icon.svg) | El icono de la aplicación: fondo azul marino, mina roja-naranja con la mecha encendida y un dedo tocándola. Es el origen de **todos** los iconos: los de Android (`recursos-android`) y los PNG del manifiesto de la web (`recursos-web`). |

## Lo que no está aquí y por qué

- **`README.md`** se queda en la raíz porque es la portada que GitHub enseña al
  entrar: cuenta qué es el juego, cómo se arranca y cómo está montado el
  monorepo, y desde ahí se entra a este índice. No repite lo que hay aquí: lo
  enlaza. Al lado va **`LICENSE`**, la LGPL v2.1 bajo la que se distribuye el
  proyecto: GitHub solo la reconoce en la raíz.
- **`CLAUDE.md`** se queda en la raíz del repositorio: es donde Claude Code lo
  busca al abrir el proyecto. Cuenta el estado actual, los comandos y las
  convenciones; el plan maestro cuenta el diseño.
- Los **`.cmd` de la raíz** (`arrancar-web.cmd`, `verificar.cmd`…) llevan su
  propia documentación dentro, en la cabecera de cada fichero.
