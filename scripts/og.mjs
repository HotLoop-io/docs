// Generates every raster the site needs: Open Graph cards, favicons, and the
// touch icons. Runs before the build (`npm run build`), and its output in
// public/ is regenerated every time, so a brand change is one edit here.
//
// All text is converted to outlined glyph paths with opentype.js. sharp renders
// SVG with librsvg, which has no idea what Inter is and would silently fall back
// to whatever the build machine has installed. That is the same failure that made
// the first wordmark render as Arial, so nothing here uses a live <text> element.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const pub = resolve(root, 'public');
mkdirSync(resolve(pub, 'og'), { recursive: true });

// Token values, copied from brand/tokens.css. A build script cannot import CSS
// custom properties, so these are the one place hex values are allowed to live.
const T = {
  bg: '#14120F', card: '#1C1A16', border: '#2C2924',
  ink: '#F5F3EF', soft: '#A6A29A', orange: '#FF5A00', amber: '#FFB700',
  lightBg: '#FBFAF8',
};

const load = (w) =>
  opentype.parse(readFileSync(resolve(root, `node_modules/@fontsource/inter/files/inter-latin-${w}-normal.woff`)).buffer);
const bold = load(800);
const regular = load(500);

// Glyph-by-glyph layout. This avoids opentype.js's GSUB shaping, which cannot
// parse Inter's lookupType 6 substFormat 2 table.
function measure(font, text, size, tracking = 0) {
  const s = size / font.unitsPerEm;
  let w = 0, prev = null;
  for (const ch of text) {
    const g = font.charToGlyph(ch);
    if (prev) w += font.getKerningValue(prev, g) * s;
    w += g.advanceWidth * s + tracking;
    prev = g;
  }
  return w;
}
function pathFor(font, text, size, x, y, tracking = 0) {
  const p = new opentype.Path();
  const s = size / font.unitsPerEm;
  let pen = x, prev = null;
  for (const ch of text) {
    const g = font.charToGlyph(ch);
    if (prev) pen += font.getKerningValue(prev, g) * s;
    p.extend(g.getPath(pen, y, size));
    pen += g.advanceWidth * s + tracking;
    prev = g;
  }
  return p.toPathData(2);
}
function wrap(font, text, size, maxW, tracking = 0, maxLines = 3) {
  const words = text.split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (measure(font, next, size, tracking) <= maxW || !cur) cur = next;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/[\s.,;:]+$/, '') + '…';
    return kept;
  }
  return lines;
}

// The mark, at any scale, from the same geometry as brand/logo-mark.svg.
const mark = (x, y, size, opacity = 1) => `
  <g transform="translate(${x},${y}) scale(${size / 100})" opacity="${opacity}">
    <circle cx="50" cy="50" r="38" fill="none" stroke="url(#g)" stroke-width="12" stroke-linecap="round"
            stroke-dasharray="179.1 59.7" transform="rotate(-45 50 50)"/>
    <circle cx="77" cy="23" r="6" fill="${T.orange}"/>
  </g>`;

const defs = `<defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
  <stop offset="0%" stop-color="${T.amber}"/><stop offset="100%" stop-color="${T.orange}"/></linearGradient></defs>`;

function card({ title, sub, kicker }) {
  const W = 1200, H = 630, PAD = 84, TW = 610; // the ring starts near x=740, so text stops well short of it
  const tSize = title.length > 30 ? 64 : 76;
  const tLines = wrap(bold, title, tSize, TW, -tSize * 0.03, 3);
  const sLines = wrap(regular, sub, 30, TW, 0, 3);

  // First baseline sits a fixed distance under the kicker, so a three-line title
  // grows downward instead of into it.
  let y = 150 + tSize * 0.9;
  const tPaths = tLines.map((l, i) => {
    const d = pathFor(bold, l, tSize, PAD, y + i * tSize * 1.08, -tSize * 0.03);
    return `<path d="${d}" fill="${T.ink}"/>`;
  });
  y = y + (tLines.length - 1) * tSize * 1.08 + 64;
  const sPaths = sLines.map((l, i) => `<path d="${pathFor(regular, l, 30, PAD, y + i * 42)}" fill="${T.soft}"/>`);

  const kd = pathFor(bold, kicker.toUpperCase(), 20, PAD, 120, 3.2);
  const wm1 = pathFor(bold, 'hot', 34, PAD + 50, H - 62, -1);
  const wmW = measure(bold, 'hot', 34, -1);
  const wm2 = pathFor(bold, 'loop', 34, PAD + 50 + wmW, H - 62, -1);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${defs}
  <rect width="${W}" height="${H}" fill="${T.bg}"/>
  <!-- a large loop, cropped by the frame, so the card reads as HotLoop at thumbnail size -->
  <g opacity="0.95">${mark(700, -40, 640, 1)}</g>
  <rect x="0" y="0" width="${W}" height="${H}" fill="none"/>
  <path d="${kd}" fill="${T.orange}"/>
  ${tPaths.join('\n  ')}
  ${sPaths.join('\n  ')}
  ${mark(PAD, H - 94, 40)}
  <path d="${wm1}" fill="${T.ink}"/><path d="${wm2}" fill="${T.orange}"/>
</svg>`;
}

// One card for the whole docs site. Starlight gives every page its own title and
// description, and a single, recognizable card is better than fifteen near copies.
const pages = [
  ['docs', 'HotLoop documentation', 'HotLoop Gateway and HotLoop Flow, documented plainly, including what has not been proven yet.', 'Docs'],
];

for (const [slug, title, sub, kicker] of pages) {
  const svg = card({ title, sub, kicker });
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(resolve(pub, 'og', `${slug}.png`));
}
console.log(`og: wrote ${pages.length} cards`);

// ── icons ────────────────────────────────────────────────────────────────────
const svgFile = (n) => readFileSync(resolve(pub, 'brand', n), 'utf8');
const render = (svg, size, bg, pad = 0) => {
  const inner = Math.round(size * (1 - pad * 2));
  return sharp(Buffer.from(svg), { density: 384 })
    .resize(inner, inner)
    .extend({
      top: Math.floor((size - inner) / 2), bottom: Math.ceil((size - inner) / 2),
      left: Math.floor((size - inner) / 2), right: Math.ceil((size - inner) / 2),
      background: bg,
    })
    .png();
};
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };
const FLAT = T.lightBg;

// 32px uses the 16px cut, whose terminal dot survives at that size.
await render(svgFile('logo-mark-16.svg'), 32, CLEAR).toFile(resolve(pub, 'icon-32.png'));
// iOS composites transparency onto black, so the touch icon is opaque.
await render(svgFile('logo-mark.svg'), 180, FLAT, 0.16).toFile(resolve(pub, 'apple-touch-icon.png'));
await render(svgFile('logo-mark.svg'), 192, CLEAR, 0.04).toFile(resolve(pub, 'icon-192.png'));
await render(svgFile('logo-mark.svg'), 512, CLEAR, 0.04).toFile(resolve(pub, 'icon-512.png'));
// Maskable: keep the mark inside the central safe zone, on an opaque ground.
await render(svgFile('logo-mark.svg'), 512, T.bg, 0.24).toFile(resolve(pub, 'icon-512-maskable.png'));

writeFileSync(
  resolve(pub, 'site.webmanifest'),
  JSON.stringify(
    {
      name: 'HotLoop',
      short_name: 'HotLoop',
      description: 'Automation loops for the real world.',
      start_url: '/',
      display: 'browser',
      background_color: T.lightBg,
      theme_color: T.orange,
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    null,
    2,
  ) + '\n',
);
console.log('icons: wrote favicon set and manifest');
