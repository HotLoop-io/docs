// Images a synced README references. The sync copies each one out of the product repo at the
// ref it is syncing, into public/synced/<repo>/<path in that repo>, and points the page at
// that address, so a page shows the same screenshot the README does. External http(s) and
// data: images stay as they are. Pure helpers live here so the tests can reach them.
import { posix } from 'node:path';

export const IMAGE_ROOT = 'synced';
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif)$/i;

// Where an image reference goes. `target` is the text inside ![alt](...), `baseDir` the
// directory of the source file that holds it. Returns null for an external image.
export function imageTarget(repo, baseDir, target) {
  if (/^(https?:)?\/\//i.test(target) || /^data:/i.test(target)) return null;
  const [pathPart] = target.split(/[?#]/);
  let decoded = pathPart;
  try { decoded = decodeURIComponent(pathPart); } catch {}
  // A leading slash means the repo root in a README.
  const resolved = decoded.startsWith('/') ? posix.normalize(decoded.slice(1)) : posix.normalize(posix.join(baseDir, decoded));
  if (resolved.startsWith('..') || resolved === '.' || resolved === '') throw new Error(`image path leaves the repo: ${target}`);
  if (!IMAGE_EXT.test(resolved)) throw new Error(`image is not a known image type: ${target}`);
  const publicPath = `${IMAGE_ROOT}/${repo}/${resolved}`;
  return { source: resolved, publicPath, url: `/${publicPath.split('/').map(encodeURIComponent).join('/')}` };
}

// ![alt](target "title"), the same shape the link rewriter reads.
export const IMAGE_RE = /!\[((?:[^\[\]]|\[[^\]]*\])*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
