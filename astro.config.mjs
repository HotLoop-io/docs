// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';

import { existsSync, readFileSync } from 'node:fs';

// English plus the thirteen languages the HotLoop products ship in. English stays at the root, so every
// existing URL is where it was; the others sit under their own folder. Starlight serves the English page
// under a language folder, with a notice, until that page is translated. Its own i18n guide:
// https://starlight.astro.build/guides/i18n/  (locales, defaultLocale 'root', sidebar translations).
// The same list lives in src/i18n/locales.ts; scripts/i18n-check.mjs fails the build if they disagree.
const LOCALES = {
  root: { label: 'English', lang: 'en' },
  es: { label: 'Español', lang: 'es' },
  fr: { label: 'Français', lang: 'fr' },
  it: { label: 'Italiano', lang: 'it' },
  de: { label: 'Deutsch', lang: 'de' },
  nb: { label: 'Norsk bokmål', lang: 'nb' },
  bg: { label: 'Български', lang: 'bg' },
  el: { label: 'Ελληνικά', lang: 'el' },
  ko: { label: '한국어', lang: 'ko' },
  ja: { label: '日本語', lang: 'ja' },
  vi: { label: 'Tiếng Việt', lang: 'vi' },
  hi: { label: 'हिन्दी', lang: 'hi' },
  'zh-hans': { label: '简体中文', lang: 'zh-Hans' },
  ar: { label: 'العربية', lang: 'ar', dir: 'rtl' },
};
// Sidebar words come from the same catalogs as the header and footer. A label whose English text is in
// SIDEBAR gets a translation in every language; product names and page titles stay as they are.
const CAT = Object.fromEntries(
  ['en', 'es', 'fr', 'it', 'de', 'nb', 'bg', 'el', 'ko', 'ja', 'vi', 'hi', 'zh-Hans', 'ar'].map((c) => [c, JSON.parse(readFileSync(new URL(`./src/i18n/${c}.json`, import.meta.url), 'utf8'))]),
);
const FOLDER = { 'zh-Hans': 'zh-hans' };
const SIDEBAR = {
  'The lineup': 's.lineup', Install: 's.install', 'Install HotLoop': 's.installHotloop', Overview: 's.overview',
  'The write gate': 's.writeGate', Upgrading: 's.upgrading', 'Release notes': 's.releaseNotes', 'All releases': 's.allReleases',
  'HotLoop roadmap': 's.roadmap', 'Using HotLoop in a business': 's.business', License: 's.license', Terms: 's.terms', Roadmap: 'pk.roadmap',
};
const fill = (str, vars) => str.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
const translate = (label) => {
  const inc = /^Included from (.+)$/.exec(label);
  const key = inc ? 's.included' : SIDEBAR[label];
  if (!key) return undefined;
  const vars = inc ? { product: inc[1] } : {};
  return Object.fromEntries(Object.keys(CAT).filter((c) => c !== 'en').map((c) => [FOLDER[c] || c, fill(CAT[c][key], vars)]));
};
// A page with no translation is served in English under the language folder, with a notice, and is marked
// noindex. It stays out of the sitemap, and out of every hreflang list (see src/routeData.ts), so search
// engines only ever hear about a language version that exists.
const hasOwnPage = (folder, rest) => {
  const base = `./src/content/docs/${folder}${rest ? '/' + rest : ''}`;
  return ['.md', '.mdx', '/index.md', '/index.mdx'].some((e) => existsSync(new URL(base + e, import.meta.url)));
};
const FOLDERS = Object.keys(LOCALES).filter((k) => k !== 'root');
// Legal boilerplate answers 200 but is not a page we want found, so it stays out of the sitemap too.
const NOT_IN_SITEMAP = /^https:\/\/[^/]+\/(?:[a-z-]+\/)?(?:license|terms)\/?$/;
const sitemapFilter = (page) => {
  if (NOT_IN_SITEMAP.test(page)) return false;
  const m = /^https:\/\/[^/]+\/([^/]+)\/(.*?)\/?$/.exec(page);
  if (!m || !FOLDERS.includes(m[1])) return true;
  return hasOwnPage(m[1], m[2]);
};

