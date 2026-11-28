// Gives every URL in the built sitemap its real <lastmod>: the date of the last git commit that touched the page's
// content file under src/content/docs. Never the build date, so a deploy that edits three pages moves three dates.
//
//   node scripts/sitemap-lastmod.mjs [dist]
//
// A page's source is the file its URL names (/es/install/ is src/content/docs/es/install.md, .mdx or install/index.md,
// .mdx). The sitemap filter already keeps out any language page that has no file of its own, so every URL has one;
// a URL without a source fails the build rather than getting a guess. History has to be whole: a shallow checkout
// fails the build instead of stamping wrong dates (CI uses actions/checkout with fetch-depth: 0).
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = process.argv[2] || 'dist';
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'pipe'] });
try {
  if (git('rev-parse', '--is-shallow-repository').trim() !== 'false') throw new Error('the checkout is shallow');
} catch (e) {
  console.error(`sitemap-lastmod: no full git history (${String(e.stderr || e.message).trim()}). A shallow checkout would stamp wrong dates, so the build stops. In CI use actions/checkout with fetch-depth: 0.`);
  process.exit(1);
}

const dates = {};
let cur = null;
for (const line of git('log', '--relative', '--name-only', '--no-renames', '--format=%x01%aI', '--', 'src/content/docs').split('\n')) {
  if (line.startsWith('\x01')) { cur = new Date(line.slice(1)).toISOString().replace(/\.\d+Z$/, 'Z'); continue; }
  if (line && cur && (!dates[line] || cur > dates[line])) dates[line] = cur;
}

const sitemapPath = join(dist, 'sitemap-0.xml');
let xml = readFileSync(sitemapPath, 'utf8');
const stamps = new Map();
const missing = [];
for (const m of xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>/g)) {
  const path = new URL(m[1]).pathname.replace(/^\/|\/$/g, '');
  const base = path ? `src/content/docs/${path}` : 'src/content/docs/index';
  const hit = [`${base}.md`, `${base}.mdx`, `${base}/index.md`, `${base}/index.mdx`].find((f) => dates[f]);
  hit ? stamps.set(m[1], dates[hit]) : missing.push(m[1]);
}
if (missing.length) { console.error(`sitemap-lastmod: no source file for ${missing.length} URLs, first: ${missing.slice(0, 5).join(' ')}`); process.exit(1); }

xml = xml.replace(/<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>[^<]*<\/lastmod>)?/g, (_m, loc) => `<url><loc>${loc}</loc><lastmod>${stamps.get(loc)}</lastmod>`);
writeFileSync(sitemapPath, xml);
const newest = [...stamps.values()].sort().pop();
const indexPath = join(dist, 'sitemap-index.xml');
if (existsSync(indexPath)) {
  writeFileSync(indexPath, readFileSync(indexPath, 'utf8').replace(/<sitemap>\s*<loc>([^<]*\/sitemap-0\.xml)<\/loc>(?:\s*<lastmod>[^<]*<\/lastmod>)?/g, (_m, loc) => `<sitemap><loc>${loc}</loc><lastmod>${newest}</lastmod>`));
}
if (existsSync(join(dist, 'sitemap.xml'))) copyFileSync(sitemapPath, join(dist, 'sitemap.xml'));

const distinct = new Set(stamps.values());
if (stamps.size > 4 && distinct.size === 1) { console.error(`sitemap-lastmod: every URL got ${[...distinct][0]}, a build date in disguise`); process.exit(1); }
console.log(`sitemap-lastmod: ${stamps.size} URLs, ${distinct.size} distinct dates, newest ${newest}`);
