# El servidor de MineHunt

Documento de referencia del multijugador online: cómo está montado el servidor,
qué mensajes se intercambian y qué decisiones hay detrás. **La Fase 7 (el
cliente online) se escribe contra lo que hay aquí.**

Fase 6, terminada. El código vive en `apps/server/src/salas/`.

## La idea de fondo: el servidor es la autoridad

El servidor no es un repetidor de mensajes. Dentro de cada sala hay **un
`MotorJuego` de verdad**, el mismo paquete `@minehunt/game-engine` que usa el
cliente, y es el único tablero que cuenta. Los clientes mandan intenciones
(«clic en 3,4») y reciben el estado que salga de aplicarlas.

Eso da dos cosas gratis:

- **Un cliente manipulado no puede hacer trampas.** No puede jugar fuera de su
  turno porque el servidor comprueba de quién es; y no puede ver dónde están las
  minas porque el estado que se le manda es el que `obtenerEstado()` deja ver a
  cualquiera, con las celdas ocultas sin número y sin decir si esconden mina.
- **No hay dos implementaciones de las reglas.** Si cambia una regla, cambia en
  el motor y cambia para los tres modos de juego a la vez.

## Las piezas

| Fichero | Qué es |
|---|---|
| `packages/game-engine/src/red/protocolo.ts` | **El contrato**, y no está en el servidor: nombres de los mensajes y forma de lo que va en ellos. Vive en el motor porque es el vocabulario de los dos lados. |
| `salas/sala.ts` | Una sala: el motor, quién juega, el reloj y los bots sustitutos. No sabe nada de Socket.IO, así que se prueba entera sin levantar nada. |
| `salas/salas.servicio.ts` | El registro de salas vivas y el reparto de códigos. |
| `salas/partida.pasarela.ts` | La pasarela de Socket.IO: traduce mensajes a llamadas a la sala y difunde lo que ocurra. Aquí no hay ni una regla del juego. |
| `salas/dependencias.ts` | Los dos tokens de inyección: el reloj y el azar. |

## El protocolo

Todo va por Socket.IO. Las peticiones del cliente se contestan por el **acuse de
recibo** (el `callback` de `emit`), no por un mensaje aparte: así quien pregunta
sabe si le salió bien sin tener que adivinarlo por lo que difunde el servidor.

**El contrato vive en el motor**, en `packages/game-engine/src/red/protocolo.ts`,
y se importa desde `@minehunt/game-engine` tanto en el servidor como (en la Fase
7) en la web. Ahí no hay ni una regla del juego: son los nombres de los mensajes
y la forma de lo que va dentro, tipos y cadenas constantes que no ejecutan nada.
El porqué de ese sitio está en el apéndice del plan maestro.

La respuesta es siempre un `Resultado<T>`:

```ts
{ ok: true, datos: T } | { ok: false, error: CodigoErrorProtocolo }
```

### Del cliente al servidor

| Mensaje | Lleva | Devuelve |
|---|---|---|
| `crear-sala` | `{ nombre, version, configuracion? }` | `Entrada` (código, credencial, puesto, sala y versión) |
| `unirse-a-sala` | `{ codigo, nombre, version }` | `Entrada` |
| `reconectar` | `{ codigo, token, version }` | `Reentrada` (lo de arriba más la partida en curso) |
| `configurar-sala` | `Partial<ConfiguracionSala>` | `null` |
| `empezar-partida` | — | `null` |
| `volver-al-lobby` | — | `null` (solo con la partida terminada) |
| `clic` | `{ x, y }` | el `SucesoPartida` que salió |
| `onda` | `{ activar }` | `null` |
| `rendirse` | — | el `SucesoPartida` de la rendición |
| `salir` | — | `null` |

### Del servidor a todos los de la sala

| Mensaje | Lleva |
|---|---|
| `sala` | `VistaSala`: quién hay, conectado o no, quién es el anfitrión y con qué ajustes se juega |
| `partida` | `EstadoPartida`, tal cual lo devuelve el motor |
| `suceso` | `{ codigo, jugador, celdas }` |

### Nunca se manda texto

Los sucesos viajan como código (`MINA_ENCONTRADA`, `CELDA_DESPEJADA`,
`ONDA_EXPANSIVA`, `TURNO_PERDIDO`, `JUGADOR_RENDIDO`) y los errores igual
(`NO_ES_TU_TURNO`, `SALA_LLENA`, `PETICION_INVALIDA`, `CELDA_YA_REVELADA`…). La frase la compone cada
cliente con sus claves de traducción, que son **las mismas** que ya usa el Modo
Entrenamiento (`partida.evento.*` y `error.*`).