// First landing on an English page: if the browser's preferred languages name one of ours, go there. Starlight
// is static, so Astro.preferredLocale (Accept-Language, on-demand rendering only) is not available and the
// decision is made in the browser from navigator.languages. It never runs on a language page, never beats a
// choice made in the language menu (saved in localStorage as "hl-lang", English included), never runs for a
// crawler, and only goes to a page that exists: the target is read from the hreflang tags the page carries,
// which src/routeData.ts writes only for translated pages.
const DETECT = `(function(){
  var KEY='hl-lang';
  function set(v){try{localStorage.setItem(KEY,v)}catch(e){}}
  document.addEventListener('change',function(e){
    var s=e.target&&e.target.closest?e.target.closest('starlight-lang-select select'):null;
    if(!s)return;
    var m=/^\\/(es|fr|it|de|nb|bg|el|ko|ja|vi|hi|zh-hans|ar)(\\/|$)/.exec(String(s.value).replace(/^https?:\\/\\/[^/]+/,''));
    set(m?(m[1]==='zh-hans'?'zh-Hans':m[1]):'en');
  },true);
  if(document.documentElement.lang!=='en')return;
  try{
    if(/bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora|pinterest|lighthouse/i.test(navigator.userAgent||''))return;
    function ours(tag){tag=String(tag||'').toLowerCase();if(!tag)return null;
      if(tag==='zh'||tag.indexOf('zh-hans')===0||tag==='zh-cn'||tag==='zh-sg')return'zh-Hans';
      if(tag.indexOf('zh')===0)return null;
      var b=tag.split('-')[0];if(b==='no'||b==='nn'||b==='nb')return'nb';
      return['en','es','fr','it','de','bg','el','ko','ja','vi','hi','ar'].indexOf(b)>=0?b:null}
    var want=null,saved=null;try{saved=localStorage.getItem(KEY)}catch(e){}
    if(saved)want=saved;else{var l=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language];for(var i=0;i<l.length&&!want;i++)want=ours(l[i])}
    if(!want||want==='en')return;
    var a=document.querySelector('link[rel="alternate"][hreflang="'+want+'"]');if(!a)return;
    var to=new URL(a.href);if(to.pathname===location.pathname)return;
    location.replace(to.pathname+location.search+location.hash);
  }catch(e){}
})();`;

const localize = (items) => items.map((it) => {
  const out = { ...it };
  const tr = typeof it.label === 'string' ? translate(it.label) : undefined;
  if (tr) out.translations = tr;
  if (Array.isArray(it.items)) out.items = localize(it.items);
  return out;
});

const site = 'https://docs.hotloop.io';

// The sync (scripts/sync-docs.mjs) writes which pages exist and whether each is in the
// latest release. The sidebar is built from it, so a page can't be forgotten.
const sync = JSON.parse(readFileSync(new URL('./src/data/sync.json', import.meta.url), 'utf8'));
const has = (f) => existsSync(new URL(`./src/content/docs/${f}.md`, import.meta.url));

// Until the canonical LICENSE.md lands in HotLoop-io/HotLoop-io and the sync renders it, the
// old licensing address goes to the license page on hotloop.io.
const LICENSE_TARGET = has('license') ? '/license/' : 'https://hotloop.io/license/';

