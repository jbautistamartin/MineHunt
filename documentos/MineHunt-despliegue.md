# El despliegue del servidor (Fase 9)

Cómo se empaqueta MineHunt en una imagen Docker, qué se le configura por
entorno, cómo se pone detrás de HTTPS y cómo se comprueba que lo desplegado
juega de verdad.

**Este documento es la referencia del despliegue.** Lo que hay que tener
presente al tocar código está resumido en `CLAUDE.md`; aquí está el detalle.

---

## Qué lleva la imagen

Una sola imagen con **las dos cosas**: el servidor NestJS y el cliente web, que
sirve el propio Nest. Es la decisión que gobierna todo lo demás:

- **Un despliegue, un dominio y un certificado.** Sin esto harían falta dos
  sitios servidos y un CORS entre ellos para lo que es un solo juego.
- **La versión de navegador queda en el mismo origen que el WebSocket**, así que
  la web no necesita saber a qué servidor hablar: es el suyo. En
  `nucleo/servidor.ts` el valor por defecto en el navegador ya es el propio
  origen, y esta fase es la que lo hace cierto.
- **El CORS sigue haciendo falta igualmente.** La aplicación de Android **no
  descarga la web**: lleva el bundle dentro del APK, y su origen nunca va a ser
  el del servidor. Que la web viaje dentro de la imagen no ahorra ni una
  variable de configuración por ese lado.

La raíz (`/`) es el juego. El panel de salas, que hasta ahora estaba ahí, vive
en **`/panel`** — quien escribe la dirección a secas quiere jugar, no ver la
contabilidad del servidor.

---

## Construir y levantar

Desde la raíz del repositorio, que es donde están los workspaces:

```bash
docker compose up -d --build     # construye y arranca
docker compose logs -f           # ver lo que hace
docker compose down              # pararlo
```

Se llega al juego en `http://localhost:3000` y al panel en
`http://localhost:3000/panel`. Para publicarlo en otro puerto,
`PUERTO_PUBLICADO=8080 docker compose up -d`.

### Cómo está montado el `Dockerfile`

Cuatro etapas, y el orden no es decorativo:

1. **`dependencias`** — copia solo los `package.json` y hace `npm ci`. Mientras
   no cambie un manifiesto, Docker reutiliza esta capa y no vuelve a bajar nada.
2. **`compilacion`** — copia el código y compila **el motor primero**. La web y
   el servidor consumen el `dist/` de `game-engine`, no su código fuente: en
   otro orden se compila contra una versión vieja del motor, o contra ninguna.
   Es la misma trampa del monorepo que documenta `CLAUDE.md`.
3. **`produccion`** — `npm ci --omit=dev` para quedarse solo con lo que hace
   falta al ejecutar. Angular, el CLI de Nest y Vitest se quedan fuera.
4. **`final`** — copia lo compilado sobre un `node:24-alpine` limpio y **corre
   como el usuario `node`, sin privilegios**: si alguien entra por una
   vulnerabilidad de una dependencia, que no se encuentre siendo root.

`tsconfig.base.json` se copia aparte porque es la raíz de la que cuelgan los
tres `tsconfig`; sin él, `tsc --build` no encuentra ni las opciones del
compilador.

---

## Las variables de entorno

Todo lo que cambia entre el portátil de casa y el servidor de verdad. Se leen
**una sola vez al arrancar** (`apps/server/src/configuracion.ts`): una variable
que cambiara a mitad de partida sería imposible de razonar.

| Variable | Por defecto | Qué hace |
|---|---|---|
| `PORT` | `3000` | Puerto en el que escucha el servidor dentro del contenedor. |
| `ORIGENES_PERMITIDOS` | *(sin poner: cualquiera)* | Webs desde las que se acepta una conexión, separadas por comas. **Ponlo antes de abrirlo a internet.** |
| `MAX_SALAS_POR_IP` | `4` | Salas abiertas a la vez desde una misma IP. |
| `MAX_SALAS_POR_CONEXION` | `2` | Salas abiertas a la vez por una misma conexión. |
| `MAX_MENSAJES_POR_SEGUNDO` | `20` | Mensajes por segundo que se le admiten a una conexión. |
| `CONFIAR_EN_PROXY` | `no` | Poner a `si` **solo si hay un proxy inverso delante**. |
| `NODE_ENV` | — | Con `production` se avisa a gritos si falta `ORIGENES_PERMITIDOS`. |

