# MineHunt en Android

La app de Android **es la misma web** metida dentro de un WebView con
[Capacitor](https://capacitorjs.com). No hay una segunda implementación del
juego: el APK lleva dentro el bundle que produce `ng build`, así que todo lo que
funciona en el navegador funciona en el móvil.

El proyecto nativo vive en **`apps/web/android/`** y está en el repositorio.
Lo generó `npx cap add android` una sola vez; a partir de ahí se toca solo
cuando haga falta (permisos, versión de la app), y lo demás lo escribe `cap
sync` en cada compilación.

## Lo que hace falta tener instalado

| Herramienta | Versión | Por qué esa |
|---|---|---|
| JDK | **21** | Gradle 8.14 y el plugin de Android 8.13 no admiten todavía el JDK 25. Con el 25 la compilación falla nada más arrancar. |
| Android SDK | plataforma **36** | Es la que compila el proyecto (`compileSdkVersion`). Se instala desde Android Studio o con `sdkmanager`. |
| Android Studio | opcional | Solo para abrir el proyecto, el emulador y firmar desde la interfaz. Para compilar basta con el SDK y el JDK. |

Las dos variables de entorno que hay que tener puestas:

```bat
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
```

Gradle se descarga solo la primera vez (lo trae el *wrapper* del proyecto), así
que la primera compilación tarda bastante más que las siguientes.

**El asistente de primera ejecución de Android Studio no basta por sí solo.**
Dos cosas que hay que revisar aparte, comprobadas al montar el entorno desde
cero:

- Instala por defecto la plataforma **más reciente** del SDK Manager, no la
  36 que pide este proyecto. Hay que añadirla a mano si el asistente trajo
  otra: `sdkmanager "platforms;android-36"` (o con el `android` CLI que lo
  sustituye, `android sdk install "platforms/android-36"`).
- No instala las **cmdline-tools** (`sdkmanager`/`android` no existen hasta
  que se bajan aparte de la página de Android Studio y se colocan en
  `$ANDROID_HOME/cmdline-tools/latest/`).

La señal de que todo encaja de verdad es un `gradlew assembleDebug` limpio
que termine en `BUILD SUCCESSFUL`.

## El ciclo de trabajo

Siempre son los mismos tres pasos, y los scripts los encadenan:

1. `ng build` deja la web en `apps/web/dist/web/browser`.
2. `cap sync android` copia esa carpeta dentro del proyecto nativo y actualiza
   los plugins.
3. Gradle compila el APK o el AAB.

```bash
# Desde apps/web
npm run sincronizar-android    # ng build + cap sync android
npm run abrir-android          # abre el proyecto en Android Studio
npm run apk-android            # + gradlew assembleDebug  -> APK de prueba
npm run aab-android            # + gradlew bundleRelease   -> AAB para la tienda

# Los dos ultimos llaman a .\gradlew.bat y no a ./gradlew: npm lanza sus
# scripts con cmd.exe en Windows, cmd no entiende el "./", y el ".\" hace
# falta porque con NoDefaultCurrentDirectoryInExePath puesto (lo normal en
# Windows) cmd no busca ejecutables en el directorio actual.
```

Desde la raíz, con `--workspace`:

```bash
npm run sincronizar-android --workspace @minehunt/web
npm run apk-android --workspace @minehunt/web
```

O sin consola, desde el Explorador: **`android-apk.cmd`** y
**`android-abrir.cmd`** en la raíz del repositorio.

### Dónde queda lo compilado

| Qué | Dónde |
|---|---|
| APK de depuración | `apps/web/android/app/build/outputs/apk/debug/app-debug.apk` |
| AAB de publicación | `apps/web/android/app/build/outputs/bundle/release/app-release.aab` |

El APK de depuración se instala en un móvil con la depuración USB activada:

```bash
adb install -r apps/web/android/app/build/outputs/apk/debug/app-debug.apk
```

### Firmar la versión de publicación

`bundleRelease` produce un AAB **sin firmar** mientras no haya un almacén de
claves. Para publicar en Google Play hace falta crear uno (`keytool -genkey`) y
declararlo; Capacitor lo lee de `capacitor.config.ts`, en
`android.buildOptions`, o se configura en `android/app/build.gradle`. **La
clave no se guarda en el repositorio**: va fuera, y en la máquina que compile.
Esto es de la Fase 10 (publicación en Google Play), aquí solo queda apuntado.

## Iconos y pantalla de arranque

Salen todos del icono maestro `documentos/MineHunt-icon.svg`, y **no se editan a
mano**:

```bash
npm run recursos-android --workspace @minehunt/web
```

Ese script (`herramientas/generar-recursos-android.mjs`) hace tres cosas.
Primero rasteriza el SVG a los PNG que Capacitor espera, en
`apps/web/resources/`:

- `icon-only.png` — el icono completo, con su fondo redondeado.
- `icon-background.png` y `icon-foreground.png` — las dos capas del icono
  adaptativo. Android recorta la de delante con la forma que use el lanzador
  (círculo, cuadrado redondeado…), así que el dibujo se encoge al 62 % para que
  no se coman los pinchos de la mina.
- `splash.png` y `splash-dark.png` — la pantalla de arranque, el icono centrado
  sobre el fondo de la paleta. Son la misma imagen: el juego es oscuro siempre.

Después llama a `capacitor-assets` para repartirlos por las densidades de
`android/app/src/main/res/`.

Y por último retoca el icono adaptativo: `capacitor-assets` mete **las dos**
capas hacia dentro un 16,7 %, y encogida también la de atrás el icono sale con
un halo transparente alrededor. El fondo se deja a sangre y el encogido se
queda solo en la capa de delante, que es donde hace falta.

**Si se retoca el icono maestro, se vuelve a lanzar** y se sincroniza. Los PNG
de `resources/` y lo repartido en `res/` se versionan los dos: así un clon
recién hecho compila sin tener que regenerar nada.

## El idioma dentro del WebView

`navigator.language` en un WebView de Android puede devolver el idioma del
WebView y no el del teléfono. Por eso `ServicioIdioma` arranca con lo que diga
el WebView —para que la primera pantalla salga ya traducida— y en cuanto puede
le pregunta al sistema con `@capacitor/device`, corrigiendo si no coinciden.

Solo lo hace en Android (`Capacitor.isNativePlatform()`) y **nunca pisa la
elección manual** del jugador: si eligió idioma en el menú, manda el suyo.

## Ajustes de la interfaz para el móvil

- El **lado de la celda se reparte** entre el ancho de la ventana, así que el
  tablero entra siempre en la pantalla en vez de desbordarse, sea cual sea el
  nivel.
- `touch-action: manipulation` en las celdas, para que el navegador no espere al
  doble toque (que es zoom) antes de dar por buena la jugada.
- `viewport-fit=cover` y `env(safe-area-inset-*)` en el `body`: la app llega al
  borde en móviles con muesca, sin que el contenido se meta debajo.
- Sin rebote de scroll ni «tirar para recargar» (`overscroll-behavior: none`), y
  sin selección de texto al pulsar rápido, salvo en la ayuda.
- La onda expansiva **se lanza con el botón**: en Android no hay clic derecho,
  que en la web es el atajo.

## La pantalla: siempre vertical y sin barras del sistema

Las dos cosas viven en el proyecto nativo, y **`cap sync` no las pisa**: copia el
bundle y regenera lo de los plugins y Gradle, pero el manifest y `MainActivity`
son fuente y van en el repositorio.

### Vertical

`android:screenOrientation="portrait"` en la `<activity>` de
`android/app/src/main/AndroidManifest.xml`. El `android:configChanges` que trae
Capacitor ya incluía `orientation|screenSize`, así que la actividad no se
recreaba al girar; lo que impide el giro es este atributo.

Tiene un coste que conviene conocer: el lado de la celda se reparte entre el
ancho de la ventana y los niveles altos de Historia son anchos (el 50 es de
21×15), así que en vertical salen celdas de la mitad de tamaño que en
horizontal. Si algún día molesta, la salida es que el tablero haga scroll
horizontal propio, no soltar la orientación.

Otros valores, por si cambia el criterio: `userPortrait` (permite el 180º si el
teléfono lo tiene activado), `sensorPortrait` (vertical en los dos sentidos),
`landscape`, `sensorLandscape` y `locked`, que congela la orientación con la que
arranque la app.

### Sin barras del sistema

`MainActivity` esconde las dos —la de navegación de abajo y la de estado de
arriba, con la hora y la batería— usando `WindowInsetsControllerCompat`, de
`androidx.core`, que ya entra por `appcompat`: no hay dependencia nueva ni
plugin. Tres cosas que hay que saber:

- **No se pueden quitar del todo.** Con `BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE`,
  deslizar desde el borde las saca un momento y se esconden solas. Fuera del
  modo quiosco (device owner) Android no da más, y tampoco interesa: la de
  navegación es por donde se sale de la aplicación.
- **Hay que volver a esconderlas al recuperar el foco.** Vuelven solas cuando el
  jugador cambia de aplicación o apaga la pantalla; de ahí el
  `onWindowFocusChanged`.
- **Se esconden con `WindowInsetsCompat.Type.systemBars()`**, que son las dos a
  la vez. Si algún día se quiere dejar la de arriba a la vista, ese `systemBars()`
  pasa a ser `navigationBars()` y no hay que tocar nada más.

El WebView pasa a pintar de borde a borde (`setDecorFitsSystemWindows(false)`) y
los huecos los sigue dejando el documento con `env(safe-area-inset-*)`, que ya
estaba puesto.

`empaquetado.prueba.ts` comprueba las dos cosas: son ajustes que solo se notan
con el teléfono en la mano y que no se ven al revisar un cambio.

## Tráfico en claro, solo en depuración

`android/app/src/debug/AndroidManifest.xml` pone `usesCleartextTraffic="true"`.
Hace falta para probar el Multijugador Online contra el servidor del PC, que en
la red local se sirve por `http://` a una IP; con `targetSdk 36` el WebView lo
bloquea por defecto.

Ese fichero **solo se mezcla en la compilación de depuración**: el APK y el AAB
de publicación siguen exigiendo `https`, que es lo que tocará en la Fase 9.

**A qué servidor apunta la app instalada:** por defecto, a la IP fija del PC de
desarrollo (`SERVIDOR_DE_DESARROLLO`, en `apps/web/src/app/nucleo/servidor.ts`),
hoy `http://192.168.100.101:3000`. Dentro del WebView no sirve `localhost`, que
ahí es el propio teléfono. Se puede cambiar sin recompilar desde «Cambiar de
servidor», en la pantalla del Multijugador Online, y lo que se guarde manda sobre
el valor por defecto. Si el teléfono no conecta, casi siempre es el cortafuegos
de Windows bloqueando el puerto 3000 en la red privada. Para ver de un vistazo
que el servidor está ahí, esa misma dirección abierta en el navegador enseña el
panel de salas.

## El botón de atrás

Lo reparte `ServicioBotonAtras` (`nucleo/atras.servicio.ts`), que se engancha al
evento `backButton` de **`@capacitor/app`** desde el componente raíz. Sin eso,
Capacitor tira del historial del WebView y «atrás» acaba en cualquier sitio,
porque ahí están todas las idas y venidas entre el mapa de niveles y la partida.

- Desde cualquier pantalla, al menú principal.
- Desde el menú principal, fuera de la aplicación.
- Desde una partida en curso, pregunta antes de dejarla.

En el navegador no se engancha nada: el atrás es el del navegador y ya funciona.

## Lo que todavía no está

De la Fase 8 (pulido): los recursos finales en todas las densidades de `mipmap`
y el `manifest.json` de PWA en los dos idiomas. De la Fase 10 (publicación en
Google Play): la firma de subida, el AAB de release y la ficha de la tienda.
