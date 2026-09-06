# CLAUDE.md

Este fichero proporciona orientación a Claude Code (claude.ai/code) al trabajar con el código de este repositorio.

## Estado actual del repositorio

**Fases 0 a 8 completadas.** El monorepo compila, tipa y pasa 351 pruebas, más 16 e2e del servidor que van por su propio comando. El motor implementa tablero, turnos encadenados, reloj de turno, marcador, bots de 5 niveles, onda expansiva con recarga, rendición y la tabla de 50 niveles del Modo Historia; la web abre en un menú principal desde el que se elige modo, y tiene el Modo Entrenamiento hotseat con bots de niveles mezclados, el Modo Historia con su mapa de niveles y progreso guardado, onda, reloj, rendición, pantalla de ayuda e i18n; y se empaqueta a Android con Capacitor, con el proyecto nativo en `apps/web/android/`; el servidor NestJS lleva salas multijugador por Socket.IO, con el motor de autoridad, lobby, reconexión y bots que sustituyen a quien se cae; y la web tiene el Multijugador Online en `/online`, con el mismo tablero que los otros modos; abriendo la dirección del servidor en el navegador sale su panel de salas. El juego está pulido: sonidos sintetizados, animaciones de destape y detonación, resumen con estadísticas por jugador al terminar, iconos y manifiestos de aplicación instalable en los dos idiomas. Pendientes: el despliegue del servidor con Docker (Fase 9) y la publicación en Google Play (Fase 10). Las tres últimas eran una sola en el plan original y se separaron a petición del usuario, porque son tres trabajos que no se parecen en nada y solo el primero lo verifica `npm run verificar`.

### Dónde nos quedamos (6 de septiembre de 2026)

- **Lo último tocado**: cuatro cosas que solo se notan con el teléfono en la mano — **vibración** al encontrar mina (`@capacitor/haptics`), **doble toque** para lanzar la onda, el **nombre recordado** en lugar de «Jugador 1» y el icono del juego en el panel del servidor. **Falta probarlas en el móvil**, igual que el Multijugador Online, que no conectaba desde el teléfono y se arregló sirviendo el WebView por `http` (`androidScheme`); eso es lo único que no verifica ninguna prueba. Si sigue sin conectar, el siguiente paso es leer la consola del WebView con `adb logcat chromium:* Capacitor:* *:S` mientras se entra en la sala.
- **Ese cambio borró el `localStorage` del teléfono** (idioma, ajustes y progreso de Historia), porque cambia el origen del WebView. Es una vez y solo en el móvil.
- **Entorno listo para la Fase 9**: Docker Desktop 4.89 instalado y **pendiente de abrirse por primera vez** para que arranque su motor; WSL 2 con Ubuntu ya estaba. `docker` no responderá hasta ese primer arranque.
- **Para volver a levantar todo**: `arrancar-online.cmd` (servidor en el 3000 y web en el 4200). Para el APK, `android-apk.cmd`, que ya busca el JDK 21 por su cuenta.
- **Lo siguiente es la Fase 9**, con los tres puntos de endurecimiento escritos en su alcance dentro del plan maestro.

Se trabaja **directamente sobre `develop`**, sin abrir ramas `feature/`.

`documentos/MineHunt-plan-maestro.md` es la fuente de verdad del diseño: define las fases, el alcance exacto de cada una y qué NO debe implementarse todavía. Léelo antes de tocar nada.

**Toda la documentación del proyecto vive en `documentos/`** (el plan maestro, el icono `MineHunt-icon.svg` y lo que se añada de aquí en adelante). Este `CLAUDE.md` se queda en la raíz porque es donde Claude Code lo busca. Al crear un documento nuevo, ponlo en `documentos/` y añádelo al índice de `documentos/README.md`.

## Comandos

Desde la raíz, los scripts recorren los tres workspaces (`--workspaces --if-present`):

```bash
npm run verificar         # compilar + verificar-tipos + probar, todo seguido
npm run compilar          # tsc --build | nest build | ng build
npm run probar            # vitest en los tres paquetes
npm run verificar-tipos   # tsc --noEmit en los tres
```

**Trampa del monorepo:** `apps/web` y `apps/server` consumen el `dist/` compilado de `game-engine`, no su código fuente. Si tocas el motor y lanzas las pruebas de la web sin recompilarlo, se prueba contra la versión anterior y los errores no tienen ningún sentido. El `npm run probar` de la raíz recompila el motor antes de nada por ese mismo motivo; si lanzas un workspace suelto, recompila tú primero:

```bash
npm run compilar --workspace @minehunt/game-engine
```

Para un paquete concreto, `--workspace @minehunt/<nombre>`:

```bash
npm run probar --workspace @minehunt/game-engine
npm run probar:ver --workspace @minehunt/game-engine   # modo watch
npm run arrancar --workspace @minehunt/web             # ng serve
npm run arrancar:dev --workspace @minehunt/server      # nest start --watch
npm run probar:e2e --workspace @minehunt/server
npm run sincronizar-android --workspace @minehunt/web   # ng build + cap sync
npm run apk-android --workspace @minehunt/web           # + gradlew assembleDebug
```

Una sola prueba: `npx vitest run -t "nombre de la prueba"` dentro del paquete, o `npx vitest run ruta/al/fichero.prueba.ts`.

En la raíz hay un **`.cmd` por cada tipo de ejecución** para lanzarlos desde el Explorador de Windows sin abrir una consola: `arrancar-web.cmd` (compila el motor y abre la web en el navegador), `arrancar-servidor.cmd`, `arrancar-online.cmd` (las dos cosas a la vez, cada una en su ventana: es lo que hace falta para probar el Multijugador Online), `verificar.cmd`, `compilar.cmd`, `verificar-tipos.cmd`, `probar.cmd`, `probar-motor.cmd`, `probar-web.cmd`, `probar-servidor.cmd` y `limpiar.cmd`. Cada uno lleva dentro su documentación y el catálogo completo; los de pruebas aceptan `ver` para modo watch. **Si cambias los scripts de npm, actualiza el `.cmd` correspondiente.**

**Los ficheros de prueba usan el sufijo `.prueba.ts`** (`.e2e-prueba.ts` para los e2e), no `.spec.ts`. Está configurado en `vitest.config.ts`, en `angular.json` (`test.options.include`) y en los `tsconfig.*.json`; si añades un test con otro sufijo, no se ejecutará.

## Reglas del juego (decididas, no estaban en el plan)

El plan las da por definidas de antes pero no las escribe. Se confirmaron con el usuario y el motor las implementa así:

1. **Quien encuentra mina sigue jugando.** El turno solo pasa al siguiente cuando el clic *no* da mina, así que una racha se premia encadenando clics (`ResultadoClic.repite`). **Esto cambió sobre la marcha**: hasta la Fase 3 el turno pasaba siempre. Si ves código o pruebas que den por hecho que el turno alterna, están desactualizados.
2. **Se puede perder el turno por tiempo.** Si la partida tiene reloj, quien se queda pensando de más lo pierde sin jugar. Ver la sección del reloj más abajo.
3. **La partida termina al destapar la última mina.** No hay final anticipado por marcador: aunque el líder saque una ventaja imposible de remontar, se sigue jugando. **Esto también cambió sobre la marcha**: hasta la Fase 3 existía un fin por «mayoría matemática» que cortaba la partida antes de tiempo; se quitó porque cerraba partidas que el jugador quería terminar. Para salir antes está rendirse. Empate a la cabeza ⇒ `obtenerGanador()` devuelve `null` y `empate` es `true`.
4. **Rendirse saca del juego.** `rendirse(idJugador)` deja al jugador de espectador: no vuelve a recibir turnos (`pasarTurno()` los salta), sus minas dejan de contar y no puede ganar, aunque sigue viendo la partida. Es irreversible. **Si al rendirse queda un único jugador en pie, la partida acaba y gana ese**, tenga el marcador que tenga.

   En la web, quien puede rendirse lo dice `ServicioPartida.humanoQuePuedeRendirse()`: el humano de turno o, **si es el único humano de la mesa, él siempre, también mientras piensa un bot** — atado al turno, una racha larga del rival le dejaba sin poder tirar la toalla justo cuando más ganas tenía. `rendirse()` sin argumento rinde a ese; con un id rinde el puesto que se le diga, bots incluidos (lo usan las pruebas y lo usará el servidor).

   Por eso **con dos jugadores la partida no enseña «Abandonar»** mientras se pueda rendir: rendirse deja al rival solo, con lo que la partida termina igual, pero además destapa el tablero y enseña el marcador final. Con los dos botones eran dos formas de lo mismo, y en Historia todos los niveles hasta el 15 son de dos jugadores. Con tres o más sí son cosas distintas, y con la mesa entera de bots —donde no hay a quien rendir— «Abandonar» vuelve para no dejar al jugador encerrado en la pantalla. Con la partida terminada no sale ninguno de los dos: de ahí se sale por el recuadro del final.
5. **Al terminar se destapa el tablero entero.** `obtenerEstado()` deja de filtrar en cuanto la partida acaba: las celdas que nadie tocó llegan despejadas con su número, y las minas que no encontró nadie —solo puede haberlas si se acabó por rendiciones— con el estado `mina-sin-encontrar`, que durante la partida no aparece jamás. Es una transformación de la vista (`Tablero.aVisible(revelarTodo)`): el tablero interno no se toca.
6. **No hay cascada automática.** Un clic normal destapa **solo la celda clicada**, sea mina, número o celda vacía. Esto contradice la letra de la Fase 1 del plan y fue una decisión posterior del usuario: la cascada existe únicamente como efecto de la onda expansiva.

Otras invariantes del motor: las minas **se reparten en el primer clic**, no al crear la partida, para poder excluir la celda clicada; y `obtenerEstado()` **nunca** revela información oculta mientras se juega — una celda `oculta` lleva `minasAdyacentes: null` y no dice si esconde mina; solo se destapa todo cuando la partida ya ha terminado. Hay pruebas que lo verifican, y es lo que hará jugable la IA de la Fase 2 sin que haga trampas.

## La IA (Fase 2)

`packages/game-engine/src/ia/` tiene dos piezas: `analisis.ts` (traduce el tablero visible a restricciones y saca deducciones) y `jugador-ia.ts` (`JugadorIA`, los 5 niveles).

**El bot recibe un `EstadoPartida` y nada más.** No hay puerta trasera al tablero real, y eso no es disciplina: es que el tipo no lleva esa información. La prueba de que funciona es que los tests construyen estados a mano con `estado-de-prueba.ayuda.ts` — si se pueden dibujar desde fuera, es que no hay nada oculto dentro.

| Nivel | Qué hace |
|---|---|
| 1 | Azar puro |
| 2 | Deducción por celda numerada, encadenada hasta agotarse |
| 3 | Lo anterior más la regla del subconjunto (CSP local) |
| 4 | Sin certezas, va a la celda más probable |
| 5 | Como el 4, y entre empates prefiere la de menos vecinas |

**Todos los niveles pueden gastar la onda**, cada uno con el criterio que le da su inteligencia (`JugadorIA.decidirOnda`): el nivel 1 la tira al azar el 20 % de las veces; los niveles 2 y 3 la gastan sobre una celda que sus deducciones declaran libre, que es donde no se pierde nada; los niveles 4 y 5 además la usan cuando ni siquiera hay libres seguras pero la mejor probabilidad de mina es tan baja que el clic no compensa. Ninguno la gasta teniendo una mina cantada, porque eso puntúa (y ahora además conserva el turno) y la onda no. `elegirJugada` devuelve `usarOnda`: **quien llame a la IA tiene que llamar a `activarOnda()` antes del clic**, o la decisión se pierde en silencio.

En el Modo Entrenamiento **cada bot lleva su propio nivel**: `ConfiguracionPartida.nivelesIA` es un array en orden de asiento (el bot del puesto `numHumanos + i` usa `nivelesIA[i]`) y `ServicioPartida` guarda un `JugadorIA` por puesto. Se puede enfrentar un nivel 1 contra un nivel 5 en la misma partida.

**Los bots no juegan al instante**: `ServicioPartida.retardoDelBot()` sortea entre 0 y 2 s antes de cada jugada suya, con humanos en la mesa o sin ellos. Jugando al instante el tablero cambiaba antes de que te diera tiempo a ver de quién era el turno, y con la regla de que quien acierta repite una racha de bot pasaba en un parpadeo. Esto sustituye al retardo fijo configurable que solo se aplicaba en las partidas de solo bots, que ya no existe ni en la configuración ni en `ConfiguracionPartida`.

**Ojo al sentido invertido**: aquí una celda que con certeza esconde mina es la **mejor** jugada, no la peor. Una que se sabe libre es la peor, porque cede el turno sin puntuar; por eso los niveles 2+ las descartan al elegir a ciegas.

Las probabilidades del nivel 4 son una aproximación: cada celda se queda con la peor cota que le impone alguna celda numerada, y las que no tocan ningún número reciben la densidad general. El cálculo exacto exigiría enumerar todas las combinaciones compatibles y se dispara en tableros grandes.

Los ficheros `*.ayuda.ts` son utilidades solo para pruebas: están excluidos del build en `tsconfig.json` junto a los `*.prueba.ts`.

## La onda expansiva (Fase 3)

