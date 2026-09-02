# MineHunt — Plan maestro del proyecto

## 1. Nombre e icono

**Nombre:** **MineHunt** (antes "MinaCaza") — más internacional, se entiende el concepto invertido en cualquier idioma: cazar minas, no evitarlas.

**Icono:** `MineHunt-icon.svg` (en esta misma carpeta), mismo diseño que antes: fondo azul marino, mina roja-naranja con mecha encendida y un dedo/cursor tocándola.

**Idioma del código:** nombres de variables, funciones y comentarios en **español**, tal como pediste. Solo los textos que ve el jugador se manejan con el sistema de traducción (punto siguiente).

---

## 2. Interfaz multidioma (i18n)

Requisito nuevo: todos los textos visibles en pantalla (botones, mensajes, resultados, nombres de nivel, etc.) deben mostrarse en **español o inglés según la configuración regional del dispositivo del jugador**, con posibilidad de que el jugador la cambie manualmente si quiere.

**Tecnología recomendada: `@ngx-translate/core`** (en vez del i18n nativo de Angular).

¿Por qué esta y no el i18n integrado de Angular?
- El i18n nativo de Angular obliga a generar un **build distinto por idioma** (una compilación para `es`, otra para `en`), lo cual no encaja con detectar el idioma del cliente en tiempo real ni con una app instalada una sola vez.
- `ngx-translate` carga los textos desde archivos JSON (`es.json`, `en.json`) y los cambia **en caliente**, sin recompilar. Es el estándar de facto para este caso de uso.

Cómo funciona en la práctica:
- Cada texto de la UI se referencia por una clave, no por el texto literal: `"start_game"` en vez de escribir `"Comenzar partida"` directamente en el componente.
- Dos archivos de traducción: `assets/i18n/es.json` y `assets/i18n/en.json`, con esa clave apuntando al texto en cada idioma.
- Al arrancar la app, se detecta el idioma con `navigator.language` (en Capacitor/Android también se puede leer el idioma del sistema); si es `es-*` se usa español, en cualquier otro caso inglés (o puedes soportar solo exactamente esos dos y usar inglés como idioma por defecto si no coincide).
- Se guarda la preferencia si el jugador la cambia manualmente (localStorage), para no volver a detectarla cada vez.

**Importante para el servidor multijugador (Fase 6-7):** el servidor NO debe enviar texto ya traducido. Debe enviar **códigos de evento** (`"PLAYER_JOINED"`, `"MINE_FOUND"`, `"GAME_OVER"`) y datos crudos (nombre del jugador, número de minas, etc.); es el cliente Angular quien arma el texto final con `ngx-translate` en el idioma del jugador que lo está viendo. Así dos jugadores en la misma partida pueden verlo cada uno en su propio idioma.

---

## 3. Arquitectura general (sin cambios de fondo, resumen)

```
┌─────────────────────┐        ┌─────────────────────┐
│  Angular + Capacitor │        │  Angular (web)       │
│  → APK Android       │        │  → navegador          │
│  (ngx-translate: es/en)       │  (ngx-translate: es/en)│
└─────────┬────────────┘        └──────────┬───────────┘
          │        WebSocket (Socket.IO)   │
          └───────────────┬─────────────────┘
                           │
                 ┌─────────▼─────────┐
                 │  Servidor NestJS   │
                 │  - motor del juego │
                 │  - salas/lobby     │
                 │  - IA (bots)       │
                 │  - eventos con     │
                 │    códigos, no     │
                 │    texto traducido │
                 └────────────────────┘
```

(El resto de la arquitectura —motor de juego en TypeScript puro reutilizado en cliente y servidor, NestJS + Socket.IO para multijugador— se mantiene igual que en la versión anterior del plan.)

---

## 4. Diseño del algoritmo de la IA y reglas del juego

