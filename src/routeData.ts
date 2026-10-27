import { defineRouteMiddleware } from '@astrojs/starlight/route-data';

// Starlight's Previous and Next walk the flattened sidebar, so the last HotLoop release page
// pointed at the first Flow one and Flow ran on into Cascade. Each product's release notes are
// their own line (HotLoop core, Flow, Cascade), so the pager stays inside it, newest first, the
// same order the sidebar shows. The newest and oldest page of a line don't link out to another
// product: the newest of HotLoop core keeps its link back to All releases, and the rest have none.
const line = (id: string) => /^releases\/(hotloop|flow|cascade)-/.exec(id)?.[1];

export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute;
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
