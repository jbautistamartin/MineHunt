# MineHunt — El Multijugador Local (Fase 8.5)

De dos a cuatro teléfonos Android jugando una partida entre ellos **sin
servidor, sin Wi-Fi común y sin internet**. Uno crea la partida y hace de
anfitrión; los demás la encuentran en una lista de partidas cercanas y se unen.

Este documento es la referencia del modo: cómo está montado, qué se reutiliza
del Online, qué pide Android y cómo se prueba. El diseño de la fase está en
`MineHunt-plan-maestro.md`; aquí está lo que hay que saber para tocar el código.

---

## La idea en una línea

**Lo único que cambia respecto al Multijugador Online es el cable.** El
protocolo es el mismo, las pantallas son las mismas y `ServicioOnline` es el
mismo: en `/online` el socket sale a un servidor NestJS y en `/local` sale a la
radio del teléfono de al lado — o a ningún sitio, si uno es el anfitrión y la
sala la lleva él.

```
      ANFITRIÓN (un teléfono)                    INVITADOS (1 a 3)
┌────────────────────────────────┐        ┌────────────────────────────┐
│  Pantalla /local               │        │  Pantalla /local           │
│  ServicioOnline                │        │  ServicioOnline            │
│      │                         │        │      │                     │
│  SocketDelAnfitrion  ◄─ llamada│        │  SocketDelInvitado         │
│      │                directa  │        │      │                     │
│  Anfitrion  ──►  Sala  ──► MotorJuego   │      │                     │
│      │                         │        │      │                     │
│  ServicioLocal ──── Nearby Connections (P2P_STAR) ───── ServicioLocal│
└────────────────────────────────┘        └────────────────────────────┘
```

El anfitrión es la autoridad, igual que lo es el servidor en el Online: dentro
de su WebView vive el único `MotorJuego` de verdad de esa partida. Los demás
mandan intenciones («clic en 3,4») y reciben el estado que salga.

---

## Qué se movió y por qué

`Sala` era del servidor (`apps/server/src/salas/sala.ts`) y ahora vive en el
motor, en **`packages/game-engine/src/red/sala.ts`**, junto al protocolo y por
la misma razón que él: es lo que cliente y servidor tienen que compartir. Solo
dependía del motor, y lo único que la ataba a Node era `randomUUID`, que pasa a
recibirse como dependencia igual que el reloj y el azar.

El servidor la sigue usando desde su sitio nuevo y no cambió de comportamiento;
**sus pruebas se movieron con ella y pasaron sin tocar ninguna aserción**, que
es lo que dice que el traslado salió bien.

Al lado nació **`red/anfitrion.ts`**: lo que `PasarelaPartida` hace en el
servidor —traducir mensajes del protocolo a llamadas a la sala y difundir lo
que salga— pero para **una sola sala** y sin Socket.IO ni Nest. Eso es lo que
permite que el anfitrión sea un teléfono.

---

## Las piezas

| Pieza | Dónde | Qué hace |
|---|---|---|
| `Sala` | `game-engine/src/red/sala.ts` | Las reglas de una sala: puestos, turnos, bots, reconexión. La comparten el servidor del Online y el anfitrión del Local. |
| `Anfitrion` | `game-engine/src/red/anfitrion.ts` | El servidor de una sola sala, sin cable. Recibe `(conexión, mensaje, datos)` y devuelve `Resultado<T>`; difunde por un callback. |
| `transporte-local.ts` | `web/src/app/nucleo/` | El troceado, el ensamblado y los dos sockets (`SocketDelAnfitrion`, `SocketDelInvitado`). |
| `ServicioLocal` | `web/src/app/nucleo/` | Permisos, descubrimiento, montar la sala, conectar, y enchufar el transporte a `ServicioOnline`. |
| `cercanos.plugin.ts` | `web/src/app/nucleo/` | El contrato con el plugin nativo, detrás del token `RADIO_CERCANA` para poder probarlo con una radio de mentira. |
| `CercanosPlugin.java` | `web/android/app/src/main/java/com/minehunt/app/` | Nearby Connections: anunciar, buscar, conectar, mandar y recibir. |

