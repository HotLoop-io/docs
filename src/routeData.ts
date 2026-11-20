import { defineRouteMiddleware } from '@astrojs/starlight/route-data';

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