El ítem de despeje **se llama «onda expansiva»** (`shockwave` en inglés) y así se nombra en el código: `activarOnda`, `EstadoOnda`, `ONDA_NO_DISPONIBLE`, claves `partida.onda.*`. No lo llames «ítem» ni en código ni en textos.

Es la **única** vía por la que se propaga la cascada. Cada jugador tiene la suya:

- `activarOnda()` la arma; no despeja nada por sí sola, se gasta en el siguiente clic de ese jugador. `desactivarOnda()` se arrepiente sin coste.
- Al gastarla sobre una celda **vacía**, arrastra todas las celdas vacías conectadas y su borde numerado (`Tablero.despejarEnCascada`).
- Sobre una celda **numerada** no hay nada que propagar: se revela ella sola y la onda se pierde. Es la decisión que el jugador tiene que acertar.
- Sobre una **mina**, la mina se apunta con normalidad y la onda se gasta igual.
- Tras gastarse entra en recarga, configurable en segundos.
- Si el jugador pierde el turno por tiempo con la onda armada, **no la pierde**: no llegó a gastarla y le sigue esperando armada.

**En la web, el clic derecho sobre una celda lanza la onda ahí mismo** sin pasar por el botón (`Tablero.celdaPulsadaAlterna` → `ServicioPartida.clicConOnda`). Si la onda no está disponible, ese clic **no destapa nada**: dejar caer el clic normal gastaría el turno en una celda que el jugador eligió pensando en la onda. **En Android, donde no hay botón derecho, se toca dos veces seguidas la misma celda** (`Tablero.dobleToqueAlterno`). Tiene un precio y por eso no está siempre puesto: mientras lo está, un toque suelto no se resuelve hasta que pasan 220 ms sin un segundo — si se resolviera al momento, la celda ya estaría destapada cuando llegara el segundo toque —, así que la pantalla lo enciende **solo cuando hay onda de verdad que gastar** y el resto del tiempo el tablero responde al instante. El botón sigue existiendo de todos modos. Su recuadro va **debajo del tablero**: solo se le enseña a quien puede usarla, y colocado encima hacía saltar el tablero cada vez que le tocaba a un bot. Cuando no toca ya no se desmonta, se oculta conservando su hueco, que es lo que evita que baile lo que tiene debajo; ver «La pantalla de partida».

## El reloj de turno (Fase 3)

`OpcionesPartida.tiempoPorTurnoSegundos` limita lo que puede tardar cada jugador; **0 (el valor por defecto del motor) es sin límite**. El Modo Historia (Fase 4) lo irá bajando nivel a nivel para apretar; el Entrenamiento lo trae a 15 s y deja ponerlo a 0.

El reloj **se reinicia con cada clic**, también cuando el jugador conserva el turno por haber encontrado mina.

**El motor no tiene temporizadores propios**: expone `tiempoRestanteDeTurnoMs()` y `comprobarTiempoDeTurno()`, y es quien lo usa el que tiene que preguntar. Hoy lo hace `ServicioPartida`; en la Fase 6 lo hará el servidor. Mantenlo así — un `setInterval` dentro del motor rompería que sea código puro y que el servidor sea la autoridad.

## Que el motor no llame al reloj del sistema

Tanto la recarga de la onda como el reloj de turno corren con el tiempo y no con los turnos, así que el motor deja de ser una función pura del estado. Por eso `OpcionesPartida` acepta `ahora?: () => number`: las pruebas inyectan un reloj falso y en la Fase 6 mandará el del servidor. **Nunca llames a `Date.now()` dentro del motor**; usa el reloj inyectado.

Como consecuencia, la interfaz tiene que releer el estado periódicamente para que bajen las cuentas atrás y para que el turno expire: `ServicioPartida` levanta un `setInterval` de 250 ms mientras haya algo que contar (una onda recargando o un turno con reloj) y lo apaga solo.

El turno perdido por tiempo se publica como el código de suceso `TURNO_PERDIDO`, que vive en `CodigoSuceso` (motor) junto a los códigos de clic, para que cliente y servidor lo nombren igual.

## El Modo Historia (Fase 4)

En el motor, `packages/game-engine/src/historia/` tiene dos piezas, las dos sin estado:

- `niveles.ts`: los **50 niveles** (el plan decía «por ejemplo 20»; el usuario pidió 50). No están escritos a mano uno por uno: los genera `construirNivel()` con una progresión documentada, y `NIVELES_HISTORIA` se congela al cargar el módulo. La dificultad sube por cuatro vías a la vez —tablero, densidad de minas, nivel de los rivales y reloj de turno— y las pruebas comprueban que cada nivel es jugable de verdad (creando la partida) y que **la dificultad no retrocede nunca** de un nivel al siguiente.
- `progreso.ts`: funciones puras sobre `ProgresoHistoria`. Se avanza **solo ganando**; perder no mueve el progreso ni quita lo conseguido.

**La densidad de minas va con el avance global, no por zonas.** Atada a la zona, el sumando del paso se reiniciaba al cambiar de decena y el nivel 11 salía con menos minas que el 10. Hay una prueba que lo vigila.

En el cliente, `ServicioHistoria` (`nucleo/historia.servicio.ts`) es el puente: guarda el progreso en localStorage (`minehunt.historia`, validado entero como los ajustes) y monta el nivel sobre `ServicioPartida`, que sigue siendo **el único que habla con el motor**. El jugador se sienta siempre en el puesto 0 (`JUGADOR_HUMANO`) y los rivales del nivel detrás; de ahí que ganar sea `ganador === 0`.

**El resultado lo apunta el propio servicio**, con un `effect` que vigila el estado de la partida y registra el nivel en cuanto termina. No lo hace la pantalla a propósito: así da igual por dónde salga el jugador de la partida, que el nivel ganado no se pierde. Un `resultadoApuntado` privado evita apuntarlo dos veces y se rearma solo cuando la partida vuelve a estar en marcha (una revancha del mismo nivel se apunta otra vez).

La pantalla `/historia` (`paginas/historia/`) enseña los 50 niveles en 5 zonas de 10, con lo superado marcado y lo que aún no toca bloqueado, y deja ver tablero, minas, rivales y reloj antes de entrar. La ficha del nivel elegido, con su botón de jugar, va **arriba del todo**, antes del progreso y de las zonas: al abrir la pantalla ya viene seleccionado el nivel que toca, así que se juega sin bajar. Los nombres y descripciones de zona son claves de i18n (`historia.zona.<n>.nombre` y `.texto`), no texto en el código. Se llega desde la tarjeta que abre la pantalla de configuración.

**La partida de un nivel usa la misma pantalla `/partida` que el Entrenamiento.** Cuando `nivelEnCurso()` no es null, la cabecera dice qué nivel es y el final ofrece pasar al siguiente o repetir, y «Abandonar» vuelve al mapa en lugar de a la configuración. Al salir se navega **antes** de descartar la partida (`volverAlMapa()`): la pantalla lleva un `effect` que devuelve a `/` en cuanto no hay partida, y si se descarta primero es ese effect el que decide el destino.

