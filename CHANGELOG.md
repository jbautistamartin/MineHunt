# Registro de cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/);
versionado según [SemVer](https://semver.org/lang/es/).

> El número es **el mismo para los cuatro paquetes, el motor y el protocolo**. Al subir una
> versión hay que acordarse de que **`VERSION_APP` va a la par con `VERSION_PROTOCOLO`**: el
> número que el jugador lee en «Acerca de» es el que decide contra qué servidores puede jugar,
> así que una *minor* nueva deja fuera a los clientes viejos.
>
> El desarrollo va por fases y la fuente de verdad del diseño es
> [`documentos/MineHunt-plan-maestro.md`](documentos/MineHunt-plan-maestro.md); lo hecho en cada
> una está contado allí y en el registro fechado de `CLAUDE.md`.

## [No publicado]

### Añadido

- **Aviso de versión nueva.** Al arrancar —una vez al día como mucho— el juego mira si hay
  publicada una versión más nueva que la que se está jugando. Si la hay, el menú principal marca
  con un punto la entrada de «Acerca de» y esa pantalla lo dice en una línea, con el enlace ya
  apuntando al release. Si no hay red, o todavía no hay ningún release publicado, se calla. No
  descarga ni instala nada: en Android el APK se instala desde la página del release y en el
  navegador basta con recargar.

## [1.0.1] - 2026-10-11

Versión de parche: el juego es el mismo que la 1.0.0 y se publica para que el APK instalado
coincida con lo etiquetado y para dejar sitio a lo que caiga encima.

**Al ser un parche, el protocolo no cambia**: `VERSION_PROTOCOLO` pasa de 1.0.0 a 1.0.1 y, como
solo se comparan *major* y *minor*, un cliente de la 1.0.0 sigue entrando en un servidor de la
1.0.1 y al revés.

### Cambiado

- Las cuatro versiones del monorepo, el motor, el protocolo y el `versionCode` de Android suben a
  la 1.0.1 a la vez, como manda la convención del repositorio.

## [1.0.0] - 2026-10-11

Primera versión. El juego está completo en sus cuatro modalidades: lo que queda fuera es
levantar el servidor del Online en un alojamiento público y subir el APK a Google Play.

### Añadido

- **El motor del juego**, una librería TypeScript pura que comparten cliente y servidor:
  tablero, reparto de minas en el primer clic, turnos encadenados —quien encuentra mina sigue
  jugando—, marcador, reloj de turno, rendición y onda expansiva con recarga, que es lo único
  que despeja en cascada.
- **Bots de cinco niveles**, del azar puro al cálculo de probabilidades, que solo ven lo que
  vería un humano y también gastan la onda.
- **Modo Entrenamiento**: partidas locales de dos a cuatro puestos, humanos y bots con niveles
  mezclados, con tablero, minas, reloj y recarga configurables y recordados.
- **Modo Historia**: 50 niveles en 5 zonas, con la dificultad subiendo por tablero, densidad de
  minas, nivel de los rivales y reloj, y el progreso guardado.
- **Multijugador Online**: servidor de salas en NestJS y Socket.IO, con el motor de autoridad
  dentro de cada sala, salas públicas y privadas, bots, lobby, reconexión y bots que sustituyen
  a quien se cae; y su panel de salas para quien lo administra.
- **Multijugador Local**: de dos a cuatro teléfonos Android jugando entre ellos por Nearby
  Connections, sin servidor, sin Wi-Fi común y sin internet.
- **App de Android** empaquetada con Capacitor, en vertical, a pantalla completa y con el
  release firmado.
- **Español e inglés**, con detección automática al arrancar y selector manual.
- **Sonido sintetizado con Web Audio** —ni un fichero de audio en el repositorio—, vibración en
  Android, animaciones de destape y detonación, y resumen con estadísticas por jugador al
  terminar.
- **Pantalla de ayuda con las reglas** y **«Acerca de»** con la autoría, el enlace a la página
  del juego y el donativo.
- **Imagen Docker** que lleva dentro el servidor y el cliente web, con topes de salas, límite de
  ritmo, CORS y puerto por variables de entorno, comprobación de salud, prueba de humo y la capa
  de HTTPS con Caddy.
- **El código se publica bajo la GNU LGPL v2.1**, y es lo que dice la firma de «Acerca de».
