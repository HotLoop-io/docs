import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scan } from './forbidden.mjs';

const ZW = '​';
const zw = (s) => [...s].join(ZW);

test('CI/CD and "for CI" are allowed in ja and zh-hans text, with or without zero-width spaces', () => {
  for (const t of ['パイプラインの CI/CD で使えます。', '用于 CI/CD 流水线。', '在 for CI 中运行。', `${zw('パイプラインの')} CI${ZW}/${ZW}CD ${zw('で使えます')}`, `${zw('用于')} CI${ZW}/${ZW}CD ${zw('流水线')}`, `${zw('在')} for${ZW} CI ${zw('中运行')}`]) {
    assert.deepEqual(scan('p', t), [], t);
  }
});

test('a real forbidden word is still caught in ja and zh-hans text, zero-width spaces or not', () => {
  assert.equal(scan('p', `${zw('これは')} The Beast ${zw('です')}`).length, 1);
  assert.equal(scan('p', `${zw('这是')} node-011 ${zw('的')}`).length, 1);
  assert.equal(scan('p', `${zw('私たちの')} CI ${zw('で動きます')}`).length, 1);
  assert.equal(scan('p', `${zw('我们的')} Th${ZW}e Be${ZW}ast`).length, 1);
  assert.equal(scan('p', '我们的 CI 失败了').length, 1);
});

test('English text is judged as before', () => {
  assert.deepEqual(scan('p', 'Run it in your CI/CD pipeline.'), []);
  assert.equal(scan('p', 'Our CI is green.').length, 1);
});
