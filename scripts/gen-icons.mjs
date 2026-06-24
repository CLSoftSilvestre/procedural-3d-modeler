/**
 * Generates the PWA icon set with no external deps — draws the brand isometric cube on a
 * dark rounded background and encodes real PNGs via Node's zlib. Re-run with `npm run icons`.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public');
mkdirSync(OUT, { recursive: true });

const BG = [17, 20, 27, 255]; // #11141b
const FACE_TOP = [143, 189, 255, 255]; // #8fbdff
const FACE_RIGHT = [110, 168, 254, 255]; // #6ea8fe
const FACE_LEFT = [79, 134, 214, 255]; // #4f86d6

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  // 10,11,12 = compression/filter/interlace = 0
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

/** Fill a convex polygon (scanline, even-odd) with alpha-over blending. */
function fillPoly(buf, W, H, pts, color) {
  let minY = H;
  let maxY = 0;
  for (const [, y] of pts) {
    minY = Math.min(minY, Math.floor(y));
    maxY = Math.max(maxY, Math.ceil(y));
  }
  minY = Math.max(0, minY);
  maxY = Math.min(H - 1, maxY);
  for (let y = minY; y <= maxY; y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      if (y1 <= y && y2 > y) xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
      else if (y2 <= y && y1 > y) xs.push(x2 + ((y - y2) / (y1 - y2)) * (x1 - x2));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.round(xs[k]));
      const xb = Math.min(W - 1, Math.round(xs[k + 1]));
      for (let x = xa; x <= xb; x++) blend(buf, (y * W + x) * 4, color);
    }
  }
}

function blend(buf, o, [r, g, b, a]) {
  const inv = 1 - a / 255;
  buf[o] = Math.round(r * (a / 255) + buf[o] * inv);
  buf[o + 1] = Math.round(g * (a / 255) + buf[o + 1] * inv);
  buf[o + 2] = Math.round(b * (a / 255) + buf[o + 2] * inv);
  buf[o + 3] = 255;
}

function roundedBg(buf, W, H, radius, color) {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = Math.min(x, W - 1 - x);
      const dy = Math.min(y, H - 1 - y);
      let inside = true;
      if (dx < radius && dy < radius) {
        const ex = radius - dx;
        const ey = radius - dy;
        inside = ex * ex + ey * ey <= radius * radius;
      }
      if (inside) {
        const o = (y * W + x) * 4;
        buf[o] = color[0];
        buf[o + 1] = color[1];
        buf[o + 2] = color[2];
        buf[o + 3] = color[3];
      }
    }
  }
}

function drawIcon(size, { rounded = true, scale = 0.62 } = {}) {
  const buf = Buffer.alloc(size * size * 4); // transparent
  roundedBg(buf, size, size, rounded ? size * 0.22 : 0, BG);
  const cx = size / 2;
  const cy = size / 2;
  const r = (size * scale) / 2;
  const hx = r * 0.866;
  const hy = r * 0.5;
  const T = [cx, cy - r];
  const UR = [cx + hx, cy - hy];
  const LR = [cx + hx, cy + hy];
  const B = [cx, cy + r];
  const LL = [cx - hx, cy + hy];
  const UL = [cx - hx, cy - hy];
  const C = [cx, cy];
  fillPoly(buf, size, size, [T, UR, C, UL], FACE_TOP);
  fillPoly(buf, size, size, [C, UR, LR, B], FACE_RIGHT);
  fillPoly(buf, size, size, [UL, C, B, LL], FACE_LEFT);
  return encodePNG(size, size, buf);
}

const files = {
  'pwa-192x192.png': drawIcon(192),
  'pwa-512x512.png': drawIcon(512),
  // Maskable: full-bleed background, cube kept inside the safe zone.
  'pwa-maskable-512x512.png': drawIcon(512, { rounded: false, scale: 0.5 }),
  'apple-touch-icon-180x180.png': drawIcon(180),
};
for (const [name, data] of Object.entries(files)) {
  writeFileSync(resolve(OUT, name), data);
  console.log('wrote', name, `(${data.length} bytes)`);
}

// Crisp vector favicon (matches the cube mark).
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#11141b"/>
  <g transform="translate(32 32)">
    <polygon points="0,-18 15.6,-9 0,0 -15.6,-9" fill="#8fbdff"/>
    <polygon points="0,0 15.6,-9 15.6,9 0,18" fill="#6ea8fe"/>
    <polygon points="-15.6,-9 0,0 0,18 -15.6,9" fill="#4f86d6"/>
  </g>
</svg>
`;
writeFileSync(resolve(OUT, 'favicon.svg'), favicon);
console.log('wrote favicon.svg');
