/**
 * Genera los recursos graficos de Android a partir del icono maestro.
 *
 * El icono maestro es `documentos/MineHunt-icon.svg` y es la unica fuente: de
 * el salen el icono normal, las dos capas del icono adaptativo y la pantalla
 * de arranque. Los PNG intermedios quedan en `apps/web/resources/` y de ahi
 * `capacitor-assets` los reparte por las densidades del proyecto nativo.
 *
 * Se lanza con `npm run recursos-android` y hay que relanzarlo cada vez que se
 * retoque el icono maestro.
 */
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '../../..');
const ICONO_MAESTRO = resolve(RAIZ, 'documentos/MineHunt-icon.svg');
const DESTINO = resolve(AQUI, '../resources');

/** Fondo de la paleta (--mh-fondo), el mismo que declara capacitor.config.ts. */
const FONDO = '#0d1730';

/** Lado del icono y de la pantalla de arranque que espera capacitor-assets. */
const LADO_ICONO = 1024;
const LADO_SPLASH = 2732;

/**
 * Iconos adaptativos que hay que retocar despues de generarlos.
 *
 * capacitor-assets mete las DOS capas hacia dentro un 16,7 %. En la de delante
 * esta bien —es justo la zona que ningun lanzador recorta—, pero en la de
 * atras deja el borde transparente y el icono sale con un halo alrededor. El
 * fondo tiene que llegar hasta el filo.
 */
const ICONOS_ADAPTATIVOS = ['ic_launcher.xml', 'ic_launcher_round.xml'];

/** Parte el icono maestro en cabecera (con los degradados), fondo y dibujo. */
function trocearIcono(svg) {
  const rect = svg.match(/^\s*<rect[^>]*fill="url\(#bg\)"[^>]*\/>\s*$/m);
  if (rect === null) {
    throw new Error('el icono maestro ya no tiene el rectangulo de fondo');
  }
  const corte = svg.indexOf(rect[0]);
  return {
    cabecera: svg.slice(0, corte),
    fondo: rect[0].trim(),
    dibujo: svg.slice(corte + rect[0].length).replace('</svg>', '').trim(),
  };
}

/** SVG completo con el lado pedido y el contenido que se le pase. */
function envolver(cabecera, contenido, lado) {
  const inicio = cabecera.replace(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 512 512">`,
  );
  return `${inicio}\n${contenido}\n</svg>`;
}

const svg = await readFile(ICONO_MAESTRO, 'utf8');
const { cabecera, fondo, dibujo } = trocearIcono(svg);
await mkdir(DESTINO, { recursive: true });

/** Escribe un PNG en resources/ y lo cuenta por consola. */
async function escribir(nombre, imagen) {
  await writeFile(resolve(DESTINO, nombre), imagen);
  console.log(`  ${nombre}`);
}

console.log('Recursos de Android desde documentos/MineHunt-icon.svg:');

// Icono normal: el maestro tal cual, con sus esquinas redondeadas.
const iconoCompleto = await sharp(
  Buffer.from(envolver(cabecera, `${fondo}\n${dibujo}`, LADO_ICONO)),
)
  .png()
  .toBuffer();
await escribir('icon-only.png', iconoCompleto);

// Capa de atras del icono adaptativo: el degradado hasta el borde, sin las
// esquinas redondeadas, que de la forma ya se encarga el lanzador.
await escribir(
  'icon-background.png',
  await sharp(
    Buffer.from(
      envolver(cabecera, '<rect x="0" y="0" width="512" height="512" fill="url(#bg)"/>', LADO_ICONO),
    ),
  )
    .png()
    .toBuffer(),
);

// Capa de delante: solo el dibujo, sin fondo y a tamanno completo. Encogerlo
// aqui seria encogerlo dos veces, porque el icono adaptativo ya lo mete hacia
// dentro para dejarlo en la zona que ningun lanzador recorta.
await escribir(
  'icon-foreground.png',
  await sharp(Buffer.from(envolver(cabecera, dibujo, LADO_ICONO))).png().toBuffer(),
);

// Pantalla de arranque: el icono centrado sobre el fondo de la paleta. Se pinta
// pequenno a proposito, que la imagen se recorta segun la pantalla del movil.
const splash = await sharp({
  create: { width: LADO_SPLASH, height: LADO_SPLASH, channels: 4, background: FONDO },
})
  .composite([
    {
      input: await sharp(iconoCompleto)
        .resize(Math.round(LADO_SPLASH * 0.3), Math.round(LADO_SPLASH * 0.3))
        .toBuffer(),
      gravity: 'centre',
    },
  ])
  .png()
  .toBuffer();

// La app es oscura siempre, asi que la version clara y la oscura son la misma.
await escribir('splash.png', splash);
await escribir('splash-dark.png', splash);

// Reparte los PNG por las densidades de android/app/src/main/res/.
console.log('Repartiendo por densidades con capacitor-assets...');
// Se llama al CLI por su fichero y con este mismo node, en vez de por npx:
// asi no depende de como resuelva el PATH cada consola de Windows.
const require = createRequire(import.meta.url);
const paquete = require.resolve('@capacitor/assets/package.json');
const { bin } = require('@capacitor/assets/package.json');
const cli = resolve(dirname(paquete), typeof bin === 'string' ? bin : bin['capacitor-assets']);

execFileSync(process.execPath, [cli, 'generate', '--android'], {
  cwd: resolve(AQUI, '..'),
  stdio: 'inherit',
});

// Y el retoque del fondo, que capacitor-assets deja encogido.
const CARPETA_ADAPTATIVOS = resolve(AQUI, '../android/app/src/main/res/mipmap-anydpi-v26');
for (const nombre of ICONOS_ADAPTATIVOS) {
  const ruta = resolve(CARPETA_ADAPTATIVOS, nombre);
  const xml = await readFile(ruta, 'utf8');
  const arreglado = xml.replace(
    /<background>\s*<inset android:drawable="@mipmap\/ic_launcher_background"[^>]*\/>\s*<\/background>/,
    '<background android:drawable="@mipmap/ic_launcher_background" />',
  );
  if (arreglado === xml) {
    throw new Error(`${nombre} no tiene el fondo que se esperaba retocar`);
  }
  await writeFile(ruta, arreglado);
  console.log(`  fondo a sangre en ${nombre}`);
}

console.log('Listo.');
