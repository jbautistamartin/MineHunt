/**
 * Genera los iconos PNG de la web (PWA) a partir del icono maestro.
 *
 * Misma idea que `generar-recursos-android.mjs` y misma unica fuente,
 * `documentos/MineHunt-icon.svg`: aqui nadie dibuja un icono a mano. Lo que
 * cambia es el destino —`apps/web/public/`, que Angular copia tal cual a la
 * raiz del build— y que hacen falta PNG: el manifiesto admite SVG, pero
 * Android y Windows quieren un mapa de bits para el icono de la aplicacion
 * instalada, y el maskable ademas tiene que traer su propio margen.
 *
 * Se lanza con `npm run recursos-web` y hay que relanzarlo cada vez que se
 * retoque el icono maestro.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '../../..');
const ICONO_MAESTRO = resolve(RAIZ, 'documentos/MineHunt-icon.svg');
const DESTINO = resolve(AQUI, '../public');

/** Fondo de la paleta (--mh-fondo), el mismo del manifiesto y de Android. */
const FONDO = '#0d1730';

/** Lo que pide el manifiesto: uno para la lista y otro para la instalacion. */
const LADOS = [192, 512];

/**
 * Margen del icono enmascarable.
 *
 * Android recorta el icono con la forma que le da la gana —circulo, cuadrado
 * redondeado, gota— y solo garantiza el 80 % central. Con el dibujo pegado al
 * borde, el recorte se come la mecha de la mina.
 */
const ZONA_SEGURA = 0.8;

const svg = await readFile(ICONO_MAESTRO, 'utf8');

async function escribir(nombre, imagen) {
  await writeFile(resolve(DESTINO, nombre), imagen);
  console.log(`  ${nombre}`);
}

await mkdir(DESTINO, { recursive: true });
console.log('Iconos de la web desde documentos/MineHunt-icon.svg:');

for (const lado of LADOS) {
  await escribir(
    `icono-${lado}.png`,
    await sharp(Buffer.from(svg)).resize(lado, lado).png().toBuffer(),
  );
}

// El enmascarable: el mismo icono encogido sobre el fondo de la paleta, para
// que lo que recorte el lanzador sea fondo y no dibujo.
const lado = 512;
const dentro = Math.round(lado * ZONA_SEGURA);
await escribir(
  'icono-maskable-512.png',
  await sharp({ create: { width: lado, height: lado, channels: 4, background: FONDO } })
    .composite([
      {
        input: await sharp(Buffer.from(svg)).resize(dentro, dentro).png().toBuffer(),
        gravity: 'centre',
      },
    ])
    .png()
    .toBuffer(),
);

console.log('Listo. Los recoge el build de Angular desde public/.');
