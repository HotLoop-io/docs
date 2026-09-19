// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

const site = 'https://docs.hotloop.io';

export default defineConfig({
  site,
  trailingSlash: 'always',
  // The old hand-written pages. Anything that linked to them lands somewhere real.
  redirects: {
    '/getting-started.html': '/',
    '/licensing.html': '/licensing/',
  },
  integrations: [
    starlight({
      title: 'HotLoop Docs',
      description: 'Documentation for HotLoop Gateway and HotLoop Flow, including what has not been proven yet.',
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
        {
          label: 'HotLoop Gateway',
          items: [
            { slug: 'gateway/overview' },
            { slug: 'gateway/write-gate' },
            { slug: 'gateway/protocols' },
            { slug: 'gateway/automations' },
            { slug: 'gateway/mcp' },
          ],
        },
        {
          label: 'HotLoop Flow',
          items: [
            { slug: 'flow/overview' },
            { slug: 'flow/security' },
            { slug: 'flow/back-pressure' },
            { slug: 'flow/compatibility' },
            { slug: 'flow/migrating-from-node-red' },
          ],
        },
        { slug: 'licensing' },
      ],
    }),
  ],
});
