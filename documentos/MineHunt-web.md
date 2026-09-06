# La web de MineHunt

Cómo se desarrolla, se compila y se publica el cliente Angular (`apps/web`). Lo
que es específico del APK está en [MineHunt-android.md](MineHunt-android.md), y
lo que es específico del servidor de partidas, en
[MineHunt-servidor.md](MineHunt-servidor.md).

## Desarrollo

```bash
npm run compilar --workspace @minehunt/game-engine   # el motor primero, siempre
npm run arrancar --workspace @minehunt/web           # ng serve en el 4200
```

O `arrancar-web.cmd` desde el Explorador, que hace las dos cosas y abre el
navegador. Para el Multijugador Online hace falta además el servidor:
`arrancar-online.cmd` levanta los dos, cada uno en su ventana.

**La trampa del monorepo:** la web consume el `dist/` compilado del motor, no su
código fuente. Si tocas el motor y no lo recompilas, la web se prueba contra la
versión anterior y los errores no tienen sentido.

## El build de producción

```bash
npm run compilar --workspace @minehunt/web   # = ng build
```

`ng build` usa la configuración `production` por defecto (así lo deja el CLI de
Angular 22), así que no hay que pasarle ningún flag. Lo que hace:

- Compila con **AOT**, minifica y aplica *tree shaking*.
- **Trocea por rutas**: cada pantalla es un `chunk` aparte, porque todas se
  cargan con `loadComponent`. Lo que se descarga al abrir el juego es el menú,
  no las cinco pantallas.
- **Pone hash a los nombres** (`outputHashing: "all"`), que es lo que permite
  cachear los estáticos para siempre sin quedarse con una versión vieja.
- Copia `public/` **a la raíz de la salida**: ahí van el icono, los PNG del
  manifiesto, los dos manifiestos y `assets/i18n/{es,en}.json`. No existe
  `src/assets/`.

Deja todo en **`apps/web/dist/web/browser/`**. Esa carpeta es lo que se sirve, y
es también la que Capacitor mete dentro del APK (`webDir` en
`capacitor.config.ts`, comprobado por `empaquetado.prueba.ts`).

### Presupuestos de tamaño

`angular.json` limita el bundle inicial: **aviso a 500 kB y error a 1 MB**, y
6 kB / 10 kB por hoja de estilos de componente. No están de adorno: el juego
tiene que arrancar en un móvil con una conexión mala. Si un cambio revienta el
presupuesto, la respuesta es mirar qué ha entrado en el bundle inicial —casi
siempre algo que debería cargarse con la ruta que lo usa—, no subir el número.

### Comprobar el build sin desplegar nada

```bash
npx http-server apps/web/dist/web/browser -p 8080   # cualquier servidor estatico vale
```

Hace falta un servidor de verdad, y no abrir el `index.html` con doble clic: las
rutas de Angular y la carga de los ficheros de idioma no funcionan sobre
`file://`.

**Ojo con el enrutado:** el juego usa rutas de verdad (`/historia`, `/online`),
así que quien sirva los estáticos tiene que devolver `index.html` para cualquier
ruta que no sea un fichero. En la Fase 9 eso lo hará el propio Nest, que sirve la
web y las partidas desde la misma imagen.

## La aplicación instalable (PWA)

Hay **un manifiesto por idioma**, `public/manifest.es.json` y
`public/manifest.en.json`: el nombre y la descripción con los que la aplicación
se instala los lee el navegador *antes* de que arranque nada, así que
ngx-translate no llega a tiempo. `index.html` enlaza el del idioma de reserva
(inglés, el mismo `fallbackLang`) y **`ServicioIdioma` cambia el `href` en cuanto
sabe en qué idioma va la interfaz**, también cuando el jugador lo cambia a mano.
`manifiesto.prueba.ts` comprueba que estén los dos, que no sean el mismo texto
repetido, que apunten a iconos que existen y que `index.html` enlace uno.