Un valor que no vale —un tope que no es un entero positivo— **no se corrige por
lo bajini**: se arranca con el valor por defecto y se avisa por consola. Un
servidor que se queda sin topes sin que nadie se entere es peor que uno que no
arranca. El cero se rechaza a propósito: en todo lo que se lee aquí, cero
significaría «sin tope».

---

## El endurecimiento, y por qué

Lo que el plan pedía **antes de abrirlo a internet**, porque hasta ahora solo se
había jugado en la red de casa. Nada de esto se ve jugando, y por eso todo tiene
pruebas.

- **Tope de salas por conexión y por IP.** Las salas viven en memoria y abrirlas
  es gratis: sin tope, una sola pestaña se queda con el servidor entero. Son dos
  topes y no uno porque protegen de cosas distintas — la conexión frena a quien
  abre salas una detrás de otra, y la IP a quien lo intenta abriendo pestañas
  nuevas. El de la IP es más ancho porque **detrás del router de una casa salen
  todos con la misma**. Cerrar una sala devuelve el hueco, o el tope acabaría
  siendo «salas por vida». Lo lleva `ServicioSalas`, que apunta quién abrió cada
  sala; `Sala` sigue sin saber nada de conexiones ni de IPs.
- **Límite de ritmo por conexión.** Jugando no se toca: un clic por turno, y el
  turno más rápido no baja del medio segundo. Existe porque **un cliente
  manipulado no juega**: puede mandar mensajes en bucle, y como cada uno mueve
  el motor y difunde a toda la sala, quien está dentro se queda sin partida. Va
  de **interceptor** (`InterceptorDeRitmo`) y no repartido por los once
  manejadores: el mensaje que se añadiera mañana se quedaría sin límite sin que
  nadie lo notara. Responde por el acuse de recibo como todo lo demás
  (`{ ok: false, error: 'DEMASIADAS_PETICIONES' }`), no con una excepción de
  WebSocket, y **el manejador no llega a ejecutarse**. Lo rechazado no se
  apunta: si contara, a quien se pasa le bastaría con insistir para no salir
  nunca de la ventana.
- **CORS cerrado por variable de entorno**, en lugar del comodín de antes.

`DEMASIADAS_SALAS` y `DEMASIADAS_PETICIONES` son códigos de error nuevos del
protocolo, con su traducción en los dos idiomas. Por eso **el protocolo sube a
0.1.0**: el vocabulario cambió, y un cliente viejo no sabría qué decirle al
jugador.

### La IP de quien llama

Detrás de un proxy inverso —que es como se despliega— la dirección del socket es
la del proxy, y todo el mundo parecería venir del mismo sitio: de ahí
`X-Forwarded-For`. **Solo se mira si `CONFIAR_EN_PROXY` está en `si`**, porque
esa cabecera la escribe quien quiera y fiarse de ella a pelo es regalar la forma
de saltarse el tope por IP.

---

## HTTPS

Hace falta y no es una manía: el cliente se sirve por https y **el WebView de
Android bloquea el tráfico en claro** en la compilación de publicación, así que
las partidas online tienen que ir por `wss`.

```bash
DOMINIO=minehunt.example CORREO=tu@correo \
  docker compose -f docker-compose.yml -f docker-compose.https.yml up -d
```

El proxy es **Caddy** por una sola razón: saca y renueva el certificado de Let's
Encrypt él solo, sin cron, sin certbot y sin un segundo contenedor. Lo que se
ganaría con nginx es control que este servicio no necesita. Detecta además la
conexión de WebSocket y la deja pasar tal cual, sin declarar `Upgrade` ni
`Connection`.

