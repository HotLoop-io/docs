// Audits the BUILT site (dist/) for the things search engines actually check, and
// fails the build if any of them regress. Run after `astro build`.
//
//   node scripts/seo-audit.mjs [dist]
//
// It exists for the same reason the content schemas do: a rule that only lives in
// someone's head is broken within a month. Every check below is a thing that has
// gone wrong on a real site.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep, posix } from 'node:path';
import { parse } from 'node-html-parser';

const dist = process.argv[2] || 'dist';
const SITE = process.env.SITE_URL || null;

const TITLE_MAX = 60;       // Google truncates around 600px, roughly 60 characters
const TITLE_MIN = 15;
const DESC_MIN = 70;
const DESC_MAX = 160;       // truncated around 155 to 160

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}

const files = walk(dist);
const htmlFiles = files.filter((f) => f.endsWith('.html'));
const routeOf = (f) => {
  let r = '/' + relative(dist, f).split(sep).join('/');
  return r.replace(/index\.html$/, '');
};
const exists = new Set(files.map((f) => '/' + relative(dist, f).split(sep).join('/')));

const errors = [];
const warnings = [];
const err = (route, msg) => errors.push(`${route}  ${msg}`);
const warn = (route, msg) => warnings.push(`${route}  ${msg}`);

const titles = new Map();
const descs = new Map();
const idsByRoute = new Map();
const linksByRoute = new Map();
let pages = 0;

