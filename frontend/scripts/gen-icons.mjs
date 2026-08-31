// scripts/gen-icons.mjs
// Genera todos los PNG de íconos de la app a partir de SVGs, usando `sharp`.
//
// Uso:   cd frontend && npm i -D sharp && node scripts/gen-icons.mjs
//
// Produce en assets/images/:
//   icon.png                     1024  (ícono principal, iOS + fallback)
//   favicon.png                   196  (web)
//   splash-icon.png               512  (pantalla de carga, fondo transparente)
//   android-icon-foreground.png  1024  (adaptive icon, casco con margen, transparente)
//   android-icon-background.png  1024  (adaptive icon, fondo sólido)
//   android-icon-monochrome.png  1024  (ícono temático Android 13+, silueta blanca)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'assets', 'images');
mkdirSync(OUT, { recursive: true });

const FULL = readFileSync(join(__dirname, '..', 'assets', 'icon-source.svg'), 'utf8');

// Casco solo, sin fondo — para foreground / splash. Con margen (safe zone ~66%).
const HAT_ONLY = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(512 512) scale(0.62) translate(-512 -470)">
    <ellipse cx="512" cy="648" rx="424" ry="92" fill="#F59E0B"/>
    <path d="M150 636 C150 300 262 196 512 196 C762 196 874 300 874 636 Z" fill="#FBBF24"/>
    <path d="M150 636 C150 300 262 196 512 196 C420 220 322 330 322 636 Z" fill="#FDE68A" opacity="0.55"/>
    <rect x="484" y="206" width="56" height="430" rx="28" fill="#F59E0B"/>
    <path d="M300 616 C300 372 360 262 470 220" stroke="#F59E0B" stroke-width="38" fill="none" stroke-linecap="round"/>
    <path d="M724 616 C724 372 664 262 554 220" stroke="#F59E0B" stroke-width="38" fill="none" stroke-linecap="round"/>
    <path d="M88 636 C88 700 280 742 512 742 C744 742 936 700 936 636 C936 636 900 690 512 690 C124 690 88 636 88 636 Z" fill="#FBBF24"/>
    <ellipse cx="512" cy="628" rx="424" ry="86" fill="#FBBF24"/>
  </g>
</svg>`;

const HAT_MONO = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(512 512) scale(0.62) translate(-512 -470)" fill="#FFFFFF">
    <path d="M150 636 C150 300 262 196 512 196 C762 196 874 300 874 636 Z"/>
    <path d="M88 636 C88 700 280 742 512 742 C744 742 936 700 936 636 C936 636 900 690 512 690 C124 690 88 636 88 636 Z"/>
    <ellipse cx="512" cy="628" rx="424" ry="86"/>
  </g>
</svg>`;

const BG = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg"><rect width="1024" height="1024" fill="#1F2937"/></svg>`;

async function png(svg, size, file, { transparent = false } = {}) {
  let img = sharp(Buffer.from(svg)).resize(size, size);
  if (!transparent) img = img.flatten({ background: '#1F2937' });
  await img.png().toFile(join(OUT, file));
  console.log('  ✓', file, `(${size}px)`);
}

console.log('Generando íconos...');
await png(FULL, 1024, 'icon.png');
await png(FULL, 196, 'favicon.png');
await png(HAT_ONLY, 512, 'splash-icon.png', { transparent: true });
await png(HAT_ONLY, 1024, 'android-icon-foreground.png', { transparent: true });
await png(BG, 1024, 'android-icon-background.png');
await png(HAT_MONO, 1024, 'android-icon-monochrome.png', { transparent: true });
console.log('Listo. Íconos en assets/images/');