const NEXT = { text: 'Next release', variant: 'caution' };
const page = (p) => ({ slug: p.slug, label: p.label || p.title, ...(p.status === 'next' ? { badge: NEXT } : {}) });
const pages = (product) => sync.pages.filter((p) => p.product === product);
const grouped = (product) => {
  const groups = [];
  for (const p of pages(product)) {
    let g = groups.find((x) => x.label === p.group);
    if (!g) groups.push((g = { label: p.group, collapsed: true, items: [] }));
    g.items.push(page(p));
  }
  return groups;
};
// A bigger product carries everything the smaller one has, so its section links to those pages.
const included = (label, items) => ({ label: `Included from ${label}`, collapsed: true, items });
const iotItems = () => [{ slug: 'iot/overview', label: 'Overview' }, { slug: 'iot/install', label: 'Install' }, { slug: 'gateway/write-gate', label: 'The write gate' }, ...grouped('iot')];
const edgeItems = () => [{ slug: 'edge/overview', label: 'Overview' }, { slug: 'edge/install', label: 'Install' }, ...pages('edge').map(page)];
const flowRelease = sync.pages.filter((p) => p.release && p.slug.startsWith('releases/flow-'));
const hlRelease = sync.pages.filter((p) => p.release && p.slug.startsWith('releases/hotloop-'));
const cascadeRelease = sync.pages.filter((p) => p.release && p.slug.startsWith('releases/cascade-'));
const relSort = (a, b) => b.slug.localeCompare(a.slug, undefined, { numeric: true });

