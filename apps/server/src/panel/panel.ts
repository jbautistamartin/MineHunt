import type { EstadoSala } from '@minehunt/game-engine';

import type { InformeSala } from '../salas/sala.js';

/**
 * El panel del servidor: la pagina que se ve al abrir su direccion en el
 * navegador.
 *
 * Es lo unico del servidor que se lee en vez de consumirse: quien lleva el
 * servidor abre la direccion y ve de un vistazo que salas hay, con que codigo
 * se entra en ellas, cuanto llevan abiertas y si estan jugando. Sustituye a la
 * linea de texto de la Fase 0, que solo decia que el proceso estaba vivo.
 *
 * **Los textos van aqui en espanol y sin pasar por ngx-translate**, que es la
 * unica excepcion a la convencion 2 y la unica cosa con texto que sale del
 * servidor. No la contradice en el fondo: la convencion protege lo que ve el
 * *jugador*, y esto no lo ve ningun jugador —la aplicacion habla por el socket
 * y jamas pide esta pagina—, sino quien administra el servidor. Nada de lo que
 * hay aqui viaja a un cliente del juego.
 *
 * Se pinta entero en el servidor, sin plantillas ni dependencias: son cuatro
 * cadenas y asi el panel no arrastra nada a la imagen de la Fase 9. Lo unico
 * que hace el navegador es volver a pedir la lista cada pocos segundos y
 * cambiarla de sitio, para que no haya que recargar a mano.
 */

/** Cada cuanto el navegador vuelve a pedir la lista de salas. */
const REFRESCO_MS = 3000;

/** Ruta de la que sale la lista sola, sin el resto de la pagina. */
export const RUTA_DE_LA_LISTA = '/panel/salas';

/** Como se llama cada estado de sala en la pagina. */
const NOMBRE_DEL_ESTADO: Record<EstadoSala, string> = {
  lobby: 'En el lobby',
  jugando: 'En partida',
  terminada: 'Partida terminada',
};

/**
 * Cuanto lleva abierta, dicho como se dice en voz alta.
 *
 * Los segundos solo importan el primer minuto: a partir de ahi lo que se
 * quiere saber es si una sala lleva un rato o lleva ahi toda la tarde.
 */
export function formatearDuracion(milisegundos: number): string {
  const segundos = Math.max(0, Math.floor(milisegundos / 1000));
  if (segundos < 60) {
    return `${String(segundos)} s`;
  }

  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) {
    return `${String(minutos)} min`;
  }

  const horas = Math.floor(minutos / 60);
  return `${String(horas)} h ${String(minutos % 60).padStart(2, '0')} min`;
}

/**
 * Texto de un jugador metido en el HTML.
 *
 * El nombre lo escribe quien entra en la sala, asi que llega aqui tal cual lo
 * tecleo: sin esto, quien se llame `<script>` ejecuta lo que quiera en el
 * navegador del que mira el panel.
 */
export function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Las salas y el resumen de arriba: lo unico que cambia solo.
 *
 * Va aparte de la pagina porque es lo que el navegador vuelve a pedir cada
 * pocos segundos. Que lo pinte el servidor y no un script evita tener dos
 * versiones del mismo HTML, una en TypeScript y otra dentro de una cadena.
 */
export function contenidoDelPanel(informes: readonly InformeSala[]): string {
  // Por orden de apertura: las cartas se quedan quietas mientras se mira.
  const salas = [...informes].sort((a, b) => b.abiertaHaceMs - a.abiertaHaceMs);

  const jugando = salas.filter((sala) => sala.estado === 'jugando').length;
  const gente = salas.reduce((total, sala) => total + sala.conectados, 0);

  return `
    <div class="resumen">
      ${cifra(salas.length, 'salas activas')}
      ${cifra(jugando, 'partidas en curso')}
      ${cifra(gente, 'jugadores conectados')}
    </div>
    ${salas.length === 0 ? vacio() : `<ul class="salas">${salas.map(tarjeta).join('')}</ul>`}
  `;
}