> **Aviso:** varias reglas de esta sección y de la Fase 1 quedaron concretadas o
> corregidas durante la implementación. Lo que manda es el
> [apéndice de decisiones](#apéndice-decisiones-tomadas-durante-la-implementación)
> del final de este documento, no la letra de aquí.

Sin cambios respecto al plan anterior: la IA solo usa información visible (nunca la posición real de minas ocultas), con 5 niveles de inteligencia (aleatorio → deducción básica → CSP local → probabilístico → estratégico), y las reglas del juego (clic revela mina o número, cascada en celdas vacías, ítem de despeje con recarga, gana quien más minas encuentre) siguen exactamente como las definiste.

---

## 5. Plan paso a paso actualizado (prompts para el generador de código)

Mismo orden de fases que antes, con el ajuste de que **desde la Fase 1** se incluye el sistema de traducción, para no tener que reescribir textos hardcodeados más adelante.

### Fase 0 — Estructura del repo
```
Crea un monorepo con esta estructura:
- /packages/game-engine   → librería TypeScript pura (sin Angular, sin DOM), con su propio
  package.json, para la lógica del tablero: generación, revelado, cascada, cálculo de
  números adyacentes, gestión de turnos y marcador de minas por jugador.
- /apps/web                → app Angular (standalone components, Angular 18+), usará
  game-engine como dependencia de workspace.
- /apps/server              → NestJS, usará game-engine como dependencia de workspace.
Usa npm workspaces (o pnpm) para enlazar los paquetes entre sí. Configura TypeScript
estricto en todos los paquetes. Todo el código, nombres de variables/funciones y
comentarios deben estar en español. No implementes lógica de juego todavía, solo el
esqueleto, scripts de build/test, y un test "hello world" en cada paquete para
confirmar que todo compila y se ejecuta.
```

### Fase 1 — Motor del juego + Modo Entrenamiento local + soporte multidioma
```
En /packages/game-engine implementa la lógica pura del juego "MineHunt" (buscaminas
invertido): tablero rectangular configurable (alto, ancho, número de minas), estado de
celdas (oculta/despejada/mina-encontrada), cálculo del número de minas adyacentes,
revelado en cascada recursivo cuando una celda despejada tiene 0 minas alrededor,
turnos entre 2-4 jugadores, y marcador de minas encontradas por jugador. Expón una
API clara tipo GameEngine con métodos: crearPartida(ancho, alto, minas, numJugadores),
clicCelda(x, y), obtenerEstado(), estaTerminada(), obtenerGanador(). Todo el código y
comentarios en español. Escribe tests unitarios cubriendo: generación de minas evitando
la primera celda clicada, cascada correcta, cambio de turno, y fin de partida.

Después, en /apps/web:
1) Crea el Modo Entrenamiento: pantalla de configuración (alto, ancho, número de
   jugadores humanos = 2 a 4 por ahora, sin bots todavía), y el tablero jugable en el
   mismo dispositivo pasando el turno entre jugadores (hotseat). Usa colores distintos
   por número de minas adyacentes, igual que el buscaminas clásico.
2) Integra @ngx-translate/core desde el inicio. Crea assets/i18n/es.json y
   assets/i18n/en.json con TODOS los textos visibles de esta pantalla (títulos,
   botones, mensajes de turno, mensajes de fin de partida) referenciados por clave,
   nunca texto literal en los componentes. Detecta el idioma con navigator.language
   al arrancar (es-* → español, cualquier otro → inglés por defecto), y añade un
   selector manual de idioma en la configuración que sobreescriba y recuerde la
   elección en localStorage.

No implementes aún IA, ítem de despeje, ni servidor.
```

### Fase 2 — Jugadores IA (bots) en Modo Entrenamiento
```
Añade a game-engine un módulo de IA (código y comentarios en español) que reciba
EXACTAMENTE la misma información que vería un jugador humano (estado visible del
tablero, nunca la posición real de minas ocultas) y decida la siguiente celda a
clicar. Implementa 5 niveles de inteligencia: 1) aleatorio puro, 2) deducción básica
por celda numerada, 3) deducción combinando varias celdas (CSP local), 4) estimación
probabilística cuando no hay jugada segura, 5) estratégico (prioriza esquinas/bordes;
omite por ahora la parte del ítem, se añade en la fase siguiente). Añade tests que
verifiquen que el bot nunca usa información oculta y que en el nivel 2+ detecta
correctamente los casos triviales.

En /apps/web permite en Modo Entrenamiento seleccionar 0 a 4 jugadores humanos (el
resto los controla la IA con el nivel de inteligencia seleccionable), y si hay 0
humanos, añade un delay configurable entre turnos de bots; si hay al menos un humano,
sin delay. Añade a es.json/en.json los nuevos textos (etiquetas de nivel de IA,
nombres de los bots, etc.) por clave.
```

### Fase 3 — Ítem de despeje recursivo con recarga
```
Añade al game-engine la acción "usar ítem de despeje amplio": al activarse, el
siguiente clic del jugador fuerza la revelación recursiva de todas las celdas vacías
conectadas a la celda clicada. Modela el estado del ítem por jugador: disponible / en
recarga, con un tiempo de recarga configurable en segundos. En /apps/web añade el
botón del ítem con un contador visual de cuánto falta para la próxima recarga
(texto traducido vía ngx-translate, ej. "Recarga en {{segundos}}s"), y actualiza la
IA para que en el nivel 5 decida cuándo conviene usar el ítem.
```

### Fase 4 — Modo Historia
```
Diseña una tabla de niveles (por ejemplo 20 niveles) en game-engine como datos
declarativos: cada nivel define ancho, alto, número de minas, tiempo de recarga del
ítem y nivel de inteligencia de los bots rivales, todo incrementando gradualmente la
dificultad. Implementa la lógica de progreso: el jugador avanza al siguiente nivel
solo si gana la partida; si pierde, repite el mismo nivel. En /apps/web crea la
pantalla de selección/progreso de niveles (con nombres/descripciones de nivel también
traducidos vía clave en es.json/en.json) y conecta cada nivel con el motor de juego y
la IA ya implementados. Persiste el progreso localmente (localStorage o IndexedDB).
```

### Fase 5 — Empaquetado Android con Capacitor
```
Integra Capacitor en /apps/web para generar la app Android. Configura el proyecto
Android (capacitor.config.ts, iconos y splash screen usando el diseño proporcionado),
ajusta la UI para tamaños de pantalla móvil, y verifica que ngx-translate detecte
correctamente el idioma del sistema también dentro del WebView de Android (usar el
plugin @capacitor/device o similar si navigator.language no es fiable en Android).
Documenta los comandos para generar el APK/AAB de prueba.
```

### Fase 6 — Servidor multijugador (autoritativo)
```
En /apps/server (NestJS) crea un gateway WebSocket (Socket.IO) que use la MISMA
instancia de game-engine que el cliente, pero como fuente de verdad: el servidor
valida cada clic, actualiza el estado real, y emite el nuevo estado a todos los
jugadores de la sala. IMPORTANTE: los eventos emitidos deben usar códigos
(ej. "MINA_ENCONTRADA", "TURNO_SIGUIENTE", "PARTIDA_TERMINADA") y datos crudos, nunca
texto ya traducido — la traducción final la hace cada cliente según su propio idioma.
Implementa: creación de salas (con código para unirse), lobby de espera hasta 4
jugadores, inicio de partida, turnos sincronizados, y reconexión básica si un jugador
pierde la conexión (con timeout que pasa el turno automáticamente si no hay humano
disponible, sustituyéndolo temporalmente por IA de nivel medio). Añade tests de
integración simulando 2-4 clientes conectándose a una sala y jugando una partida
completa.
```

### Fase 7 — Cliente multijugador online en Angular
```
En /apps/web añade el Modo Multijugador Online: pantalla para crear/unirse a sala con
código, lobby mostrando jugadores conectados, y el tablero conectado al servidor vía
Socket.IO en lugar de usar el motor local. Reutiliza el máximo posible de los
componentes visuales ya creados en Modo Entrenamiento. Traduce cada código de evento
recibido del servidor (ej. "MINA_ENCONTRADA") a un texto legible según el idioma
activo del cliente, usando las mismas claves de es.json/en.json. Maneja estados de
desconexión/reconexión en la UI.
```

### Fase 8 — Pulido y publicación
```
Añade sonidos, animaciones de detonación/cascada, pantalla de resultados con
estadísticas por jugador, y prepara los assets finales de icono y splash screen en
todas las resoluciones necesarias para Android (mipmap) y PWA/web (manifest.json en
ambos idiomas, con "name"/"description" según el idioma detectado). Revisa que no
quede ningún texto hardcodeado sin pasar por ngx-translate. Documenta el proceso de
build de producción y publicación en Google Play (con ficha de la tienda en español e
inglés) y despliegue del servidor (Docker + variables de entorno).
```

---

## 6. Resumen de lo nuevo respecto a la versión anterior

- Nombre: **MinaCaza → MineHunt**.
- Nueva librería: **`@ngx-translate/core`** para textos de UI en español/inglés según configuración regional del cliente, con selector manual y persistencia de la elección.
- Regla de diseño para el servidor: comunicar siempre por **códigos de evento**, nunca texto ya traducido, para que cada jugador vea la partida en su propio idioma.
- Código, nombres de variables y comentarios: **en español** en todo el proyecto, sin excepción.


---

## Apéndice: decisiones tomadas durante la implementación

El plan daba por definidas reglas que no llegaba a escribir, y en un punto la
realidad del juego obligó a corregirlo. Esto es lo que efectivamente está
implementado y probado. **Ante cualquier discrepancia con el texto de arriba,
manda este apéndice.**

### Turnos: quien acierta repite (Fases 1 y 3)

**Regla vigente:** el turno pasa al siguiente jugador solo cuando el clic **no**
encuentra mina. Quien acierta **sigue jugando** y encadena tantos clics como
minas seguidas encuentre.

Esto se decidió al cerrar la Fase 3 y **sustituye a la regla anterior**, que
hacía pasar el turno siempre. Se cambió para premiar la racha: con el turno
alternando pasara lo que pasara, acertar y fallar valían casi lo mismo en el
ritmo de la partida.

Efecto de lado que conviene tener presente: refuerza el orden de prioridades de
la IA en vez de cambiarlo, porque la mina cantada ya era su primera opción, y
ahora además le regala el turno siguiente.

### Fin de partida: hasta la última mina (Fases 1 y 3)

**Regla vigente:** la partida termina cuando se destapa la **última mina**, o
cuando se rinden todos menos uno. No hay final anticipado por marcador.

Al cerrar la Fase 3 se retiró el fin por «mayoría matemática» que traía la
Fase 1, aquel que cortaba la partida en cuanto el segundo ya no podía alcanzar
al líder. Sobre el papel evitaba jugar un final decidido; en la práctica cerraba
de golpe partidas que el jugador quería terminar de destapar. Quien no quiera
seguir hasta el final ahora tiene la rendición.

Si al destapar la última mina varios empatan en cabeza no hay ganador:
`obtenerGanador()` devuelve `null` y el estado marca `empate`.

### Rendirse (Fase 3)

Un jugador puede **dejar la partida en su turno**. Sale del juego: no vuelve a
recibir turnos, sus minas dejan de contar, ya no puede ganar y se queda de
espectador viendo cómo acaba. Es irreversible, así que la interfaz pide
confirmación.

**Si al rendirse queda un solo jugador en pie, la partida acaba y ese gana**,
tenga las minas que tenga. Es la única forma de ganar sin ser quien más minas
encontró, y la razón de que exista: sin ella, rendirse en una partida de dos
dejaría la mesa sin partida.

### Revelado: corrección a la Fase 1

La Fase 1 decía que una celda con 0 minas alrededor arrastra la cascada de
forma automática. **No es así.** Un clic normal destapa **únicamente la celda
clicada**, sea mina, número o celda vacía.

La cascada existe solo como efecto del ítem de despeje de la Fase 3, y ese es
justo el valor del ítem: sin él no habría forma de abrir tablero de golpe.

### Reloj de turno (Fase 3)

Cada partida puede limitar lo que tarda un jugador en mover. Si se le acaba el
tiempo **pierde el turno sin jugar**, y el tablero se queda como estaba. El
reloj vuelve a empezar con cada clic, también cuando el jugador conserva el
turno por haber encontrado mina.

El límite se configura en segundos y **0 significa sin reloj**, que es como
arranca el motor si nadie dice otra cosa: es cada modo el que decide si aprieta.
El Modo Entrenamiento lo trae a 15 s y deja desactivarlo; el **Modo Historia
(Fase 4) lo irá bajando nivel a nivel** para que la dificultad no crezca solo
por tamaño de tablero, sino también por presión de tiempo.

El motor **no lleva temporizadores dentro**: publica el tiempo que queda y
expone `comprobarTiempoDeTurno()` para que se lo pregunten. Hoy lo pregunta el
cliente cada 250 ms; en la Fase 6 lo hará el servidor, que es quien manda.

### La onda expansiva (Fase 3)

El «ítem de despeje amplio» del plan tiene nombre propio: **onda expansiva**
(*shockwave* en inglés). Se llama así en el código y en los textos de los dos
idiomas; no se le llama «ítem» en ninguna parte.

- Se activa aparte y **se gasta en el siguiente clic** de ese jugador; armarla
  no destapa nada. Se puede desarmar sin coste, y si el jugador pierde el turno
  por tiempo con ella armada no la pierde: no llegó a gastarla.
- Sobre una celda **vacía** arrastra todas las celdas vacías conectadas y su
  borde numerado.
- Sobre una celda **numerada** no hay nada que propagar: se revela ella sola y
  el ítem se pierde. Acertar dónde gastarlo es la decisión del jugador.
- Sobre una **mina**, la mina se apunta con normalidad y el ítem se gasta
  igualmente.
- La recarga se configura en segundos y **corre con el reloj, no con los
  turnos**. El motor recibe el reloj inyectado para que las pruebas no dependan
  del tiempo real y para que en la Fase 6 mande el del servidor.

### La IA y la onda (Fases 2 y 3)

El plan reservaba el uso del ítem al nivel 5. Se amplió: **todos los niveles
pueden gastar la onda**, cada uno con el criterio que le corresponde a su
inteligencia. El nivel 1 la tira al azar; los niveles 2 y 3 la gastan sobre una
celda que sus deducciones declaran libre; los niveles 4 y 5 además la usan
cuando no hay nada seguro y la mejor probabilidad de mina es demasiado baja
para arriesgar el clic. Ninguno la gasta teniendo una mina cantada, porque esa
sí puntúa y encima conserva el turno.

### Un nivel por bot en Entrenamiento (Fases 2 y 3)

El plan hablaba de «el nivel de la IA» como si fuera uno para toda la partida.
En el Modo Entrenamiento **cada bot lleva el suyo**: se elige puesto por puesto
y se puede sentar a un nivel 1 y a un nivel 5 en la misma mesa, que es la forma
más directa de ver qué aporta cada nivel. La configuración viaja como un array
en orden de asiento y el servicio guarda un jugador de IA por puesto.

### El ritmo de los bots (Fases 2 y 3)

Los bots **esperan entre 0 y 2 segundos antes de cada jugada**, sorteados en
cada turno, jueguen humanos o no.

La Fase 2 los dejó jugando al instante, con una pausa fija configurable solo
para las partidas de solo bots. No funcionaba: el tablero cambiaba antes de que
diera tiempo a ver de quién era el turno, y en cuanto quien acierta conserva el
turno, una racha de bot pasaba entera en un parpadeo. La pausa fija desapareció
de la configuración; el ritmo lo pone ahora el azar.

### El Modo Historia son 50 niveles, y generados (Fase 4)

El plan decía «por ejemplo 20 niveles»; se hacen **50**, a petición del usuario.

No se escriben a mano uno por uno: una función construye cada nivel a partir de
su número, con una progresión documentada, y la tabla resultante se congela al
cargar. Con cincuenta niveles, una tabla escrita a mano son cincuenta sitios
donde equivocarse y ningún sitio donde ver la progresión de un vistazo. Lo que
da garantías son las pruebas: comprueban que cada nivel crea una partida válida
de verdad y que la dificultad no retrocede nunca.

La dificultad sube por cuatro vías a la vez: tablero más grande, más densidad de
minas, rivales más listos y más numerosos, y menos tiempo por turno. Los cinco
primeros niveles se juegan **sin reloj**, para aprender; a partir del sexto
empieza en 30 s y baja hasta 6 s en el último, que es lo que el apéndice del
reloj de turno dejaba pendiente para esta fase.

### El mapa de niveles y el progreso (Fase 4)

Los cincuenta niveles se enseñan agrupados en **cinco zonas de diez**, cada una
con su nombre y su descripción, traducidos por clave como cualquier otro texto.
La zona es solo una forma de leer la progresión: la dificultad la fija el número
de nivel, no la zona.

Antes de entrar a un nivel se ve con qué se va a jugar —tablero, minas, rivales
y sus niveles de IA, reloj de turno y recarga de la onda—, que es la información
con la que el jugador decide si repite el anterior o sigue.

El progreso se guarda en `localStorage` (no hizo falta IndexedDB: son dos
números y una lista) y **se valida entero antes de usarse**, igual que los
ajustes del Entrenamiento. Aquí la validación pesa más: un progreso inventado
desbloquearía niveles sin haberlos jugado. Hay un botón para borrarlo, con
confirmación.

**Un nivel se juega en la misma pantalla que el Entrenamiento.** El jugador se
sienta siempre en el puesto 0 y los rivales del nivel detrás; ganar es, por
tanto, que el ganador sea el puesto 0. Al terminar, la pantalla ofrece pasar al
siguiente nivel o repetir el actual sin pasar por el mapa, y el resultado queda
apuntado en cuanto la partida acaba, sin depender de por dónde salga el jugador.

Rendirse en un nivel de Historia cuenta como perderlo: se sale de la partida y
ya no se puede ganar. Perder no quita nada de lo conseguido; solo hay que
repetir el nivel.

### Los ajustes del Entrenamiento se recuerdan (Fase 3)

La pantalla de configuración guarda en el navegador lo último que se dejó
puesto y lo restaura al volver, con un botón para restablecer los valores de
partida. El plan solo preveía persistencia para el progreso del Modo Historia
(Fase 4); esto es aparte y mucho más pequeño, pero se agradece en cuanto uno
juega dos veces seguidas con un tablero que no es el de por defecto.

Lo guardado se valida antes de usarse y, si no cuadra, se descarta entero.

### El clic derecho lanza la onda (Fase 3)

En la web, el **botón derecho del ratón sobre una celda** lanza ahí la onda
expansiva sin tener que armarla antes con el botón. Si la onda no está lista,
ese clic no hace nada: no se convierte en un clic normal, porque gastaría el
turno en una celda elegida pensando en la onda.

El botón de la interfaz se queda igualmente: en Android (Fase 5) no hay botón
derecho, así que es la única vía en móvil.

### La pantalla de ayuda (Fase 3)

El plan no la pedía, pero con las reglas cambiando de una fase a otra hacía
falta un sitio donde el jugador las lea. Vive en la ruta `/ayuda`, con una
sección por regla y todo traducido a los dos idiomas.

**Es parte del contrato de cualquier cambio de reglas:** si se toca una regla,
se actualiza la ayuda en el mismo cambio. Una prueba comprueba que cada sección
esté escrita en español y en inglés; que el texto siga siendo verdad no lo puede
comprobar nadie automáticamente.

### Añadidos al motor que el plan no pedía

- `CeldaVisible.encontradaPor`: qué jugador encontró cada mina. Sin ese dato la
  interfaz no puede pintar las minas del color de quien se las llevó.
- Fin de partida por mayoría, con `empate` y `obtenerClasificacion()`.
- `ResultadoClic.repite`, para que la interfaz pueda decir que el jugador sigue.
- `CodigoSuceso`, que suma `TURNO_PERDIDO` y `JUGADOR_RENDIDO` a los códigos de
  clic: ni el turno perdido por tiempo ni la rendición los produce una jugada,
  pero cliente y servidor tienen que nombrarlos igual (regla de los códigos,
  nunca texto traducido).
- `Jugador.rendido`, `jugadoresActivos()` y `estaRendido()`, para que la
  interfaz pueda apagar al jugador que se fue sin dejar de mostrar lo que
  encontró.

### Detalle de implementación con consecuencias

Los ficheros de traducción viven en `apps/web/public/assets/i18n/`, no en
`src/assets/`: Angular 22 eliminó `src/assets` y copia `public/` a la raíz del
build, con lo que la URL servida sigue siendo `/assets/i18n/es.json`, que es la
que dice el plan.

### El menú principal (posterior a la Fase 4)

El plan repartía las pantallas por fases y nunca llegó a decir por dónde entra
el jugador, así que la raíz la fue ocupando lo último que se implementaba: la
configuración del Entrenamiento, con el Modo Historia colgando de una tarjeta
encima. Con tres modos previstos eso ya no se sostenía.

Ahora la raíz es un **menú**: icono, nombre y una entrada por modo. La
configuración del Entrenamiento pasa a `/entrenamiento` y el Modo Historia se
queda en `/historia`, cada uno con su vuelta al menú.

El **Multijugador Online se enseña desde ya, apagado** y con etiqueta de
«próximamente». Se ve que el modo existe y que falta, que es más honesto que
esconderlo; en la Fase 7 solo hay que convertirlo en enlace.

De paso se quitó el `favicon.ico`, que seguía siendo el de la plantilla de
Angular y era el que salía en la pestaña: los navegadores piden `/favicon.ico`
y ese ganaba al SVG del juego. El icono de la web es ahora únicamente la copia
servible del icono maestro.

### El tablero se destapa al acabar (posterior a la Fase 4)

El plan no decía qué pasa con lo que queda tapado cuando la partida termina, y
el motor lo dejaba oculto para siempre: se acababa la partida y no había manera
de ver dónde estaban las minas que nadie encontró ni qué escondía cada casilla.

Ahora `obtenerEstado()` deja de filtrar en cuanto la partida termina. Las celdas
que nadie tocó llegan despejadas con su número, y las minas que no encontró
nadie con un estado propio, `mina-sin-encontrar`, que durante la partida no
aparece nunca. La regla de oro sigue en pie mientras se juega, que es donde
importa: la IA no ve ni una celda más que un humano.

### La ayuda y el idioma, solo en el menú (posterior a la Fase 4)

Cada pantalla llevaba en su cabecera el selector de idioma y un enlace a la
ayuda, y la ayuda colgaba además del final de la partida. Con un menú principal
que se abre al arrancar y al que se vuelve entre partidas, repetirlos solo era
ruido: los dos viven ahora únicamente en el menú.