## Los ajustes recordados

`ServicioAjustes` guarda en localStorage (`minehunt.entrenamiento`) lo que se deja puesto en la pantalla de configuración, y la pantalla lo restaura al abrirse; el botón «Restablecer» vuelve a `AJUSTES_POR_DEFECTO` y olvida lo guardado. Se guarda con un `effect` a cada cambio, no al empezar la partida, para que también se recuerde lo que se trasteó sin llegar a jugar.

**Lo que sale de localStorage se valida entero antes de usarse** (`validar()` en `ajustes.servicio.ts`) y, si algo no cuadra, se descarta el lote completo y se vuelve a los valores por defecto: ese texto lo puede haber escrito cualquiera y además sobrevive a los cambios de formato entre versiones. Si añades un ajuste nuevo, añádelo también a la validación, o el lote entero dejará de cargarse en cuanto alguien tenga guardado el formato viejo. El progreso del Modo Historia se guarda igual, con su propia validación en `historia.servicio.ts`, y ahí importa todavía más: un progreso inventado desbloquearía niveles sin jugarlos.

## Identidad y versión de la web

El título de la pestaña es `MineHunt` y el favicon es `apps/web/public/icono.svg`, **copia servible del icono maestro `documentos/MineHunt-icon.svg`**; si se retoca el icono hay que copiarlo otra vez. También se declara como `apple-touch-icon`, y el `theme-color` de `index.html` es el fondo de la paleta.

**No hay `favicon.ico`.** El que había era el de la plantilla de Angular y era el que salía en la pestaña, porque los navegadores piden `/favicon.ico` y ese ganaba al SVG. Se borró: el icono del juego es uno solo. Si alguna vez hace falta una versión rasterizada (o un juego de PNG), sale del icono maestro al generar los recursos de Android en la Fase 5, que es donde hay con qué rasterizar.

La versión que se enseña al jugador (configuración, ayuda y «Acerca de») es `VERSION_APP`, en `nucleo/version.ts`, hoy **0.0.2**. Va a mano para no arrastrar el `package.json` al bundle, y `version.prueba.ts` falla si deja de coincidir con él. **`VERSION_MOTOR` va a la par con ella**, y como `VERSION_MOTOR` es también `VERSION_PROTOCOLO`, el número que el jugador lee es el mismo que decide contra qué servidores puede jugar; `version.prueba.ts` lo comprueba. Al subir la versión se tocan los cuatro `package.json`, `version.ts` del motor, `version.ts` de la web y la prueba del motor.

## El menú principal

La raíz (`/`) es el **menú**, en `paginas/inicio/`: icono, nombre y una entrada por modo de juego. No hace nada más — decidir a qué se juega es lo único que el jugador tiene que hacer al abrir la app.

Por eso la configuración del Entrenamiento, que antes ocupaba la raíz, vive en **`/entrenamiento`**; el Modo Historia sigue en `/historia` y ya no se entra por una tarjeta metida encima de la configuración. Al salir de una partida de Entrenamiento se vuelve a `/entrenamiento` (a montar otra), y al salir de un nivel de Historia al mapa, igual que antes; el menú es solo el destino del `effect` que rescata a quien entra a `/partida` sin partida.

Del menú cuelgan también **la ayuda** (`/ayuda`, las reglas) y **«Acerca de»** (`/acerca`), a la que se llega por su entrada y **tocando el icono del juego**, que es donde todo el mundo pulsa por costumbre. Esa pantalla la lee quien va a jugar, no quien lo programa: **nada técnico** —ni bibliotecas, ni piezas internas, ni dos números de versión—, solo qué es el juego, la firma (**Capicua**, la empresa que lo publica, y el desarrollador) y una sola versión, que vale para todo porque `VERSION_APP` y la del protocolo van a la par. Hay una prueba que falla si se cuela un tecnicismo, y aquí se ve **la presentación del arranque**: `ServicioIntro` decide que salga una sola vez por sesión, porque entre partida y partida se vuelve al menú y verla cada vez sería un peaje. Se salta tocando la pantalla.

**El selector de idioma y el interruptor del sonido viven solo aquí.** Las demás pantallas los tenían repetidos en su cabecera (y la ayuda también colgaba del final de la partida); con un menú que se abre al arrancar y al que se vuelve entre partidas, repetirlos solo llenaba de ruido pantallas que ya piden bastante al jugador. Si añades una pantalla, no le pongas ninguno de los dos — el sonido tiene además su propio botón dentro de la partida, que es donde molesta que suene.

El **Multijugador Online aparece en el menú apagado**, con su etiqueta de «próximamente», hasta la Fase 7. Es un `div` y no un enlace a propósito: la ruta comodín devolvería al propio menú sin explicar nada. Cuando llegue la Fase 7 se convierte en enlace y se le quita la etiqueta.

## Android con Capacitor (Fase 5)

La app de Android **es la misma web** dentro de un WebView: el APK lleva el bundle de `ng build`, no hay una segunda implementación de nada. El proyecto nativo está en **`apps/web/android/`** y va en el repositorio; lo generó `npx cap add android` una vez y a partir de ahí lo escribe `cap sync`.

**`documentos/MineHunt-android.md` es el documento de referencia**: requisitos, ciclo de compilación, dónde queda el APK y el AAB, y firma. Aquí solo lo que hay que tener presente al tocar código:

- **Hace falta el JDK 21, no el 25.** Gradle 8.14 y el plugin de Android 8.13 no lo admiten todavía y la compilación revienta al arrancar. El SDK tiene que traer la plataforma 36.
- `npm run sincronizar-android`, `abrir-android`, `apk-android`, `aab-android` y `recursos-android` (en `apps/web`), más `android-apk.cmd` y `android-abrir.cmd` en la raíz.
- **`webDir` de `capacitor.config.ts` tiene que seguir a `ng build`** (`dist/web/browser`). Si dejan de coincidir, la app se instala y arranca en blanco sin que falle nada antes; `empaquetado.prueba.ts` lo comprueba, junto con que el color de arranque sea el de la paleta.
- **Los iconos y la pantalla de arranque salen del icono maestro**, nunca a mano: `npm run recursos-android` rasteriza `documentos/MineHunt-icon.svg` a `apps/web/resources/` y reparte las densidades. Si se retoca el icono, se relanza.
- **En el WebView el idioma se pregunta dos veces.** `ServicioIdioma` arranca con `navigator.language` para que la primera pantalla salga traducida y luego repasa con `@capacitor/device`, porque en Android el WebView puede no llevar el idioma del teléfono. Solo en nativo, y nunca por encima de la elección manual del jugador.
- **En Android no hay clic derecho**, así que el botón de la onda expansiva es la única vía: no lo quites del tablero pensando que el atajo basta.
- **La pantalla va bloqueada en vertical y sin la barra de navegación**: `android:screenOrientation="portrait"` en el manifest y `MainActivity` escondiéndola con `WindowInsetsControllerCompat` (de `androidx.core`, que ya entra por `appcompat`). Los dos ficheros son fuente del proyecto nativo y `cap sync` no los pisa. Se esconden las dos, la de navegación y la de estado, con `WindowInsetsCompat.Type.systemBars()`. **No se pueden quitar del todo**: deslizando desde el borde vuelven un momento, y hay que reesconderlas en `onWindowFocusChanged` porque también vuelven al recuperar el foco. `empaquetado.prueba.ts` vigila las dos cosas, que de otro modo solo se notan con el teléfono en la mano.

