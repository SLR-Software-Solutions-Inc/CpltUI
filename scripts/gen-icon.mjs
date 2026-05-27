#!/usr/bin/env node
// Generate the CpltUI macOS / Linux / Windows app icon.
//
// Design: Aurora-Linear gradient (violet → blue → teal) rounded-square mark
// on near-black canvas, with a stylized "C" cut from the gradient surface
// (modernist, no text). Output: src-tauri/icons/icon.png (1024×1024).
//
// After running this script, run `npm run tauri icon icons/icon.png` from
// src-tauri/ to produce the full multi-size + .icns + .ico set.

import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SIZE = 1024;
const OUT = join(__dirname, '../src-tauri/icons/icon.png');

// SVG — vector source, scales to any raster size sharp produces below.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 1024 1024">
  <defs>
    <!-- Aurora gradient: violet → indigo → teal (matches design-system tokens) -->
    <linearGradient id="aurora" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7c5cff"/>
      <stop offset="55%" stop-color="#5b8cff"/>
      <stop offset="100%" stop-color="#4ad8c7"/>
    </linearGradient>

    <!-- Inner glass overlay -->
    <linearGradient id="glass" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.22)"/>
      <stop offset="60%" stop-color="rgba(255,255,255,0)"/>
    </linearGradient>

    <!-- Soft outer glow -->
    <radialGradient id="glow" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="rgba(124,92,255,0.45)"/>
      <stop offset="70%" stop-color="rgba(124,92,255,0)"/>
    </radialGradient>

    <!-- Inner shadow for depth on the carved C -->
    <filter id="innerShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feOffset dx="0" dy="3" result="off"/>
      <feComposite in="off" in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" result="shadowOnly"/>
      <feFlood flood-color="rgba(0,0,0,0.45)"/>
      <feComposite in2="shadowOnly" operator="in"/>
      <feComposite in2="SourceGraphic" operator="over"/>
    </filter>
  </defs>

  <!-- 1) Outer ambient glow square (extends past rounded mark to feel spatial) -->
  <rect x="0" y="0" width="1024" height="1024" fill="url(#glow)" opacity="0.85"/>

  <!-- 2) Mark backdrop (dark canvas, slightly transparent so glow shows through) -->
  <rect x="0" y="0" width="1024" height="1024" fill="#08090c" opacity="0.0"/>

  <!-- 3) The mark — rounded square in aurora gradient -->
  <g transform="translate(112,112)">
    <rect x="0" y="0" width="800" height="800" rx="180" ry="180" fill="url(#aurora)"/>

    <!-- Subtle glass highlight on top half -->
    <rect x="0" y="0" width="800" height="800" rx="180" ry="180" fill="url(#glass)"/>

    <!-- Hairline border for definition -->
    <rect x="0.5" y="0.5" width="799" height="799" rx="180" ry="180"
          fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="1.5"/>

    <!-- The "C" carved into the mark — open mark, generous gap, geometric, modern -->
    <g filter="url(#innerShadow)">
      <path d="
        M 620 250
        A 200 200 0 1 0 620 550
        L 620 460
        A 110 110 0 1 1 620 340
        Z
      " fill="#08090c" fill-opacity="0.92"/>
    </g>

    <!-- Tiny aurora dot in the C opening — signature accent (the 'cursor') -->
    <circle cx="610" cy="400" r="36" fill="url(#aurora)" opacity="0.95"/>
    <circle cx="610" cy="400" r="36" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2"/>
  </g>
</svg>`;

const buf = await sharp(Buffer.from(svg))
  .resize(SIZE, SIZE)
  .png({ compressionLevel: 9 })
  .toBuffer();

writeFileSync(OUT, buf);
console.log(`wrote ${OUT} (${buf.length} bytes, ${SIZE}×${SIZE})`);