for (const f of htmlFiles) {
  const route = routeOf(f);
  const src = readFileSync(f, 'utf8');
  const root = parse(src);

  // Redirect stubs and internal test files are not pages a crawler should index.
  if (/http-equiv=["']refresh["']/i.test(src) || route.startsWith('/__')) continue;

  const is404 = route.endsWith('/404.html') || route === '/404/';
  pages++;

  // ids on the page, for fragment checks
  idsByRoute.set(route, new Set(root.querySelectorAll('[id]').map((n) => n.getAttribute('id'))));
  linksByRoute.set(
    route,
    root.querySelectorAll('a[href]').map((a) => a.getAttribute('href')).filter(Boolean),
  );

  // <html lang>
  const lang = root.querySelector('html')?.getAttribute('lang');
  if (!lang) err(route, 'missing <html lang>');

  // title
  const title = root.querySelector('title')?.text.trim();
  if (!title) err(route, 'missing <title>');
  else {
    if (title.length > TITLE_MAX) err(route, `title is ${title.length} chars, over ${TITLE_MAX}: "${title}"`);
    if (title.length < TITLE_MIN) warn(route, `title is only ${title.length} chars: "${title}"`);
    if (!is404) {
      if (titles.has(title)) err(route, `duplicate title with ${titles.get(title)}: "${title}"`);
      titles.set(title, route);
    }
  }

  // description
  const desc = root.querySelector('meta[name="description"]')?.getAttribute('content')?.trim();
  if (!desc) { if (!is404) err(route, 'missing meta description'); }
  else {
    if (desc.length > DESC_MAX) err(route, `description is ${desc.length} chars, over ${DESC_MAX}`);
    if (desc.length < DESC_MIN) err(route, `description is only ${desc.length} chars, under ${DESC_MIN}`);
    if (descs.has(desc)) err(route, `duplicate description with ${descs.get(desc)}`);
    descs.set(desc, route);
  }

  // exactly one h1
  const h1 = root.querySelectorAll('h1').filter((h) => !h.closest('[hidden]'));
  if (!is404 && h1.length !== 1) err(route, `has ${h1.length} <h1>, want exactly 1`);

  // headings never skip a level going down (h2 straight to h4), which is what
  // Lighthouse's heading-order audit fails and what a screen reader's outline shows
  let prevLevel = 0;
  for (const h of root.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
    if (h.closest('[hidden]')) continue;
    const level = Number(h.tagName[1]);
    if (prevLevel && level > prevLevel + 1) {
      err(route, `heading jumps from h${prevLevel} to h${level}: "${h.text.trim().slice(0, 50)}"`);
    }
    prevLevel = level;
  }

  // a column header with no text leaves every cell under it unlabeled
  for (const th of root.querySelectorAll('th')) {
    if (!th.text.trim() && !th.querySelector('img, svg')) err(route, 'table has an empty <th>');
  }

  // canonical: present, absolute, and it points at this very page
  const canon = root.querySelector('link[rel="canonical"]')?.getAttribute('href');
  if (!canon) { if (!is404) err(route, 'missing canonical'); }
  else {
    if (!/^https:\/\//.test(canon)) err(route, `canonical is not absolute https: ${canon}`);
    let path;
    try { path = new URL(canon).pathname; } catch { path = canon; }
    if (!is404 && path !== route) err(route, `canonical points elsewhere: ${canon}`);
    if (SITE && !canon.startsWith(SITE)) err(route, `canonical is not on ${SITE}: ${canon}`);
  }

  // social
  for (const p of ['og:title', 'og:description', 'og:image', 'og:url']) {
    if (!root.querySelector(`meta[property="${p}"]`)) { if (!is404) err(route, `missing ${p}`); }
  }
  const og = root.querySelector('meta[property="og:image"]')?.getAttribute('content');
  if (og && !/^https:\/\//.test(og)) err(route, `og:image is not absolute: ${og}`);
  if (og) {
    try {
      const ogPath = new URL(og).pathname;
      if (!exists.has(ogPath)) err(route, `og:image does not exist in the build: ${ogPath}`);
    } catch {}
  }
  if (!root.querySelector('meta[name="twitter:card"]')) { if (!is404) err(route, 'missing twitter:card'); }

  // structured data must at least be valid JSON
  for (const s of root.querySelectorAll('script[type="application/ld+json"]')) {
    try { JSON.parse(s.text); } catch (e) { err(route, `invalid JSON-LD: ${e.message}`); }
  }

  // images need alt text (empty is fine, it means decorative; absent is not)
  for (const img of root.querySelectorAll('img')) {
    if (img.getAttribute('alt') === undefined) err(route, `<img> without alt: ${img.getAttribute('src')}`);
  }

  // the 404 page must not be indexed
  if (is404 && !/noindex/i.test(root.querySelector('meta[name="robots"]')?.getAttribute('content') || '')) {
    err(route, '404 page is missing <meta name="robots" content="noindex">');
  }

  // it should never be noindex by accident on a real page
  if (!is404 && /noindex/i.test(root.querySelector('meta[name="robots"]')?.getAttribute('content') || '')) {
    err(route, 'a real page is marked noindex');
  }
}

// internal links: every one has to land on a real file, and every #fragment on a real id
for (const [route, links] of linksByRoute) {
  for (const raw of new Set(links)) {
    if (/^(https?:|mailto:|tel:|javascript:)/i.test(raw) || raw.startsWith('//')) continue;
    const [pathPart, frag] = raw.split('#');
    const abs = pathPart === '' ? route : posix.normalize(pathPart.startsWith('/') ? pathPart : posix.join(posix.dirname(route), pathPart));
    const candidates = [abs, abs.endsWith('/') ? abs + 'index.html' : abs + '/index.html', abs];
    const hit = candidates.find((c) => exists.has(c));
    if (!hit) { err(route, `broken internal link: ${raw}`); continue; }
    if (frag && hit.endsWith('.html')) {
      const pageRoute = hit.replace(/index\.html$/, '');
      const ids = idsByRoute.get(pageRoute);
      if (ids && !ids.has(frag)) err(route, `link to missing anchor: ${raw}`);
    }
  }
}

// sitemap + robots
const sm = files.find((f) => f.endsWith('sitemap-index.xml'));
if (!sm) err('/', 'no sitemap-index.xml was generated');
if (!exists.has('/robots.txt')) err('/', 'no robots.txt');
else if (!/Sitemap:\s*https:\/\//i.test(readFileSync(join(dist, 'robots.txt'), 'utf8'))) err('/robots.txt', 'does not point at the sitemap');

console.log(`seo-audit: ${pages} pages checked`);
if (warnings.length) { console.log(`\n${warnings.length} warning(s):`); warnings.forEach((w) => console.log('  warn  ' + w)); }
if (errors.length) {
  console.log(`\n${errors.length} problem(s):`);
  errors.forEach((e) => console.log('  FAIL  ' + e));
  process.exit(1);
}
console.log('seo-audit: clean');