Los ajustes de interfaz para el móvil viven donde toca y no en un CSS aparte: el lado de la celda se reparte entre el ancho de la ventana (`--columnas` lo publica el componente del tablero, así que el tablero entra siempre en la pantalla), y en `styles.css` están `env(safe-area-inset-*)` para la muesca, `overscroll-behavior` para el rebote y la selección de texto apagada salvo en la ayuda.

## La pantalla de partida

**Nada de lo que hay por encima del tablero puede cambiar de tamaño mientras se juega.** Si algo se monta o se desmonta ahí arriba, el tablero pega un salto justo cuando el jugador iba a clicar y el clic acaba donde no era. De ahí el reparto de la pantalla:

- La cabecera **solo informa**: de qué nivel es la partida, de quién es el turno, cuántas minas quedan y el reloj. Nada de botones.
- **Rendirse y abandonar van al pie**, después del aviso. Aparecen y desaparecen según de quién sea el turno, y la confirmación de rendirse ocupa mucho más que el botón; ahí abajo puede crecer sin mover nada, y además queda lejos de donde se clica.
- Lo que deja de tener sentido a mitad de partida **no se desmonta**: se le pone la clase **`.hueco`** (`visibility: hidden`), que conserva su caja exacta y lo saca del foco y del árbol de accesibilidad, sin tener que adivinar el alto en un `min-height`. La llevan el reloj cuando la partida termina y el recuadro de la onda cuando no le toca a un humano.

Queda un caso sin cubrir: en el marcador, la etiqueta «rendido» puede hacer crecer una línea la ficha del que se rinde y empujar el tablero. Solo pasa con tres o cuatro jugadores —a dos, rendirse acaba la partida— y una sola vez por rendición.

## El servidor (Fase 6)

`apps/server/src/salas/` tiene el multijugador online. **`documentos/MineHunt-servidor.md` es el documento de referencia** —protocolo completo, decisiones y lo que necesitará la Fase 7—; aquí solo lo que hay que tener presente al tocar código.

- **El servidor es la autoridad.** Dentro de cada sala hay un `MotorJuego` de verdad, el mismo paquete que usa el cliente. Los clientes mandan intenciones y reciben el estado que salga; nadie juega fuera de su turno porque el servidor comprueba de quién es, y nadie ve una mina antes de tiempo porque el estado que se manda es el que el motor deja ver a cualquiera.
- **`Sala` no sabe nada de Socket.IO ni de Nest**, y así se queda: recibe llamadas y devuelve `Resultado<T>`, lo que permite probar las reglas enteras sin levantar un servidor. La pasarela solo conecta cables y difunde.
- **Las respuestas van por el acuse de recibo** de Socket.IO, no por un mensaje aparte, y siempre con la misma forma: `{ ok: true, datos }` o `{ ok: false, error }`.
- **Ni un texto traducido sale de aquí**, igual que manda la convención 3: códigos de suceso y de error, y datos crudos. Las claves con las que el cliente los traduce son las mismas del Modo Entrenamiento.
- **El reloj y el azar se inyectan** (`RELOJ` y `AZAR`, en `salas/dependencias.ts`), por lo mismo que en el motor. Ojo: **el código de sala usa el azar del sistema y no el inyectado**, porque las pruebas fijan el suyo en una constante y todas las salas pedirían el mismo código.
- **El motor sigue sin temporizadores propios.** La pasarela repasa las salas cada 250 ms y les pregunta por el reloj del turno; ese mismo repaso hace jugar a los bots sustitutos y recoge las salas vacías. No metas un `setInterval` dentro de `Sala` ni del motor.
- **Quien entra dice con qué versión viene** y si no encaja se queda fuera (`VERSION_INCOMPATIBLE`). Se comparan `major.minor` de `VERSION_PROTOCOLO`, que es `VERSION_MOTOR` y va a la par con `VERSION_APP`: **si tocas el protocolo, sube la minor de la versión del juego** (hoy 0.0.2 → 0.1.0), o un cliente viejo entrará creyendo que se entiende. Dentro de una misma minor todo es compatible, que es lo que permite publicar arreglos sin echar a nadie.
- **La pasarela valida lo que entra** antes de pasarlo a la sala (`PETICION_INVALIDA`). No es paranoia: sin eso, una coordenada que no es un entero revienta dentro del manejador y quien preguntó se queda esperando un acuse de recibo que no llega. Si añades un mensaje, valida su carga.
- Terminada la partida, `volver-al-lobby` deja la sala lista para otra y **echa a los que no volvieron**, o la siguiente empezaría con puestos fantasma a los que un bot juega desde el primer turno.
- **Una sala puede ser pública o privada y llevar bots.** Privada no es cerrada: se entra con el código, pero no se anuncia en `salas-abiertas`. Los bots se sientan **detrás de los humanos** y cuentan como jugadores; quien entra se coloca delante de ellos, porque los ids del motor tienen que ser correlativos.
- **La raíz del servidor es su panel de salas** (`panel/`), no una línea de texto: código, quién la abrió, jugadores (con bots y ausentes aparte), pública o privada, en el lobby o en partida, y cuánto lleva abierta. Salen **todas** las salas, también las privadas y las que ya juegan, porque esto lo mira quien lleva el servidor y no quien busca partida: por eso `Sala.informe()` no es `Sala.resumen()`. Lo pinta el servidor entero, y el navegador solo vuelve a pedir `/panel/salas` cada tres segundos. Su icono —el de la cabecera y el de la pestaña— es una **copia literal del icono maestro** dentro de `panel.ts`, porque la imagen de la Fase 9 no llevará la carpeta de documentación dentro; `panel.prueba.ts` falla si se queda atrás del maestro. **Es el único sitio del proyecto con texto escrito a mano en lugar de claves de i18n** —ningún jugador ve esta página, la aplicación habla por el socket—, y **el nombre del anfitrión se escapa** porque lo teclea cualquiera. `/panel` responde lo mismo y es la ruta que quedará cuando en la Fase 9 la raíz la ocupe la web.
- Las pruebas e2e (`npm run probar:e2e --workspace @minehunt/server`) levantan la aplicación y juegan partidas completas de 2, 3 y 4 jugadores con clientes de `socket.io-client` de verdad. **No van en `npm run verificar`**, que solo lanza las unitarias.