Es lo que permite que dos jugadores de la misma sala vean la partida cada uno en
su idioma. Si alguna vez se cuela un mensaje ya traducido, eso se rompe y no hay
forma de arreglarlo desde el cliente.

## La versión, al entrar

Los tres mensajes de entrada llevan la **versión con la que viene el cliente**, y
si no encaja con la del servidor se queda fuera con `VERSION_INCOMPATIBLE`. La
versión es `VERSION_PROTOCOLO`, que es la del motor: como el protocolo vive ahí,
las dos suben juntas.

Se comparan `major.minor` y no la versión entera (`versionesCompatibles`, en el
propio protocolo, para que los dos lados usen la misma regla): un parche arregla
cosas sin tocar lo que va por el cable, y echar a un jugador por eso sería
gratuito. **Si cambias el protocolo, sube la minor**; si no lo haces, un cliente
viejo entrará creyendo que se entiende con el servidor.

Es la diferencia entre que el jugador vea «actualiza la aplicación» y que vea una
partida a medias, que se parece demasiado a un fallo del juego. Y no llega con
avisar: un cliente que no manda versión tampoco entra, porque justo ese es el
caso del APK antiguo.

## La credencial y las reconexiones

Al entrar en una sala, el jugador recibe un **token**. El cliente tiene que
guardarlo: es lo único que le devuelve su puesto si se le cae la conexión.

El token **no viaja en cada mensaje**. El servidor lo ata al socket al entrar
(`socket.data`), así que un cliente no puede jugar por otro aunque le conozca la
credencial. Solo se manda otra vez al reconectar, que es cuando hay que
demostrar quién eres desde un socket nuevo.

Cuando alguien se cae:

- **En el lobby**, su puesto desaparece y los de detrás suben. Los ids tienen que
  ser correlativos cuando empiece la partida, porque son los del motor.
- **Con la partida en marcha**, el puesto se queda esperando: es lo que le permite
  volver, y quitarlo cambiaría de dueño las minas que ya encontró.

## La revancha

Terminada la partida, `volver-al-lobby` devuelve la sala al estado de espera y
se puede jugar otra con los mismos. **Los que se cayeron y no volvieron se
quedan fuera**: si se quedasen, la partida siguiente empezaría con puestos
fantasma a los que un bot juega desde el primer turno.

Lo pide el anfitrión, salvo que sea justo él quien no volvió: entonces vale
cualquiera de los que siguen dentro, que si no la sala se queda muerta con gente
esperando.

## Del cliente no se fía nadie

La pasarela mira lo que entra antes de pasarlo a la sala: una coordenada que no
es un entero o un nombre que no es texto se contestan con `PETICION_INVALIDA`.
Sin eso, el valor se cuela hasta el motor y revienta dentro del manejador; el
servidor no se cae, pero **quien preguntó se queda esperando un acuse de recibo
que ya no llega**, que es la peor forma de fallar.

Es la otra mitad de que el servidor sea la autoridad: no basta con que decida
él, hay que asegurarse de que decide sobre datos que tienen sentido.

## El bot que sustituye al ausente

Si le toca a alguien que está caído, el servidor espera **tres segundos** por si
vuelve de un parpadeo de la conexión, y a partir de ahí le pone un bot de
**nivel 3**. Ni flojo, que regalaría la partida, ni de nivel 5, que la ganaría
por el ausente: ninguna de las dos cosas es justa para los que siguen jugando.

El bot no juega a toda velocidad: lleva su propio ritmo (700 ms entre jugadas),
porque encadenando minas puede jugar muchas veces seguidas y de golpe nadie se
enteraría de lo que ha pasado. Es el mismo motivo por el que los bots del Modo
Entrenamiento tardan en jugar.

En cuanto el jugador reconecta, recupera el mando y el bot se retira.

## El reloj

`OpcionesPartida.tiempoPorTurnoSegundos` limita lo que puede tardar cada
jugador. **El motor no tiene temporizadores propios** —esa es la regla, y no
cambia en el servidor—, así que la pasarela repasa todas las salas cada 250 ms y
les pregunta si al de turno se le acabó el tiempo. Ese mismo repaso es el que
hace jugar a los bots sustitutos y el que recoge las salas que ya no espera
nadie.

