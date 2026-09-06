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
| [MineHunt-icon.svg](MineHunt-icon.svg) | El icono de la aplicación: fondo azul marino, mina roja-naranja con la mecha encendida y un dedo tocándola. Es el origen de **todos** los iconos: los de Android (`recursos-android`) y los PNG del manifiesto de la web (`recursos-web`). |

## Lo que no está aquí y por qué

- **`CLAUDE.md`** se queda en la raíz del repositorio: es donde Claude Code lo
  busca al abrir el proyecto. Cuenta el estado actual, los comandos y las
  convenciones; el plan maestro cuenta el diseño.
- Los **`.cmd` de la raíz** (`arrancar-web.cmd`, `verificar.cmd`…) llevan su
  propia documentación dentro, en la cabecera de cada fichero.
