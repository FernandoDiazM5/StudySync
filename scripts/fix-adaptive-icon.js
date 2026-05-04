/**
 * fix-adaptive-icon.js
 *
 * Genera un nuevo adaptive-icon.png donde el logo ocupa solo
 * el 66 % central del canvas (zona segura de Android).
 * Usa @resvg/resvg-js (ya instalado como devDependency).
 *
 * Uso: node scripts/fix-adaptive-icon.js
 */

const fs   = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const CANVAS  = 1024;           // tamaño total del icono adaptativo
const SAFE    = Math.round(CANVAS * 0.50); // logo al 50% → tamaño estándar de apps
const OFFSET  = Math.round((CANVAS - SAFE) / 2);  // margen ~ 256 px

const bakPath = path.resolve(__dirname, '../assets/adaptive-icon.original.png');
// Siempre leer desde el original para no re-escalar el ya escalado
const srcPath = fs.existsSync(bakPath)
  ? bakPath
  : path.resolve(__dirname, '../assets/adaptive-icon.png');
const dstPath = path.resolve(__dirname, '../assets/adaptive-icon.png');

// ── 1. Leer PNG original y convertir a base64 ──────────────────────────────
const originalPng = fs.readFileSync(srcPath);
const b64 = originalPng.toString('base64');
const dataUri = `data:image/png;base64,${b64}`;

// ── 2. Construir SVG que coloca el logo centrado al 66 % ──────────────────
const svg = `<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">
  <!-- fondo blanco (coincide con backgroundColor del app.json) -->
  <rect width="${CANVAS}" height="${CANVAS}" fill="#ffffff"/>
  <!-- logo centrado, escalado al ${SAFE}x${SAFE} px -->
  <image href="${dataUri}"
         x="${OFFSET}" y="${OFFSET}"
         width="${SAFE}" height="${SAFE}"
         preserveAspectRatio="xMidYMid meet"/>
</svg>`;

// ── 3. Renderizar SVG → PNG con resvg ─────────────────────────────────────
console.log(`Canvas: ${CANVAS}px  |  Logo: ${SAFE}px  |  Offset: ${OFFSET}px`);

const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: CANVAS },
});
const pngData = resvg.render();
const pngBuffer = pngData.asPng();

// ── 4. Guardar backup del original y escribir el nuevo ────────────────────
if (!fs.existsSync(bakPath)) {
  fs.copyFileSync(path.resolve(__dirname, '../assets/adaptive-icon.png'), bakPath);
  console.log(`Backup guardado en: assets/adaptive-icon.original.png`);
}

fs.writeFileSync(dstPath, pngBuffer);
console.log(`✅  Nuevo adaptive-icon.png generado (${pngBuffer.length} bytes)`);
console.log(`    Logo ocupa el ${SAFE}x${SAFE} px centrado en ${CANVAS}x${CANVAS} px`);
console.log(`    Reconstruye la app (eas build) para aplicar el cambio.`);