---

## El troceado: por qué existe

Nearby admite **32 KB por payload de bytes**, y el estado de una partida grande
no cabe. Un tablero de 30×30 son 900 celdas, cada celda serializada ronda los
70 bytes, y el `EstadoPartida` se va por encima de los 60 KB.

Así que los mensajes se parten en trozos de **8000 caracteres**. El límite se
cuenta en caracteres y no en bytes para no tener que medir: un carácter del
plano básico ocupa como mucho tres bytes en UTF-8, así que 8000 caracteres no
pasan de 24 KB pase lo que pase, y sobra sitio para el sobre.

Dos detalles que no son evidentes y que están cubiertos por pruebas:

- **El corte respeta los pares suplentes.** Un emoji ocupa dos unidades en una
  cadena de JavaScript y partirlo por la mitad deja media letra a cada lado.
  Como los nombres los teclea el jugador, esto pasa de verdad.
- **El array del ensamblador se rellena con `fill(undefined)`.** Un array creado
  por tamaño está *disperso*, y `some` se salta los huecos: sin rellenarlo, un
  mensaje de nueve trozos se daba por completo con el primero que llegara y lo
  que salía era un JSON cortado por la mitad. Lo encontró la prueba del tablero
  de 30×30, no el teléfono.

El troceado vive en la web y no en Java a propósito: ahí se puede probar sin dos
teléfonos en la mano.

---

## Lo que va por el cable

Tres formas de mensaje, que es lo mismo que Socket.IO lleva por dentro:

```jsonc
{ "t": "p", "id": 7, "m": "unirse-a-sala", "d": { … } }  // petición
{ "t": "r", "id": 7, "d": { "ok": true, "datos": … } }   // respuesta (el acuse)
{ "t": "e", "m": "partida", "d": { … } }                 // difusión del anfitrión
```

Cada uno viaja dentro de uno o más sobres: `{ "m": "<id>", "i": 0, "n": 3, "c": "<trozo>" }`.

**No se inventó ningún mensaje nuevo.** Los nombres y la forma de los datos son
los de `game-engine/src/red/protocolo.ts`, los mismos del Online, con la misma
comprobación de versión `major.minor` al entrar. Aquí pesa más que allí: en el
Online el servidor impone una sola versión a todos, y en una partida local cada
teléfono lleva el APK que se instaló por su cuenta, que puede ser de meses
distintos.

---

## Android: permisos y estrategia

**Estrategia `P2P_STAR`**: uno anuncia y de uno a tres se conectan a él, que es
exactamente la forma de una sala. `P2P_CLUSTER` dejaría a todos hablando con
todos y no hace falta; `P2P_POINT_TO_POINT` daría más ancho de banda pero solo
admite un invitado.

Los permisos cambian con la versión de Android, y **pedir el que no toca es peor
que no pedirlo**: un permiso declarado con `maxSdkVersion` por debajo de la del
aparato se deniega solo, sin enseñar ningún diálogo, y desde fuera parece que el
jugador dijo que no. De ahí que `aliasNecesarios()` decida en caliente:

| Android | Lo que se pide |
|---|---|
| 13 y posteriores (SDK 33+) | `BLUETOOTH_SCAN`, `BLUETOOTH_ADVERTISE`, `BLUETOOTH_CONNECT`, `NEARBY_WIFI_DEVICES` |
| 12 y 12L (SDK 31-32) | Los tres de Bluetooth y `ACCESS_FINE_LOCATION` |
| Anteriores | Solo `ACCESS_FINE_LOCATION`; los de Bluetooth de entonces son normales |

`NEARBY_WIFI_DEVICES` lleva `neverForLocation` porque el juego no deduce dónde
está nadie: solo busca con quién jugar. Sin esa marca, Android 13 y posteriores
exigirían además la ubicación precisa.