Solo se difunde cuando pasa algo. La cuenta atrás la baja cada cliente por su
cuenta a partir del `tiempoRestanteMs` que venía en el último estado, igual que
hace hoy el Modo Entrenamiento.

## El reloj y el azar se inyectan

Igual que en el motor: `RELOJ` y `AZAR` son tokens de inyección, y en las pruebas
se sustituyen por otros que no se mueven. Es la única forma de comprobar un turno
perdido por tiempo o un bot entrando a sustituir sin esperar de verdad, y de que
las minas caigan siempre en el mismo sitio.

**El código de sala no usa el azar inyectado**, sino el del sistema: las pruebas
fijan el suyo en un valor constante, y con eso todas las salas pedirían el mismo
código y no habría forma de abrir la segunda.

Los códigos son de cuatro caracteres de un alfabeto sin `O`, `0`, `I` ni `1`: se
dictan en voz alta o se copian de una pantalla, y ahí esas parejas se confunden
siempre.

## Cómo se prueba

```bash
npm run probar --workspace @minehunt/server      # la sala, sin levantar nada
npm run probar:e2e --workspace @minehunt/server  # clientes de verdad por Socket.IO
```

Las de `sala.prueba.ts` son las que cubren las reglas: lobby, turnos, reloj,
caídas y vuelta. Las e2e levantan la aplicación entera y conectan clientes de
`socket.io-client` de verdad, incluyendo **partidas completas de 2, 3 y 4
jugadores** de principio a fin, que es lo que pedía el plan.

## Arrancar el servidor

```bash
npm run arrancar:dev --workspace @minehunt/server   # con recarga en caliente
```

Escucha en el puerto 3000, o en el que diga `PORT`. La pasarela acepta
conexiones de cualquier origen (`cors: { origin: '*' }`), que es lo que hace
falta con el cliente de Angular sirviéndose desde otro puerto en desarrollo.

Para producción eso no vale, y no es de esta fase: **el despliegue es la Fase
9** (Docker, variables de entorno, orígenes permitidos de verdad y un proxy
inverso con HTTPS, porque el cliente se sirve por `https` y el WebView de
Android bloquea el tráfico en claro, así que las partidas tendrán que ir por
`wss`).

Ahí va también el cliente: **una sola imagen**, con este mismo Nest sirviendo los
estáticos del `ng build`. Un despliegue, un dominio y un certificado, y la
versión de navegador en el mismo origen que el WebSocket. Los orígenes
permitidos hacen falta igual, porque la app de Android lleva el bundle dentro del
APK y nunca está en el mismo origen.

## Lo que queda para la Fase 7

Lo que el cliente va a necesitar, apuntado ahora que está fresco:

- **`socket.io-client` en `apps/web`**, que todavía no está.
- **A dónde se conecta.** Ya está decidido: la URL vive en `nucleo/servidor.ts`
  con un valor por defecto, como `VERSION_APP`, y se puede cambiar con un ajuste
  guardado en localStorage y validado al leerlo. Hace falta de verdad porque
  desde el móvil hay que apuntar a la IP del PC en la red local. Los tipos del
  protocolo no son problema: salen de `@minehunt/game-engine`, que la web ya
  consume.
- **Guardar la credencial** que devuelve el servidor al entrar en la sala: es lo
  único que recupera el puesto si se cae la conexión.
- **Mandar `VERSION_PROTOCOLO`** en los tres mensajes de entrada, y tener una
  pantalla para cuando el servidor conteste `VERSION_INCOMPATIBLE`: es lo que
  verá quien no haya actualizado.
- **Tráfico en claro en Android.** El WebView bloquea `http://` con
  `targetSdk 36` y el manifest no trae `usesCleartextTraffic`, así que para
  probar contra un servidor local habrá que permitirlo (solo en depuración) o
  servir por HTTPS.
- **El estado del cliente.** `ServicioPartida` es el único que habla con el
  motor, así que es la pieza que se sustituye por el estado que llega del
  servidor. Los componentes del tablero, el marcador y la onda no se tocan.
- **Lo que el servidor no hace todavía**: no hay lista de salas públicas (se
  entra por código), ni expulsar a nadie, ni pasar el mando de anfitrión a
  propósito, ni límite de salas por conexión. Nada de eso hace falta para jugar;
  lo primero que se echará en falta, la revancha, ya está.