La capa va en un compose aparte a propósito: en local no hace falta —ni se
puede, sin un dominio que apunte a la máquina— y arrastrarla siempre obligaría a
montar un certificado para probar en el portátil. Al activarla, el contenedor
del servidor **deja de publicar su puerto**: se llega por el proxy y solo por
él.

El certificado se guarda en un volumen entre reinicios. Sin eso, cada `up`
pediría uno nuevo y Let's Encrypt acaba cortando por exceso de peticiones.

### El ensayo del HTTPS en local

La capa se puede levantar **sin dominio y sin internet**, y conviene hacerlo
antes de pagar un servidor: con `DOMINIO=localhost`, Caddy no va a Let's Encrypt
sino que firma con su propia autoridad local, y todo lo demás —el proxy, el paso
del WebSocket, el `X-Forwarded-For`, el CORS cerrado a `https://localhost`— es
exactamente lo que correrá fuera.

```bash
DOMINIO=localhost CORREO=lo-que-sea@ejemplo \
  docker compose -f docker-compose.yml -f docker-compose.https.yml up -d

NODE_TLS_REJECT_UNAUTHORIZED=0 \
  npm run humo --workspace @minehunt/server -- https://localhost
```

Esa variable hace falta porque el certificado lo firma una autoridad que no
conoce nadie. La prueba de humo **solo admite un certificado así cuando se le
dice por ahí**; contra el servidor de verdad el certificado tiene que valer, y
si no vale la prueba falla, que es lo que se quiere. Hay que pasarla al cliente
aparte de la variable de entorno porque el cliente de WebSocket monta su propia
conexión y no la mira.

Lo que este ensayo **no** cubre es lo único que necesita un dominio público: que
Let's Encrypt emita el certificado de verdad. Todo lo demás ya se ha ejecutado.

Para volver al servidor pelado, sin proxy. **El `down` también quiere las dos
variables**: compose las exige para leer el fichero, aunque solo vaya a parar lo
que levantó con él.

```bash
DOMINIO=localhost CORREO=lo-que-sea@ejemplo \
  docker compose -f docker-compose.yml -f docker-compose.https.yml down
docker compose up -d
```

---

## Comprobación de salud y reinicio

- La imagen trae un `HEALTHCHECK` que pega a **`/motor`**, que es la ruta que ya
  respondía; no se ha inventado una nueva solo para esto. Cada 30 s, con 10 s de
  gracia al arrancar y tres intentos antes de darlo por caído.
- `restart: unless-stopped`, que cubre las dos cosas: que el proceso se caiga y
  que se reinicie la máquina. Sin eso, un reinicio del servidor deja el juego
  apagado hasta que alguien se da cuenta.

```bash
docker inspect --format='{{.State.Health.Status}}' minehunt
```

---

## Comprobar que lo desplegado juega

Que el proceso responda no dice nada: lo que hay que comprobar es que **un
cliente de verdad juega una partida completa contra el servidor desplegado**.
Para eso está la prueba de humo:

```bash
npm run humo --workspace @minehunt/server                       # localhost:3000
npm run humo --workspace @minehunt/server -- https://minehunt.example
```

Habla por Socket.IO como habla la web, con el mismo protocolo importado del
motor. Comprueba tres cosas: que se abre una sala y entran dos jugadores, que la
partida llega hasta el final destapando el tablero, y que el límite de ritmo
corta una ráfaga. Sale con código 0 si todo fue bien y con 1 en cuanto algo no
cuadra, para poder encadenarla en un despliegue.

---

## Cómo se recupera el servicio

Las salas **viven en memoria y no se guardan en ningún sitio**. Es una decisión,
no un descuido: una partida es de la tarde que se juega, y persistirlas
obligaría a una base de datos para algo que nadie va a querer retomar dos días
después. La consecuencia hay que tenerla clara: **reiniciar el servidor tira las
partidas en curso**. Los clientes lo viven como una sala que ya no existe y
vuelven a la pantalla de entrar; el progreso del Modo Historia no se toca, que
ese vive en el teléfono.

