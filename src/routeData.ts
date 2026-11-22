import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { getCollection } from 'astro:content';

// Which pages have their own translation. A language folder serves every English page, in English with a notice,
// until it is translated; only a page that has its own file counts as a language version.
const FOLDERS = ['es', 'fr', 'it', 'de', 'nb', 'bg', 'el', 'ko', 'ja', 'vi', 'hi', 'zh-hans', 'ar'];
const LANG_OF: Record<string, string> = { 'zh-hans': 'zh-Hans' };
const strip = (id: string) => id.replace(/(^|\/)index$/, '');
const translated = new Map<string, Set<string>>(); // English page id -> the folders that translate it
for (const e of await getCollection('docs')) {
  const id = strip(e.id);
  const m = /^([a-z]{2}(?:-[a-z]+)?)(?:\/(.*))?$/.exec(id);
  if (!m || !FOLDERS.includes(m[1])) continue;
  const base = m[2] ?? '';
  (translated.get(base) ?? translated.set(base, new Set()).get(base)!).add(m[1]);
}

// A fallback page (English under a language folder) is noindex, out of the search index of that language, and no
// hreflang list mentions it; a translated page lists itself, English, x-default and every other translation.
function languages(route: Parameters<Parameters<typeof defineRouteMiddleware>[0]>[0]['locals']['starlightRoute']) {
  const folder = route.locale;
  const base = folder ? strip(route.id).slice(folder.length + 1) : strip(route.id);
  const have = translated.get(base) ?? new Set<string>();
  if (route.isFallback) {
    route.head.push({ tag: 'meta', attrs: { name: 'robots', content: 'noindex, follow' } });
    route.entry = { ...route.entry, data: { ...route.entry.data, pagefind: false } };
  }
  // A "not found" page is never indexed, so it has no language versions to list.
  const keep = (tag: string) => {
    if (base === '404') return false;
    if (tag === 'x-default' || tag === 'en') return have.size > 0;
    const f = FOLDERS.find((x) => (LANG_OF[x] ?? x) === tag);
    return Boolean(f && have.has(f));
  };
  route.head = route.head.filter((h) => !(h.tag === 'link' && h.attrs?.rel === 'alternate' && typeof h.attrs.hreflang === 'string' && !keep(h.attrs.hreflang)));
}

// Starlight's Previous and Next walk the flattened sidebar, so the last HotLoop release page
// pointed at the first Flow one and Flow ran on into Cascade. Each product's release notes are
// their own line (HotLoop core, Flow, Cascade), so the pager stays inside it, newest first, the
// same order the sidebar shows. The newest and oldest page of a line don't link out to another
// product: the newest of HotLoop core keeps its link back to All releases, and the rest have none.
const line = (id: string) => /^releases\/(hotloop|flow|cascade|codesys|transmitter)-/.exec(id)?.[1];

// Starlight writes og:title, og:description, twitter:card and twitter:image for every page but not
// twitter:title or twitter:description, so a share card fell back to the Open Graph tags. Copy the two
// from the Open Graph tags Starlight already built from the page's own title and description, so the
// text is the same on every page, and add them only when the page does not carry its own.
const meta = (route: { head: { tag: string; attrs?: Record<string, string | number | boolean | undefined> }[] }, key: string, value: string) =>
  route.head.find((h) => h.tag === 'meta' && h.attrs?.[key] === value);

function twitterCard(route: Parameters<Parameters<typeof defineRouteMiddleware>[0]>[0]['locals']['starlightRoute']) {
  for (const name of ['title', 'description']) {
    const og = meta(route, 'property', `og:${name}`);
    const content = og?.attrs?.content;
    if (typeof content !== 'string' || meta(route, 'name', `twitter:${name}`)) continue;
    route.head.push({ tag: 'meta', attrs: { name: `twitter:${name}`, content } });
  }
}

export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute;
  twitterCard(route);
  languages(route);
  const own = line(route.id);
  if (!own) return;
  const { pagination } = route;
  const stay = (link: typeof pagination.prev) => {
    if (!link) return link;
    const path = new URL(link.href, 'https://docs.hotloop.io').pathname.replace(/^\/|\/$/g, '');
    if (path === 'releases') return link;
    return line(path) === own ? link : undefined;
  };
  // Only the newest end of a line may link to All releases; the oldest end links nowhere.
  const prev = stay(pagination.prev);
  const next = stay(pagination.next);
  route.pagination = { prev, next: next && next.href.replace(/\/$/, '').endsWith('/releases') ? undefined : next };
});
