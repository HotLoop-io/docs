import test from 'node:test';
import assert from 'node:assert/strict';
import { oxfordHeadings } from './oxford.mjs';

test('a heading that lists three things gets its Oxford comma', () => {
  assert.equal(oxfordHeadings('### Times, durations and tag keys'), '### Times, durations, and tag keys');
  assert.equal(oxfordHeadings('## 5. No hosting, resale or embedding'), '## 5. No hosting, resale, or embedding');
  assert.equal(oxfordHeadings('## PostgreSQL, a server and workers'), '## PostgreSQL, a server, and workers');
});

test('a longer list gets it before the last item only', () => {
  assert.equal(oxfordHeadings('## One, two, three and four'), '## One, two, three, and four');
});

test('a heading that already has it, or has no list, is left alone', () => {
  assert.equal(oxfordHeadings('## One, two, and three'), '## One, two, and three');
  assert.equal(oxfordHeadings('## Rules and gates'), '## Rules and gates');
  assert.equal(oxfordHeadings('## IoT and Edge'), '## IoT and Edge');
});

test('a comma after a version is not a list', () => {
  assert.equal(oxfordHeadings('## 0.2.0, identity and governance'), '## 0.2.0, identity and governance');
});

test('only headings change, and never inside a code fence', () => {
  const body = 'Sites, areas and lines are a sentence.\n\n```\n# a, b and c\n```\n\n## Sites, areas and lines\n';
  assert.equal(
    oxfordHeadings(body),
    'Sites, areas and lines are a sentence.\n\n```\n# a, b and c\n```\n\n## Sites, areas, and lines\n',
  );
});