## El Multijugador Online (Fase 7)

`paginas/online/` es la pantalla y `nucleo/online.servicio.ts` el estado. **`ServicioOnline` es el gemelo de `ServicioPartida`**: publica señales con la misma forma para que las pantallas se repinten solas, con la diferencia de que aquí **no hay motor**. El tablero llega hecho del servidor y lo único que se manda son intenciones, así que este servicio no valida ni una regla: si una jugada no vale, lo dice el servidor.

- **El protocolo se importa de `@minehunt/game-engine`**, nombres de mensajes incluidos. No lo redeclares aquí.
- **Al entrar se manda `VERSION_PROTOCOLO`.** Si el servidor contesta `VERSION_INCOMPATIBLE`, es que la aplicación se quedó atrás; ese texto ya está traducido en los dos idiomas.
- **La credencial que devuelve el servidor se guarda** en localStorage (`minehunt.online`), validada al leerla como todo lo demás. Es lo único que recupera el puesto tras cerrar la aplicación o perder la conexión, y por eso hay un botón de «Volver a mi sala». Si el servidor ya no la reconoce **se olvida**, o el jugador se queda intentando volver a una partida que no está.
- **Las cuentas atrás las baja el cliente.** El servidor solo difunde cuando pasa algo, así que el reloj del turno y la recarga de la onda se calculan restando lo transcurrido desde que llegó el último estado. El latido de 250 ms solo vive mientras haya algo que contar.
- **La URL del servidor está en `nucleo/servidor.ts`**, con un ajuste guardado que la sobrescribe. En el navegador el valor por defecto es el propio origen (lo que acertará en la Fase 9), salvo en el `ng serve` del 4200; y en Android nunca es el origen, que ahí es el propio teléfono. En esos dos casos cae a `SERVIDOR_DE_DESARROLLO`, **la IP fija del PC de desarrollo**, hoy `http://192.168.100.101:3000`. Es provisional y no cierra nada: el ajuste de «Cambiar de servidor» sigue ahí y lo guardado gana.
- **Esperar al servidor se ve y se puede cancelar.** Entrar en una sala puede no llegar nunca —servidor apagado o fuera de alcance—, así que la espera lleva límite de tiempo y sale un diálogo con la rueda y un botón de cancelar. Cancelar corta también la conexión: si el servidor contestara después, la sala existiría y el jugador estaría fuera de ella sin saberlo.
- **La sala se configura como el Entrenamiento**, con las mismas claves de texto (`configuracion.*`): tablero, minas, reloj, recarga, más pública o privada y los bots que se sientan.
- **El código de sala se copia y se comparte con botones**, porque no se puede seleccionar con el dedo: la aplicación apaga la selección de texto para que no estorbe al clicar. En Android se abre la hoja de compartir del sistema (`@capacitor/share`).
- Las tres pantallas (entrar, lobby y partida) son **una sola ruta**, `/online`, porque son el mismo sitio en tres momentos. El tablero es el mismo componente que en los otros modos, y las claves de sucesos y errores también.
- **En Android, el WebView se sirve por `http`** (`server.androidScheme` en `capacitor.config.ts`). Con el `https` que trae Capacitor por defecto, hablar con el servidor por `http`/`ws` es contenido mixto y **Chromium lo corta dentro del teléfono, sin que se vea ningún error de red porque no llega a haber red**. Ojo: cambiar el esquema cambia el origen y **borra el `localStorage` del teléfono**, así que con la aplicación publicada no se toca. Además, el tráfico en claro de Android (`android/app/src/debug/AndroidManifest.xml`) y el contenido mixto (`MIXED_CONTENT_ALWAYS_ALLOW` en `MainActivity`) están permitidos **solo en depuración**; la compilación de publicación sigue exigiendo https.
- **El socket va por WebSocket, con `polling` de reserva**: si el WebSocket no se puede abrir, es mejor una partida por peticiones largas que ninguna partida.
- **El nombre del jugador se recuerda aparte de la credencial** (`ServicioJugador`, clave `minehunt.jugador`), y se guarda según se escribe. La credencial se olvida al dejar la sala; el nombre no tiene por qué irse con ella.

## El pulido (Fase 8)

**`documentos/MineHunt-web.md` es el documento de referencia del cliente**: desarrollo, build de producción, presupuestos de tamaño, aplicación instalable e iconos. Lo que hay que tener presente al tocar código:

- **Las estadísticas las cuenta el motor**, dentro de `EstadoPartida` (`Jugador.estadisticas`): clics, celdas reveladas, ondas usadas, mejor racha y turnos perdidos por tiempo. Al viajar en el estado valen igual para el Entrenamiento, la Historia y el Online, sin que el servidor tenga que mandar nada aparte. La puntería no se guarda: es una división y la hace la pantalla. `VERSION_MOTOR` subió a **0.10.0** por el cambio de forma del estado.
- **El resumen del final es un componente compartido** (`componentes/resumen-final/`), y sustituye a la clasificación que cada pantalla pintaba por su cuenta. Solo pinta: recibe los jugadores y **los nombres ya resueltos**, porque cada modo los nombra a su manera («Jugador 2» y «Bot 1» en local, el nombre que se puso cada uno en el Online).
- **Un jugador, una línea**: nombre a la izquierda y, pegadas al borde derecho, las minas y la puntería. De las cinco estadísticas que cuenta el motor **solo sale una**, la puntería (de la que la pantalla saca la división): clics, celdas, ondas y mejor racha son el detalle de cómo se llegó al resultado, no el resultado, y pintarlas obligaba a una rejilla debajo de cada nombre que en un teléfono en vertical eran cuatro pantallas de resumen para cuatro jugadores. Los turnos perdidos son la excepción y solo salen si hubo alguno, porque no cuentan cómo se jugó sino cómo se dejó de jugar. Si alguna vuelve, que sea a propósito: hay una prueba que lo vigila.
- **El sonido se sintetiza con Web Audio** (`nucleo/sonido.servicio.ts`): **no hay ni un fichero de audio en el repositorio** y no debe haberlo sin una razón de peso — nada que licenciar, nada que engorde el APK. El contexto de audio se crea con el primer sonido, no antes, porque los navegadores no dejan sonar sin un gesto del jugador. Nada de esto puede tumbar una partida: sin Web Audio el juego sigue igual. Se enciende y se apaga desde el menú principal, donde viven las cosas que valen para todo el juego, y se recuerda en `minehunt.sonido`.
- **La vibración es el gemelo táctil del sonido** (`nucleo/vibracion.servicio.ts`): recibe los mismos `CodigoSuceso` y decide un golpe para cada uno, así que vale igual para los tres modos sin que ninguna pantalla sepa nada. **Solo en la aplicación de Android** (`Capacitor.isNativePlatform()`): en un navegador no se ofrece ni el interruptor, porque no habría nada que mover. Se enciende y se apaga en el menú principal y también dentro de la partida, al lado del sonido, y se recuerda en `minehunt.vibracion`. Qué se nota con cada suceso lo decide `golpeDelSuceso()`, una función pura y aparte para poder probarla sin teléfono delante.
- **Quien vibra es un plugin del proyecto y no `@capacitor/haptics`**: `apps/web/android/app/src/main/java/com/minehunt/app/VibracionPlugin.java`, registrado a mano en `MainActivity` **antes de `super.onCreate`**, que es donde Capacitor levanta el puente. Aquel llama al vibrador **sin declarar atributos**, y una vibración sin declarar sale como `USAGE_UNKNOWN`; declarando `USAGE_ASSISTANCE_SONIFICATION` —lo que parecía tocar— sale como `USAGE_TOUCH`. Las dos las apaga el ajuste **«respuesta táctil»** del sistema, que en el teléfono de pruebas venía apagado con todo lo demás encendido, y lo peor es que el vibrador **acepta la orden y resuelve la llamada igual**: desde la web era indistinguible de que el juego no pidiera vibrar. El plugin del proyecto declara `VibrationAttributes.USAGE_MEDIA`, que no apaga ni ese ajuste ni el silencio —es un aviso del juego, no la respuesta del sistema a un toque—, y **devuelve un informe** de si hay vibrador y por dónde se fue. Ese permiso `VIBRATE` entraba fusionado desde el manifiesto de haptics y ahora lo declara el nuestro.
- **Los tres caminos de la vibración se inyectan** con el token `VIBRADOR` (`nucleo/vibracion.plugin.ts`), como el reloj y el azar del motor: plugin del proyecto, `@capacitor/haptics` de reserva y `navigator.vibrate` de última red. Es lo que permite probar **el orden de los intentos** con TestBed, que es justo lo que no se ve con el teléfono en la mano —desde fuera los tres se parecen en que no vibran—; el constructor de pruebas de Angular no admite `vi.mock` con importaciones relativas. Cada intento **se apunta** en `ultimoInforme()` y sale por consola con el prefijo `[MineHunt/vibracion]`; el lado nativo escribe con la etiqueta `MineHuntVibracion`. Para verlo: `adb logcat -v brief MineHuntVibracion:V chromium:I *:S`.
- **En las partidas locales el puesto 0 se llama por su nombre** si el jugador dejó uno puesto (`ServicioJugador`, el mismo del Online): «Jugador 1» es lo que se dice cuando no hay nada mejor. Lo resuelve `Partida.nombreDe()` en TypeScript y no la tubería de traducción, porque hay que elegir entre un nombre y una clave; es seguro porque **el idioma no se cambia desde una partida**. Los demás puestos del hotseat siguen siendo números: el nombre recordado es de una sola persona.
- **Las animaciones del tablero son CSS y nada más.** Una celda estrena su clase al destaparse y la animación arranca justo ahí, así que se anima una sola vez y sin temporizadores ni orquestación desde TypeScript. **Se respeta `prefers-reduced-motion`**: en un juego de clics, las celdas se mueven donde el jugador está pulsando.
- **Hay un manifiesto por idioma** (`public/manifest.es.json` y `manifest.en.json`), porque el nombre y la descripción con los que se instala la aplicación los lee el navegador antes de que arranque nada y ngx-translate no llega a tiempo. `index.html` enlaza el de reserva y `ServicioIdioma` cambia el `href` con el idioma. Si añades un idioma, añade su manifiesto.
- **El sonido de los botones lo dispara el componente raíz**, con un solo oyente de clic (`App.sonarSiEsBoton`), no botón a botón: son decenas repartidos por siete pantallas y el primero que se añadiera se quedaría mudo. Las celdas del tablero quedan fuera, que ya suenan con lo que provoca la jugada.
- **El sonido se puede apagar desde dentro de la partida**, con el botón `.silencio` del pie. Va al pie y no a la cabecera —que solo informa— y es cuadrado y solo con icono para que no cambie de ancho al alternar.
- **Lo que comparten dos pantallas vive en `styles.css`**: los botones (`.principal`, `.secundario`, `.discreto`), el color de cada jugador, el bloque de confirmación y el botón de silencio. No es solo estética: **cada hoja de estilos de componente tiene su propio presupuesto de tamaño** (6 kB de aviso), y `online.css` lo reventó justo por tener repetido lo que ya estaba en `partida.css`.
- **En una confirmación, la pregunta va en su línea y los dos botones en la suya**, siempre juntos y repartiéndose el ancho: en un teléfono estrecho el «no» se caía solo a la línea de abajo y la pareja dejaba de leerse como una elección.
- **Los iconos de la web también salen del icono maestro**: `npm run recursos-web` genera los PNG del manifiesto, incluido el enmascarable con su margen. Al retocar el icono se relanzan los dos scripts, el de web y el de Android.

## El botón de atrás del teléfono

`ServicioBotonAtras` (`nucleo/atras.servicio.ts`) decide a dónde lleva, y se engancha una sola vez desde el componente raíz. Hay que decidirlo a mano: por defecto Capacitor tira del historial del WebView, donde están todas las idas y venidas entre el mapa de niveles y la partida, así que «atrás» acababa en pantallas que no tenían nada que ver con lo que el jugador estaba mirando.

- Desde cualquier pantalla se vuelve **al menú principal**, que es de donde se sale a todo lo demás.
- Desde el menú principal se **sale de la aplicación** (`App.exitApp()`).
- Desde una partida **se pregunta antes de dejarla**, con un diálogo encima de todo. Esto el servicio no lo decide: publica `salidaPedida` y la atiende la pantalla de partida, que es la que sabe si hay algo que perder —con la partida ya terminada se sale sin preguntar— y a dónde volver después.

El diálogo es **solo para el atrás**: el botón «Abandonar» de la pantalla no pregunta, porque hay que ir a buscarlo, mientras que el gesto de atrás se hace sin mirar y se lleva la partida por delante. Usa `@capacitor/app`, que es el plugin que expone el evento; en el navegador `escuchar()` no hace nada y atrás sigue siendo el del navegador.

## La pantalla de ayuda

