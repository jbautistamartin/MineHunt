# MineHunt — Plan maestro del proyecto

## 1. Nombre e icono

**Nombre:** **MineHunt** (antes "MinaCaza") — más internacional, se entiende el concepto invertido en cualquier idioma: cazar minas, no evitarlas.

**Icono:** `MineHunt-icon.svg` (adjunto), mismo diseño que antes: fondo azul marino, mina roja-naranja con mecha encendida y un dedo/cursor tocándola.

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
