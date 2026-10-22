// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

import { existsSync, readFileSync } from 'node:fs';

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
  },
  integrations: [
    starlight({
      title: 'HotLoop Docs',
      components: {
        Header: './src/components/Header.astro',
        SiteTitle: './src/components/SiteTitle.astro',
        ThemeSelect: './src/components/ThemeSelect.astro',
        PageFrame: './src/components/PageFrame.astro',
      },
      description: 'Documentation for every HotLoop product, including what has not been proven yet.',
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
      sidebar: [
        { slug: 'products', label: 'The lineup' },
        { label: 'Install', collapsed: true, items: [
          { slug: 'install', label: 'Install HotLoop' },
          ...pages('shared').filter((p) => p.slug.startsWith('install/')).map(page),
        ] },
        {
          label: 'HotLoop IoT',
          collapsed: true,
          items: iotItems(),
        },
        {
          label: 'HotLoop Edge',
          collapsed: true,
          items: [...edgeItems(), included('HotLoop IoT', iotItems())],
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
          ],
        },
        {
          label: 'HotLoop Flow',
          collapsed: true,
          items: grouped('flow').map((g, i) => (i === 0 ? { ...g, items: [g.items[0], { slug: 'flow/install', label: 'Install' }, ...g.items.slice(1)] } : g)),
        },
        {
          label: 'HotLoop Cascade',
          collapsed: true,
          items: grouped('cascade'),
        },
        {
          label: 'Release notes',
          collapsed: true,
          items: [
            { slug: 'releases', label: 'All releases' },
            { label: 'HotLoop', collapsed: true, items: hlRelease.sort(relSort).map(page) },
            { label: 'HotLoop Flow', collapsed: true, items: flowRelease.sort(relSort).map(page) },
          ],
        },
        { slug: 'roadmap', label: 'HotLoop roadmap' },
        { slug: 'business', label: 'Using HotLoop in a business' },
        ...(has('license') ? [{ slug: 'license', label: 'License' }] : []),
        ...(has('terms') ? [{ slug: 'terms', label: 'Terms' }] : []),
      ],
    }),
  ],
});
