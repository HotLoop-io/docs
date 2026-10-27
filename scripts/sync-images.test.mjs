import test from 'node:test';
import assert from 'node:assert/strict';
import { imageTarget, IMAGE_RE } from './sync-images.mjs';

test('a relative image lands under synced/<repo>/<path>', () => {
  const t = imageTarget('cascade', '.', 'docs/screenshots/editor.png');
  assert.equal(t.source, 'docs/screenshots/editor.png');
  assert.equal(t.publicPath, 'synced/cascade/docs/screenshots/editor.png');
  assert.equal(t.url, '/synced/cascade/docs/screenshots/editor.png');
});

test('a path is resolved from the source file directory', () => {
  assert.equal(imageTarget('hotloop', 'docs/releases', '../img/a.svg').source, 'docs/img/a.svg');
  assert.equal(imageTarget('flow', 'docs', './x/y.PNG').source, 'docs/x/y.PNG');
  assert.equal(imageTarget('flow', 'docs', '/assets/z.webp').source, 'assets/z.webp');
});

test('external and data images are left alone', () => {
  assert.equal(imageTarget('flow', '.', 'https://img.shields.io/badge/a-b-blue'), null);
  assert.equal(imageTarget('flow', '.', 'http://example.com/a.png'), null);
  assert.equal(imageTarget('flow', '.', '//example.com/a.png'), null);
  assert.equal(imageTarget('flow', '.', 'data:image/png;base64,AAAA'), null);
});

test('a path that leaves the repo or is not an image throws', () => {
  assert.throws(() => imageTarget('flow', '.', '../../etc/passwd.png'), /leaves the repo/);
  assert.throws(() => imageTarget('flow', '.', 'docs/notes.md'), /not a known image type/);
});

test('the pattern finds alt text and ignores plain links', () => {
  const found = [...'a ![The canvas, [x] open](docs/s/e.png "t") and [link](docs/s/e.png)'.matchAll(IMAGE_RE)];
  assert.equal(found.length, 1);
  assert.equal(found[0][1], 'The canvas, [x] open');
  assert.equal(found[0][2], 'docs/s/e.png');
});