export default defineConfig({
  site,
  trailingSlash: 'always',
  // The old hand-written pages. Anything that linked to them lands somewhere real.
  redirects: {
    '/getting-started.html': '/',
    '/licensing.html': LICENSE_TARGET,
    // The Gateway's feature pages moved into HotLoop IoT, which is where the code for them lives.
    '/gateway/automations/': '/iot/automations/',
    '/gateway/blueprints/': '/iot/blueprints/',
    '/gateway/helpers/': '/iot/helpers/',
    '/gateway/logbook/': '/iot/logbook/',
    '/gateway/mcp/': '/iot/mcp/',
    '/gateway/protocols/': '/iot/protocols/',
    '/gateway/recipes/': '/iot/recipes/',
    '/gateway/scripts/': '/iot/scripts/',
    '/gateway/unifi/': '/iot/unifi/',
    // The license text is its own page, rendered from the canonical file in HotLoop-io/HotLoop-io.
    '/licensing/': LICENSE_TARGET,
    // The 4.18.3 notes were a next-release page that 4.18.10 superseded, so the old address lands on the release that shipped.
    '/releases/hotloop-4-18-3/': '/releases/hotloop-4-18-10/',
  },
  integrations: [
    // Starlight adds its own sitemap unless one is here. This one leaves out the English-under-a-language-folder
    // pages and carries the hreflang alternates for the rest.
    sitemap({
      filter: sitemapFilter,
      i18n: { defaultLocale: 'root', locales: Object.fromEntries(Object.entries(LOCALES).map(([k, v]) => [k, v.lang])) },
    }),
    starlight({
      title: 'HotLoop Docs',
      defaultLocale: 'root',
      locales: LOCALES,
      routeMiddleware: './src/routeData.ts',
      components: {
        Header: './src/components/Header.astro',
        SiteTitle: './src/components/SiteTitle.astro',
        ThemeSelect: './src/components/ThemeSelect.astro',
        PageFrame: './src/components/PageFrame.astro',
      },
      description: 'Documentation for every HotLoop product: how to install, set up and run each one, and what it has been run against.',
      logo: { src: './src/assets/logo-mark.svg', alt: 'HotLoop' },
      favicon: '/favicon.svg',
      social: [
        { icon: 'github', label: 'HotLoop on GitHub', href: 'https://github.com/HotLoop-io' },
      ],
      editLink: { baseUrl: 'https://github.com/HotLoop-io/docs/edit/main/' },
      // Fonts are self-hosted through @fontsource, never a CDN. tokens.css is a
      // vendored copy of the canonical file in HotLoop-io/HotLoop-io/brand, and
      // theme.css maps those tokens onto Starlight's own variables.
      customCss: [
        '@fontsource-variable/inter',
        '@fontsource/jetbrains-mono/latin-400.css',
        '@fontsource/jetbrains-mono/latin-500.css',
        '@fontsource/jetbrains-mono/latin-700.css',
        './src/styles/tokens.css',
        './src/styles/theme.css',
      ],
      head: [
        // Microsoft Clarity, HotLoop project, behind the cookie banner. Starlight puts this in every page head,
        // in every language. The loader is src/analytics-loader.js.
        { tag: 'script', content: readFileSync(new URL('./src/analytics-loader.js', import.meta.url), 'utf8') },
        { tag: 'script', content: DETECT },
        // Structured data. It says what this site is and who publishes it, and
        // nothing else. It ties the docs to the same organization as hotloop.io.
        {
          tag: 'script',
          attrs: { type: 'application/ld+json' },
          content: JSON.stringify([
            {
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              '@id': `${site}/#website`,
              name: 'HotLoop Docs',
              url: `${site}/`,
              inLanguage: 'en',
              publisher: { '@type': 'Organization', '@id': 'https://hotloop.io/#organization', name: 'HotLoop', url: 'https://hotloop.io/' },
            },
          ]).replace(/</g, '\\u003c'),
        },
        { tag: 'meta', attrs: { property: 'og:image', content: `${site}/og/docs.png` } },
        { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
        { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
        { tag: 'meta', attrs: { name: 'twitter:image', content: `${site}/og/docs.png` } },
        { tag: 'link', attrs: { rel: 'icon', href: '/icon-32.png', sizes: '32x32', type: 'image/png' } },
        { tag: 'link', attrs: { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' } },
        { tag: 'link', attrs: { rel: 'manifest', href: '/site.webmanifest' } },
        { tag: 'meta', attrs: { name: 'theme-color', content: '#FBFAF8', media: '(prefers-color-scheme: light)' } },
        { tag: 'meta', attrs: { name: 'theme-color', content: '#14120F', media: '(prefers-color-scheme: dark)' } },
      ],
      sidebar: localize([
        { slug: 'products', label: 'The lineup' },
        { label: 'Install', collapsed: true, items: [
          { slug: 'install', label: 'Install HotLoop' },
          ...pages('shared').filter((p) => p.slug.startsWith('install/')).map(page),
        ] },
        {
          label: 'HotLoop IoT',
          collapsed: true,
          items: [...iotItems(), { slug: 'releases/core', label: 'Release notes (HotLoop core)' }, { slug: 'iot/embernet', label: 'On the EmberNet docs' }],
        },
        {
          label: 'HotLoop Edge',
          collapsed: true,
          items: [...edgeItems(), { slug: 'releases/core', label: 'Release notes (HotLoop core)' }, { slug: 'edge/embernet', label: 'On the EmberNet docs' }, included('HotLoop IoT', iotItems())],
        },
        {
          label: 'HotLoop Gateway',
          collapsed: true,
          items: [
            { slug: 'gateway/overview', label: 'Overview' },
            { slug: 'gateway/install', label: 'Install' },
            { slug: 'gateway/upgrading', label: 'Upgrading' },
            { slug: 'gateway/write-gate', label: 'The write gate' },
            ...pages('gateway').map(page),
            { slug: 'releases/core', label: 'Release notes (HotLoop core)' },
            { slug: 'gateway/embernet', label: 'On the EmberNet docs' },
            included('HotLoop Edge', [...edgeItems(), included('HotLoop IoT', iotItems())]),
          ],
        },
        {
          label: 'HotLoop Edge Relay',
          collapsed: true,
          items: [
            { slug: 'edge-relay/overview', label: 'Overview' },
            { slug: 'edge-relay/install', label: 'Install' },
            ...pages('edge-relay').map(page),
            { slug: 'releases/core', label: 'Release notes (HotLoop core)' },
            { slug: 'edge-relay/embernet', label: 'On the EmberNet docs' },
          ],
        },
        {
          label: 'HotLoop Flow',
          collapsed: true,
          items: [...grouped('flow').map((g, i) => (i === 0 ? { ...g, items: [g.items[0], { slug: 'flow/install', label: 'Install' }, ...g.items.slice(1)] } : g)), { slug: 'flow/embernet', label: 'On the EmberNet docs' }],
        },
        {
          label: 'HotLoop Cascade',
          collapsed: true,
          items: [...grouped('cascade'), { slug: 'cascade/embernet', label: 'On the EmberNet docs' }],
        },
        {
          label: 'HotLoop for CODESYS',
          collapsed: true,
          items: [
            { slug: 'codesys/overview', label: 'Overview' },
            { slug: 'codesys/install', label: 'Install' },
            { slug: 'codesys/profile', label: 'The profile' },
            { slug: 'codesys/where-it-stands', label: 'Where it stands' },
            { slug: 'codesys/roadmap', label: 'Roadmap' },
            { slug: 'codesys/embernet', label: 'On the EmberNet docs' },
            { slug: 'releases/codesys-0-3-8', label: 'Release notes 0.3.8' },
            { slug: 'releases/codesys-0-3-7', label: 'Release notes 0.3.7' },
            { slug: 'releases/codesys-0-3-6', label: 'Release notes 0.3.6' },
            { slug: 'releases/codesys-0-3-5', label: 'Release notes 0.3.5' },
            { slug: 'releases/codesys-0-3-4', label: 'Release notes 0.3.4' },
            { slug: 'releases/codesys-0-3-3', label: 'Release notes 0.3.3' },
            { slug: 'releases/codesys-0-3-2', label: 'Release notes 0.3.2' },
            { slug: 'releases/codesys-0-3-1', label: 'Release notes 0.3.1' },
            { slug: 'releases/codesys-0-3-0', label: 'Release notes 0.3.0' },
          ],
        },
        {
          label: 'HotLoop Transmitter',
          collapsed: true,
          items: [
            { slug: 'transmitter/overview', label: 'Overview' },
            { slug: 'transmitter/install', label: 'Install' },
            { slug: 'transmitter/api', label: 'API' },
            { slug: 'transmitter/wire-format', label: 'What goes on the wire' },
            { slug: 'transmitter/timing', label: 'What it adds to the task' },
            { slug: 'transmitter/proof', label: 'What was run' },
            { slug: 'transmitter/roadmap', label: 'Roadmap' },
            { slug: 'transmitter/embernet', label: 'On the EmberNet docs' },
            { slug: 'releases/transmitter-1-1-0', label: 'Release notes 1.1.0' },
            { slug: 'releases/transmitter-1-0-0', label: 'Release notes 1.0.0' },
          ],
        },
        {
          label: 'Release notes',
          collapsed: true,
          items: [
            { slug: 'releases', label: 'All releases' },
            { label: 'HotLoop core', collapsed: true, items: [{ slug: 'releases/core', label: 'All core releases' }, ...hlRelease.sort(relSort).map(page)] },
            { label: 'HotLoop Flow', collapsed: true, items: flowRelease.sort(relSort).map(page) },
            { label: 'HotLoop Cascade', collapsed: true, items: cascadeRelease.sort(relSort).map(page) },
            { label: 'HotLoop for CODESYS', collapsed: true, items: [{ slug: 'releases/codesys-0-3-8', label: '0.3.8' }, { slug: 'releases/codesys-0-3-7', label: '0.3.7' }, { slug: 'releases/codesys-0-3-6', label: '0.3.6' }, { slug: 'releases/codesys-0-3-5', label: '0.3.5' }, { slug: 'releases/codesys-0-3-4', label: '0.3.4' }, { slug: 'releases/codesys-0-3-3', label: '0.3.3' }, { slug: 'releases/codesys-0-3-2', label: '0.3.2' }, { slug: 'releases/codesys-0-3-1', label: '0.3.1' }, { slug: 'releases/codesys-0-3-0', label: '0.3.0' }] },
            { label: 'HotLoop Transmitter', collapsed: true, items: [{ slug: 'releases/transmitter-1-1-0', label: '1.1.0' }, { slug: 'releases/transmitter-1-0-0', label: '1.0.0' }] },
          ],
        },
        { slug: 'roadmap', label: 'HotLoop roadmap' },
        { slug: 'business', label: 'Using HotLoop in a business' },
        ...(has('license') ? [{ slug: 'license', label: 'License' }] : []),
        ...(has('terms') ? [{ slug: 'terms', label: 'Terms' }] : []),
      ]),
    }),
  ],
});
