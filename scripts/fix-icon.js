/**
 * fix-icon.js
 *
 * Hace que icon.png sea exactamente 1024×1024 (Expo lo requiere cuadrado).
 * El logo se centra en el canvas. Usa @resvg/resvg-js (ya instalado).
 *
 * Uso: node scripts/fix-icon.js
 */

const fs   = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const CANVAS = 1024;

const srcPath = path.resolve(__dirname, '../assets/icon.png');
const dstPath = path.resolve(__dirname, '../assets/icon.png');
const bakPath = path.resolve(__dirname, '../assets/icon.original.png');

// 1. Leer PNG original
const originalPng = fs.readFileSync(srcPath);
const b64 = originalPng.toString('base64');
const dataUri = `data:image/png;base64,${b64}`;

// 2. SVG: coloca la imagen en canvas cuadrado (preserveAspectRatio la centra)
const svg = `<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">
  <rect width="${CANVAS}" height="${CANVAS}" fill="#ffffff"/>
  <image href="${dataUri}"
         x="0" y="0"
         width="${CANVAS}" height="${CANVAS}"
         preserveAspectRatio="xMidYMid meet"/>
</svg>`;

// 3. Renderizar → PNG cuadrado
const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: CANVAS } });
const pngData = resvg.render();
const pngBuffer = pngData.asPng();

// 4. Backup + escribir
if (!fs.existsSync(bakPath)) {
  fs.copyFileSync(srcPath, bakPath);
  console.log('Backup guardado en: assets/icon.original.png');
}

fs.writeFileSync(dstPath, pngBuffer);
console.log(`✅  icon.png corregido → ${CANVAS}×${CANVAS} px (${pngBuffer.length} bytes)`);