/** La pagina entera, con el panel dentro. */
export function paginaDelPanel(
  informes: readonly InformeSala[],
  versionDelMotor: string,
): string {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <meta name="theme-color" content="#0d1730" />
    <title>MineHunt — servidor</title>
    <link rel="icon" href="data:image/svg+xml,${encodeURIComponent(ICONO)}" />
    <style>${ESTILOS}</style>
  </head>
  <body>
    <main class="pantalla">
      <header class="cabecera">
        ${ICONO}
        <h1>MineHunt</h1>
        <p class="lema">Servidor de partidas · motor ${escapar(versionDelMotor)}</p>
      </header>
      <section id="salas" class="panel">${contenidoDelPanel(informes)}</section>
      <footer class="pie">
        <p>La lista se actualiza sola cada ${String(REFRESCO_MS / 1000)} segundos.</p>
        <p>Para jugar, abre la aplicacion y entra con el codigo de la sala.</p>
      </footer>
    </main>
    <script>${GUION}</script>
  </body>
</html>
`;
}

function cifra(valor: number, etiqueta: string): string {
  return `<p class="cifra"><strong>${String(valor)}</strong><span>${etiqueta}</span></p>`;
}

function vacio(): string {
  return `
    <p class="vacio">
      No hay ninguna sala abierta. La primera se crea desde la aplicacion, en
      Multijugador Online.
    </p>
  `;
}

function tarjeta(sala: InformeSala): string {
  const humanos = sala.jugadores - sala.bots;
  const bots =
    sala.bots > 0
      ? ` · ${String(sala.bots)} ${sala.bots === 1 ? 'bot' : 'bots'}`
      : '';
  // Una persona que se fue deja su puesto guardado hasta que vuelve, y eso es
  // justo lo que hay que ver desde fuera: hay sitios ocupados por nadie.
  const ausentes = humanos - sala.conectados;

  return `
    <li class="sala">
      <p class="codigo">${escapar(sala.codigo)}</p>
      <div class="datos">
        <p class="nombre">Sala de ${escapar(sala.anfitrion) || '—'}</p>
        <p class="detalle">
          ${String(sala.jugadores)}/${String(sala.maximo)} jugadores${bots}
          ${ausentes > 0 ? `· ${String(ausentes)} sin conexion` : ''}
        </p>
      </div>
      <div class="etiquetas">
        <span class="etiqueta estado-${sala.estado}">${NOMBRE_DEL_ESTADO[sala.estado]}</span>
        <span class="etiqueta">${sala.publica ? 'Publica' : 'Privada'}</span>
        <span class="etiqueta tiempo">${formatearDuracion(sala.abiertaHaceMs)}</span>
      </div>
    </li>
  `;
}

/** La mina del icono del juego, simplificada para que quepa en una cadena. */
/*
 * El icono del juego, **copia literal del icono maestro**
 * (`documentos/MineHunt-icon.svg`) con el tamano puesto en la etiqueta. Va
 * copiado y no leido del disco porque la imagen de la Fase 9 no llevara la
 * carpeta de documentacion dentro, y sirve para las dos cosas: la cabecera de
 * la pagina y el icono de la pestana. Antes habia aqui un dibujo aparte, mas
 * pobre y distinto del de la aplicacion; si se retoca el maestro hay que
 * volver a copiarlo, y `panel.prueba.ts` falla mientras no se haga.
 */
export const ICONO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="44" height="44" aria-hidden="true">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1b2a4a"/>
      <stop offset="100%" stop-color="#0d1730"/>
    </linearGradient>
    <radialGradient id="mine" cx="35%" cy="30%" r="75%">
      <stop offset="0%" stop-color="#ff8a4c"/>
      <stop offset="55%" stop-color="#e8433a"/>
      <stop offset="100%" stop-color="#a5211f"/>
    </radialGradient>
    <radialGradient id="spark" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fff6c8"/>
      <stop offset="100%" stop-color="#ffd23f"/>
    </radialGradient>
  </defs>

  <rect x="0" y="0" width="512" height="512" rx="96" fill="url(#bg)"/>

  <g stroke="#3a1210" stroke-width="14" stroke-linecap="round">
    <line x1="256" y1="150" x2="256" y2="100"/>
    <line x1="256" y1="382" x2="256" y2="432"/>
    <line x1="150" y1="266" x2="100" y2="266"/>
    <line x1="382" y1="266" x2="432" y2="266"/>
    <line x1="184" y1="194" x2="150" y2="160"/>
    <line x1="328" y1="194" x2="362" y2="160"/>
    <line x1="184" y1="338" x2="150" y2="372"/>
    <line x1="328" y1="338" x2="362" y2="372"/>
  </g>

  <circle cx="256" cy="266" r="116" fill="url(#mine)" stroke="#3a1210" stroke-width="10"/>
  <ellipse cx="215" cy="220" rx="34" ry="20" fill="#ffffff" opacity="0.25"/>

  <path d="M300 178 C 330 150, 340 120, 320 90" stroke="#5a3b26" stroke-width="12" fill="none" stroke-linecap="round"/>
  <circle cx="320" cy="86" r="22" fill="url(#spark)"/>
  <circle cx="320" cy="86" r="22" fill="none" stroke="#ff9f1c" stroke-width="4" opacity="0.6"/>

  <g transform="translate(300,300) rotate(-20)">
    <path d="M0 60 L0 5 C0 -8 18 -8 18 5 L18 20 L34 24 C46 27 52 36 50 48 L44 78
             C42 90 32 98 20 98 L4 98 C-6 98 -14 92 -18 84 L-32 56 C-36 48 -30 38 -20 40
             L-14 42 L-14 5 C-14 -8 4 -8 4 5"
          fill="#ffe0c2" stroke="#3a1210" stroke-width="6" stroke-linejoin="round"/>
  </g>
</svg>`;

/* Los colores son los de la aplicacion (`apps/web/src/styles.css`); si se
   retoca la paleta alli, esto se queda atras a proposito antes que arrastrar
   el CSS del cliente a la imagen del servidor. */
const ESTILOS = `
  :root {
    --mh-fondo: #0d1730;
    --mh-superficie: #16223f;
    --mh-superficie-alta: #1f2f52;
    --mh-texto: #e8eefc;
    --mh-texto-tenue: #8fa6d4;
    --mh-acento: #e8433a;
    --mh-verde: #45c07a;
    --mh-ambar: #f0a92b;
    color-scheme: dark;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    min-height: 100dvh;
    font-family: system-ui, -apple-system, "Segoe UI", roboto, sans-serif;
    color: var(--mh-texto);
    background: var(--mh-fondo);
  }
  .pantalla {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    align-items: center;
    width: min(48rem, 100%);
    margin: 0 auto;
    padding: 2rem 1rem 3rem;
  }
  .cabecera { text-align: center; }
  h1 { margin: 0.25rem 0 0; font-size: 1.6rem; letter-spacing: 0.02em; }
  .lema { margin: 0.25rem 0 0; font-size: 0.9rem; color: var(--mh-texto-tenue); }
  .panel { width: 100%; }
  .resumen {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }
  .cifra {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 0.15rem;
    margin: 0;
    padding: 0.75rem;
    text-align: center;
    background: var(--mh-superficie);
    border-radius: 0.75rem;
  }
  .cifra strong { font-size: 1.5rem; }
  .cifra span { font-size: 0.75rem; color: var(--mh-texto-tenue); }
  .salas { display: flex; flex-direction: column; gap: 0.6rem; margin: 0; padding: 0; }
  .sala {
    display: flex;
    gap: 0.9rem;
    align-items: center;
    padding: 0.9rem 1rem;
    background: var(--mh-superficie);
    border-radius: 0.75rem;
    list-style: none;
  }
  .codigo {
    margin: 0;
    font-family: ui-monospace, "Cascadia Mono", consolas, monospace;
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    color: var(--mh-texto);
  }
  .datos { flex: 1; min-width: 0; }
  .nombre { margin: 0; font-size: 1rem; }
  .detalle { margin: 0.15rem 0 0; font-size: 0.8rem; color: var(--mh-texto-tenue); }
  .etiquetas { display: flex; flex-wrap: wrap; gap: 0.35rem; justify-content: flex-end; }
  .etiqueta {
    padding: 0.2rem 0.55rem;
    font-size: 0.75rem;
    color: var(--mh-texto-tenue);
    background: var(--mh-superficie-alta);
    border-radius: 999px;
    white-space: nowrap;
  }
  .estado-lobby { color: var(--mh-ambar); }
  .estado-jugando { color: var(--mh-verde); }
  .estado-terminada { color: var(--mh-acento); }
  .vacio {
    margin: 0;
    padding: 2rem 1rem;
    text-align: center;
    color: var(--mh-texto-tenue);
    background: var(--mh-superficie);
    border-radius: 0.75rem;
  }
  .pie { text-align: center; }
  .pie p { margin: 0.2rem 0; font-size: 0.8rem; color: var(--mh-texto-tenue); }
  @media (width < 30rem) {
    .sala { flex-wrap: wrap; }
    .etiquetas { justify-content: flex-start; width: 100%; }
  }
`;

/*
 * Lo unico que hace el navegador: volver a pedir la lista y ponerla donde
 * estaba. Si el servidor no contesta se deja lo ultimo que se vio y se
 * reintenta a la siguiente, que es mejor que vaciar la pantalla cada vez que
 * parpadea la red.
 */
const GUION = `
  const destino = document.getElementById('salas');
  setInterval(async () => {
    try {
      const respuesta = await fetch('${RUTA_DE_LA_LISTA}', { cache: 'no-store' });
      if (respuesta.ok) {
        destino.innerHTML = await respuesta.text();
      }
    } catch {
      // El servidor no esta; se vuelve a intentar en el siguiente ciclo.
    }
  }, ${String(REFRESCO_MS)});
`;