No hay *service worker* ni juego sin conexión: el Entrenamiento y la Historia ya
funcionan sin red una vez cargada la página, y el Online necesita servidor por
definición. Añadirlo obligaría a resolver las actualizaciones en caliente a
cambio de nada que el jugador note.

## Los iconos

Todos salen del icono maestro `documentos/MineHunt-icon.svg`, **nunca a mano**:

```bash
npm run recursos-web --workspace @minehunt/web       # PNG del manifiesto
npm run recursos-android --workspace @minehunt/web   # iconos y splash del APK
```

`recursos-web` deja en `public/` el `icono-192.png`, el `icono-512.png` y el
`icono-maskable-512.png` —este último con su margen, porque Android recorta el
icono con la forma que quiera y solo respeta el 80 % central—. `icono.svg` es la
copia servible del maestro y se usa como favicon. Si se retoca el icono maestro,
hay que relanzar los dos scripts y copiar el SVG.

## Sonido y animaciones

El sonido lo sintetiza `ServicioSonido` con Web Audio: **no hay ficheros de audio
en el repositorio**. Cuatro efectos cortos salen de un oscilador y una
envolvente, no hay licencias que revisar y no engordan el APK. Se enciende y se
apaga desde el menú principal y se recuerda (`minehunt.sonido`). Si el navegador
no trae Web Audio, el juego sigue igual.

Los botones de la interfaz suenan por un único oyente de clic en el componente
raíz, no botón a botón. El interruptor del sonido está en el menú principal y
—porque es donde de verdad molesta— también dentro de la partida, en el pie.

La aplicación abre con una **presentación corta** (`componentes/intro/`): icono,
nombre y lema, tres segundos y medio, y se salta tocando la pantalla.
`ServicioIntro` hace que salga una sola vez por sesión, no cada vez que se
vuelve al menú entre partidas. No suena, porque los navegadores no dejan
reproducir audio antes de que el jugador toque nada y eso ocurre justo después.

Las animaciones del tablero son **CSS y nada más**: una celda estrena su clase al
destaparse y la animación arranca ahí, así que no hay temporizadores ni
orquestación desde TypeScript. Se respetan `prefers-reduced-motion: reduce`, que
en un juego de clics importa de verdad: las celdas se mueven justo donde se está
pulsando.

## Estilos compartidos

Lo que usan dos pantallas vive en `src/styles.css`: la paleta, los botones
(`.principal`, `.secundario`, `.discreto`), el color de cada jugador, el bloque
de confirmación y el botón de silencio. No es manía de ordenar: **cada hoja de
estilos de componente tiene su propio presupuesto** (aviso a 6 kB, error a 10),
y `online.css` lo reventó por llevar repetido lo que ya estaba en `partida.css`.
Las pantallas que quieran otro tamaño de botón siguen pudiendo redefinirlo: el
CSS de un componente va encapsulado y gana al global.

## Textos

Todo lo que ve el jugador sale de `public/assets/i18n/{es,en}.json` por clave de
ngx-translate. Al añadir una pantalla o un mensaje se tocan **los dos ficheros en
el mismo cambio**; si falta uno, ese idioma cae al inglés por el `fallbackLang` y
no falla nada, que es justo lo que lo hace fácil de olvidar.

Lo único con texto escrito a mano en todo el proyecto es el panel de salas del
servidor, y está documentado como excepción en
[MineHunt-servidor.md](MineHunt-servidor.md): esa página no la ve ningún jugador.

## Dónde apunta el Online

La dirección del servidor la decide `nucleo/servidor.ts`: el propio origen
cuando la web se sirve desde uno que no sea el `ng serve` —lo que acertará en la
Fase 9, con web y servidor en la misma imagen— y, en Android y en desarrollo, la
IP fija del PC (`SERVIDOR_DE_DESARROLLO`, provisional). Siempre se puede cambiar
desde «Cambiar de servidor», y lo guardado manda.