`apps/web/src/app/paginas/ayuda/` explica las reglas al jugador, en la ruta `/ayuda`. Sus secciones son una lista declarativa (`SECCIONES` en `ayuda.ts`) y cada una se traduce en `ayuda.<seccion>.titulo` y `ayuda.<seccion>.texto` de los dos ficheros de idioma.

**Cuando cambie una regla del juego hay que actualizar esa pantalla en el mismo cambio.** Es lo único donde el jugador lee las reglas, y una regla mal contada se nota más que un fallo de código. `ayuda.prueba.ts` comprueba que cada sección tenga título y texto en español y en inglés, así que olvidarse de un idioma rompe las pruebas, pero **un texto desactualizado no lo detecta nadie**: eso va en la revisión.

Se entra **solo desde el menú principal**, como el selector de idioma. Nunca desde una partida en curso: el reloj del turno sigue corriendo mientras se lee, y entrar a mirar las reglas costaría turnos.

## Versiones fijadas

Angular 22 exige **TypeScript >=6.0 <6.1**, así que el monorepo va con **TypeScript 6.0.3** — no lo subas a la 7 (el compilador nativo) sin comprobar antes que Angular lo acepta. Node 24 LTS, Angular 22.1, NestJS 12, Vitest 4.1, Capacitor 8.5. Los tres paquetes usan Vitest; Angular lo hace con jsdom, así que no hace falta Chrome ni Karma.

## Qué es MineHunt

Buscaminas **invertido**: el objetivo es *encontrar* minas, no evitarlas. Multijugador por turnos (2-4 jugadores, humanos y/o bots). Un clic revela o bien una mina (que se anota en el marcador del jugador) o bien un número de minas adyacentes. Quien encuentra mina sigue jugando; quien falla cede el turno, y también lo pierde si se le acaba el tiempo. Existe la «onda expansiva», con recarga, que es lo único que despeja en cascada. Gana quien más minas encuentre.

## Convenciones no negociables

1. **Todo el código en español.** Nombres de variables, funciones, clases y comentarios en español, sin excepción (`crearPartida`, `clicCelda`, `obtenerEstado`, `ModuloPrincipal`, `ServicioPrincipal`). Los *nombres de fichero* que imponen Angular y el CLI de Nest se mantienen (`app.module.ts`, `app.config.ts`, `main.ts`) para no romper sus schematics; lo que va en español es el contenido.
2. **Ningún texto visible hardcodeado.** Todo texto de UI se referencia por clave de `@ngx-translate/core` y vive en `assets/i18n/es.json` y `assets/i18n/en.json`. Al añadir una pantalla o mensaje, se añaden las claves en **ambos** ficheros en el mismo cambio. La única excepción es el panel de salas del servidor (`apps/server/src/panel/`), que no lo ve ningún jugador sino quien administra el servidor; no la amplíes a nada más.
3. **El servidor nunca envía texto traducido.** Emite códigos de evento en español (`MINA_ENCONTRADA`, `TURNO_SIGUIENTE`, `PARTIDA_TERMINADA`) más datos crudos; el cliente compone el texto en el idioma del jugador que mira. Esto permite que dos jugadores en la misma partida la vean cada uno en su idioma.
4. **La IA solo ve lo que vería un humano.** Los bots reciben el estado *visible* del tablero; jamás la posición de minas ocultas. Debe haber tests que lo verifiquen.
5. **TypeScript estricto** en todos los paquetes.

## Arquitectura

**`documentos/MineHunt-proyectos.md` es el mapa completo**: qué es cada paquete, qué contiene y de qué depende. Lo esencial:

- `packages/game-engine` — librería TypeScript **pura**: sin Angular, sin DOM, sin dependencias de runtime del navegador. Contiene generación de tablero, revelado y cascada, cálculo de adyacencias, turnos, marcador, ítem de despeje, módulo de IA y la tabla declarativa de niveles del Modo Historia. En `src/red/protocolo.ts` está además **el contrato del multijugador online** (nombres de los mensajes y forma de los datos): ahí no hay reglas ni nada que se ejecute, y vive aquí porque es el vocabulario común de cliente y servidor, igual que `CodigoSuceso`. Lo importan los dos desde `@minehunt/game-engine`; ni se redeclara en la web ni se saca a un cuarto paquete.
- `apps/web` — Angular 18+ con standalone components; consume `game-engine` como dependencia de workspace. Se empaqueta a Android con Capacitor (Fase 5).
- `apps/server` — NestJS + Socket.IO; consume **la misma** `game-engine` como fuente de verdad autoritativa (valida cada clic y difunde el estado).

`apps/web` y `apps/server` declaran `@minehunt/game-engine` como dependencia (`"*"`, resuelta por npm workspaces mediante junction) y ambos lo importan de verdad, con pruebas que lo comprueban — así una rotura del enlace del monorepo sale en los tests.

Dentro de `apps/web/src/app`: `nucleo/` tiene los servicios con estado (`ServicioIdioma`, `ServicioPartida`, `ServicioAjustes`), `paginas/` las pantallas enrutadas con carga diferida y `componentes/` lo reutilizable. **`ServicioPartida` es el único que habla con el motor**; las pantallas leen sus señales. En la Fase 7 ese servicio es el que se sustituye por el estado que llega del servidor, sin tocar los componentes.

La decisión estructural clave es que el motor de juego es una sola implementación compartida entre cliente y servidor. Lógica de juego nueva va en `game-engine`, nunca en un componente Angular ni en un gateway de NestJS; esos dos solo orquestan y presentan.

En el cliente conviven tres modos que comparten los mismos componentes de tablero: Entrenamiento (motor local, hotseat + bots), Historia (progresión de 50 niveles, progreso en localStorage) y Multijugador Online (el motor local se sustituye por el estado que llega del servidor).

## Idioma de la interfaz

Detección al arrancar con `navigator.language`: `es-*` → español, cualquier otro → inglés por defecto. Un selector manual sobrescribe la detección y la elección se persiste en localStorage (`minehunt.idioma`). Dentro del WebView de Android `navigator.language` puede no ser fiable: usar `@capacitor/device` si hace falta.

Los textos viven en `apps/web/public/assets/i18n/{es,en}.json` y se sirven en `/assets/i18n/`. Angular 22 copia `public/` a la raíz del build; **no existe `src/assets/`**. Al añadir un texto hay que tocar los dos ficheros en el mismo cambio, o el idioma que falte cae al inglés por el `fallbackLang`.

Los códigos del motor (`MINA_ENCONTRADA`, `CELDA_YA_REVELADA`…) tienen clave propia bajo `partida.evento.*` y `error.*`. **`ServicioPartida` guarda el código, nunca el texto ya traducido**, y la plantilla lo traduce — que es exactamente el contrato que el servidor tendrá que respetar en la Fase 6.
