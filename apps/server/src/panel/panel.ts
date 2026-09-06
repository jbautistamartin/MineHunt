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
  const bots = sala.bots > 0 ? ` · ${String(sala.bots)} ${sala.bots === 1 ? 'bot' : 'bots'}` : '';
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
const ICONO = `<svg class="icono" viewBox="0 0 48 48" width="44" height="44" aria-hidden="true">
  <circle cx="24" cy="27" r="13" fill="#e8433a" />
  <path d="M24 14V5" stroke="#f0a92b" stroke-width="3" stroke-linecap="round" />
  <circle cx="24" cy="4" r="3" fill="#f0a92b" />
  <circle cx="19" cy="22" r="3" fill="#ff8a7a" />
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