Y una trampa que no es un permiso: **por debajo de Android 12, Nearby no
descubre nada con la ubicación del sistema apagada**, y el jugador ve una lista
vacía sin ningún error que lo explique. El plugin lo cuenta como si faltara un
permiso, con el nombre `SERVICIO_DE_UBICACION`.

La conexión **se acepta sin pedir confirmación**. Nearby ofrece un código de
cuatro cifras para que las dos personas lo comparen, y para un juego es un
peaje: quien toca una partida de la lista ya dijo que quería entrar, y lo que se
manda por ahí son clics en un tablero.

---

## La pantalla

`/local` es **la misma pantalla que `/online`**, con otro dato en la ruta
(`data: { modo: 'local' }`). Lo único que cambia es la primera de sus tres
partes —con quién se juega y cómo se le encuentra—; el lobby y la partida son
idénticos hasta el píxel, y duplicarlos habría sido copiar trescientas líneas de
plantilla que dicen lo mismo.

Lo que se esconde en local: el código para entrar a mano, el botón de «volver a
mi sala», el ajuste de la dirección del servidor y los botones de copiar y
compartir el código (la partida se elige de una lista, el código no sirve para
entrar). Lo que aparece: la lista de partidas cercanas y el aviso de permisos.

**Al abrir la pantalla no se pide ningún permiso todavía.** Si ya estaban
concedidos se empieza a buscar en el acto; si no, la pantalla explica para qué
son y espera a que el jugador toque «Buscar partidas cerca». El diálogo del
sistema sale entonces, con la explicación ya leída — un buscaminas que pide
acceso al Bluetooth nada más entrar no ha explicado nada.

La entrada del menú **solo sale en la aplicación de Android**: Nearby son las
radios del teléfono y en un navegador no hay ninguna.

---

## Cuando alguien se va

- **Se cae un invitado**: lo resuelve `Sala`, igual que en el Online. Se le
  espera tres segundos por si vuelve y luego le juega un bot de nivel medio.
- **Se cae el anfitrión**: la partida se acabó para todos. No hay servidor que
  la siga guardando, así que el invitado ve «Se perdió el contacto con quien
  tenía la partida» en vez de un tablero que ya no avanza.
- **Se sale de la pantalla** (el botón de atrás incluido): se apaga la radio. Sin
  eso el teléfono sigue anunciando una partida que ya no se juega, gastando
  batería y apareciendo en la lista de los demás.

---

## Cómo se prueba

```bash
npm run probar --workspace @minehunt/game-engine   # Sala y Anfitrion
npm run probar --workspace @minehunt/web           # transporte y ServicioLocal
```

- **`anfitrion.prueba.ts`** juega contra el anfitrión sin ningún cable: entrar,
  versiones incompatibles, turnos, reconexión con credencial y el bot que
  sustituye al que se cae.
- **`transporte-local.prueba.ts`** une un anfitrión y un invitado por un cable
  de mentira y les hace jugar, **con un tablero de 30×30** para que el estado no
  quepa en un mensaje y haya que partirlo de verdad.
- **`local.servicio.prueba.ts`** le pone a `ServicioLocal` una radio de mentira:
  permisos, lista de partidas cercanas, un invitado que llega y entra en la
  sala, otro que se cae, y lo que pasa con un mensaje que no es del protocolo.

**Lo que ninguna prueba puede dar**: Nearby necesita radios de verdad y no hay
emulador que las levante. La comprobación de cierre son **dos teléfonos
físicos, con el Wi-Fi apagado en los dos, jugando una partida entera**.

### Qué mirar si en el teléfono no aparece nadie

```bash
adb logcat -v brief MineHuntCercanos:V Capacitor:V *:S
```

Por orden: que el plugin se registrara (`Registering plugin instance: Cercanos`),
que los permisos estén concedidos (Ajustes → Aplicaciones → MineHunt →
Permisos), que los dos teléfonos tengan el Bluetooth encendido, y que el APK de
los dos sea el mismo: una versión con distinta `minor` se rechaza a propósito.