| Qué pasa | Qué hacer |
|---|---|
| El contenedor está `unhealthy` | `docker compose logs --tail=100`. Si el proceso está vivo pero atascado, `docker compose restart`. |
| Se cayó la máquina | Nada: `restart: unless-stopped` lo levanta al arrancar Docker. Comprobar con la prueba de humo. |
| Un despliegue salió mal | `docker compose down && docker compose up -d --build`. La imagen anterior sigue en el disco (`docker images minehunt`) si hay que volver a ella. |
| El certificado no sale | Que el dominio apunte de verdad a la máquina y que los puertos 80 y 443 estén abiertos: Let's Encrypt necesita los dos. Los registros del proxy lo dicen. |
| Nadie puede conectar desde la web | Casi siempre es `ORIGENES_PERMITIDOS`. Los registros del servidor enseñan el origen rechazado. |

---

## Dónde alojarlo

La decisión no es libre: **las salas viven en memoria**. De ahí salen dos
condiciones que descartan media lista de opciones antes de mirar el precio.

- **Una sola instancia.** Con dos, los jugadores de una misma sala pueden
  acabar hablando con procesos distintos, que no comparten ni salas ni
  partidas. Nada de escalado automático mientras las salas no salgan del
  proceso.
- **Que no se apague sola.** Un alojamiento que duerme el contenedor cuando no
  hay tráfico tira las partidas en curso, y despertarlo tarda justo cuando
  alguien acaba de abrir una sala.

Con eso, lo que encaja es **un VPS pequeño con Docker**: es exactamente lo que
describen `docker-compose.yml` y `docker-compose.https.yml`, no hay que
reescribir nada y el servicio entero cabe de sobra en la máquina más barata del
catálogo (el juego no guarda nada en disco y una sala son unos pocos kilobytes).
Del orden de 4 a 6 € al mes en cualquiera de los de siempre —Hetzner, DigitalOcean,
Vultr, OVH, Scaleway—, más el dominio, del orden de 10 a 15 € al año. Conviene
elegir la región por donde estén los jugadores: esto va por WebSocket y la
latencia se nota en el turno.

Lo que se descartó, y por qué, para no volver a mirarlo:

| Opción | Por qué no |
|---|---|
| Cloud Run, Lambda y similares | Escalan a varias instancias y duermen a cero: las dos cosas que las salas en memoria no admiten. |
| PaaS de contenedor (Fly, Railway, Render) | Funcionar funcionarían, con una sola instancia y sin dormir, pero ponen su propio HTTPS: sobraría la capa de Caddy que ya está escrita y probada, y se cambiaría control por comodidad en un servicio que no la necesita. Son el plan B si administrar un VPS se hace cuesta arriba. |
| Alojamiento compartido | No ejecuta contenedores ni deja abrir un puerto de WebSocket. |

### Los pasos, una vez contratado

1. Apuntar el dominio (un registro `A`) a la IP del VPS, y esperar a que
   resuelva: sin eso Let's Encrypt no emite nada.
2. Instalar Docker, traer el repositorio y levantarlo:

   ```bash
   DOMINIO=<el dominio> CORREO=<un correo> \
     docker compose -f docker-compose.yml -f docker-compose.https.yml up -d
   ```

   Los puertos 80 y 443 tienen que estar abiertos: el certificado necesita los
   dos.
3. Comprobar que juega de verdad, no que responde:
   `npm run humo --workspace @minehunt/server -- https://<el dominio>`.
4. Poner esa dirección en `nucleo/servidor.ts` —hoy ahí hay una IP de la red
   local— y recompilar el APK. Es la única línea del cliente que depende de
   dónde se aloje, y es lo que la Fase 10 sube a la tienda.

## Lo que queda pendiente

- **Probarlo en un servidor de verdad**, con dominio y certificado. Es lo único
  que le falta a la fase, y no lo puede dar ninguna prueba: hay que contratar el
  alojamiento y el dominio.
- Todo lo demás está comprobado en local, la capa de HTTPS incluida: ver «El
  ensayo del HTTPS en local», más abajo. Lo que no se ha ejecutado nunca es la
  emisión del certificado de Let's Encrypt, que exige un dominio público.
