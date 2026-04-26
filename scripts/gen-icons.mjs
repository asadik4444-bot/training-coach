/**
 * Generates solid-color PNG icons for the PWA manifest.
 * Uses only Node.js built-ins (zlib + Buffer) — no external dependencies.
 * Run: node scripts/gen-icons.mjs
 *
 * Output: public/icon-192.png, public/icon-512.png, public/apple-touch-icon.png
 */

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

// ── PNG encoding helpers ──────────────────────────────────────────────────────

function crc32(buf) {
  const table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })();
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBytes, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBytes, data, crc]);
}

/**
 * Generate a solid-color PNG with white "TC" text drawn using simple pixel art.
 * @param {number} size - Width and height in pixels
 * @param {[number,number,number]} bg - Background RGB
 */
function makePNG(size, bg) {
  const [r, g, b] = bg;

  // Signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Pixel data — each row prefixed with filter byte 0 (None)
  // Draw a simple "TC" glyph in the center using a 5×7 bitmap font

  // 5×7 bitmap glyphs for T and C (each column is a bitmask top→bottom)
  const GLYPH_T = [
    0b1111110,
    0b0001000,
    0b0001000,
    0b0001000,
    0b0001000,
  ];
  const GLYPH_C = [
    0b0111110,
    0b1000000,
    0b1000000,
    0b1000000,
    0b0111110,
  ];

  const glyphW = 5;
  const glyphH = 7;
  const gap = Math.max(1, Math.round(size * 0.02));
  const totalW = glyphW * 2 + gap;
  const scale = Math.max(1, Math.floor(size / 24));
  const scaledW = totalW * scale;
  const scaledH = glyphH * scale;
  const startX = Math.floor((size - scaledW) / 2);
  const startY = Math.floor((size - scaledH) / 2);

  // Build pixel grid
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = [];
    for (let x = 0; x < size; x++) {
      // Determine if this pixel is part of "TC" text
      const px = x - startX;
      const py = y - startY;
      let isText = false;
      if (px >= 0 && py >= 0 && py < scaledH) {
        const gx = Math.floor(px / scale);
        const gy = Math.floor(py / scale);
        if (gy < glyphH) {
          if (gx < glyphW) {
            // T glyph
            isText = !!(GLYPH_T[gx] & (1 << (glyphH - 1 - gy)));
          } else if (gx >= glyphW + gap && gx < glyphW * 2 + gap) {
            // C glyph
            isText = !!(GLYPH_C[gx - glyphW - gap] & (1 << (glyphH - 1 - gy)));
          }
        }
      }
      if (isText) {
        row.push(255, 255, 255); // white
      } else {
        row.push(r, g, b); // background
      }
    }
    rows.push(Buffer.concat([Buffer.from([0]), Buffer.from(row)]));
  }

  const rawData = Buffer.concat(rows);
  const compressed = deflateSync(rawData);
  const idat = chunk("IDAT", compressed);
  const iend = chunk("IEND", Buffer.alloc(0));

  return Buffer.concat([sig, chunk("IHDR", ihdr), idat, iend]);
}

// ── Generate icons ────────────────────────────────────────────────────────────

const BG = [30, 64, 175]; // #1E40AF deep blue

const icons = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
];

for (const { name, size } of icons) {
  const png = makePNG(size, BG);
  const dest = join(publicDir, name);
  writeFileSync(dest, png);
  console.log(`✓ ${name} (${size}×${size}, ${png.length} bytes)`);
}

console.log("Icons written to public/");
