// The sales lens engine. These docs are read by a buyer deciding whether HotLoop fits a plant, and by
// a new user installing it. Both need what the product does, how to install it, what to set, and how
// far it has been proven. Neither needs our source tree, our test rig, our CI, or the names of the
// libraries underneath, and a competitor could use all of it. The rules live in sales-lens-rules.mjs.
// This runs on every page the sync writes, after the house rules.
//
// A block is a paragraph, one list item, one table row, or one fenced code block. The kinds of rule:
//   { cut: RE }                    remove every sentence that matches, and the block if nothing is left
//   { drop: RE }                   remove every block whose text matches
//   { sub: [RE, text] }            replace inside the page
//   { section: 'Heading' }         remove the section with that heading, down to the next heading at the same or a higher level
//   { all: text }                  replace the whole page body
//   { rewrite: 'Heading', text }   keep the heading, replace the section's body
//
// A rule can carry `only: RE`, tested against the page's slug.
// GLOBAL rules never have to match. PAGE rules have to, or the sync stops, so a source doc that
// changes under a rule is noticed and read again.
//
// Every run writes what it removed to the file named by SALES_LENS_LOG, one line each, so a person
// reads the list instead of trusting the rules.
import { appendFileSync } from 'node:fs';

const LOG = process.env.SALES_LENS_LOG;
let quiet = false;
const note = (slug, kind, text) => {
  if (LOG && !quiet) appendFileSync(LOG, `[${slug}] ${kind}: ${text.replace(/\s+/g, ' ').trim().slice(0, 700)}\n`);
};

const LIST = /^\s*([-*]|\d+\.)\s/;

function toBlocks(text) {
  const lines = text.split('\n');
  const blocks = [];
  let i = 0;
  const push = (kind, ls) => blocks.push({ kind, lines: ls });
  while (i < lines.length) {
    const l = lines[i];
    if (/^(```|~~~)/.test(l)) {
      const fence = l.slice(0, 3);
      const ls = [l];
      i++;
      while (i < lines.length && !lines[i].startsWith(fence)) ls.push(lines[i++]);
      if (i < lines.length) ls.push(lines[i++]);
      push('fence', ls);
      continue;
    }
    if (l.trim() === '') { push('blank', [l]); i++; continue; }
    if (/^#{1,6}\s/.test(l)) { push('heading', [l]); i++; continue; }
    if (/^\|/.test(l)) { push('row', [l]); i++; continue; }
    if (/^:::/.test(l) || /^---\s*$/.test(l)) { push('raw', [l]); i++; continue; }
    const kind = LIST.test(l) ? 'item' : 'para';
    const ls = [l];
    i++;
    while (i < lines.length && lines[i].trim() !== '' && !LIST.test(lines[i]) && !/^(#{1,6}\s|\||```|~~~|:::)/.test(lines[i])) ls.push(lines[i++]);
    push(kind, ls);
  }
  return blocks;
}
const fromBlocks = (blocks) => blocks.map((b) => b.lines.join('\n')).join('\n').replace(/\n{3,}/g, '\n\n');

// Sentences, never splitting inside inline code, and only where a capital or code follows.
function sentences(s) {
  const out = [];
  let cur = '';
  let code = false;
  for (let k = 0; k < s.length; k++) {
    const c = s[k];
    cur += c;
    if (c === '`') code = !code;
    if (!code && /[.!?]/.test(c) && /\s/.test(s[k + 1] || '') && !/\b(e\.g|i\.e|vs|etc|No|v\d+)\.$/.test(cur) && /^\s+[A-Z`*\[("_]/.test(s.slice(k + 1, k + 4))) {
      out.push(cur);
      cur = '';
    }
  }
  if (cur) out.push(cur);
  return out;
}

function cutSentences(block, re, slug) {
  const m = block.lines[0].match(/^(\s*(?:[-*]|\d+\.)\s+)/);
  const prefix = m && block.kind === 'item' ? m[1] : '';
  const body = block.lines.join('\n').slice(prefix.length);
  const ss = sentences(body);
  let prevCut = false;
  const keep = ss.filter((s) => {
    re.lastIndex = 0;
    const hit = re.test(s);
    if (hit) note(slug, 'cut', s);
    else if (prevCut && /^\s*(It|This|That|These|They|Those|Its|Both|And|So|Which|Neither|Each|Then|The same)\b/.test(s)) note(slug, 'ORPHAN?', s);
    prevCut = hit;
    return !hit;
  });
  if (keep.length === ss.length) return block;
  const text = keep.join('').replace(/^\s+/, '');
  if (!text.trim()) return null;
  return { kind: block.kind, lines: (prefix + text).split('\n') };
}

function findSection(blocks, heading) {
  const idx = blocks.findIndex((b) => b.kind === 'heading' && b.lines[0].replace(/^#+\s+/, '').replace(/\s*#*$/, '') === heading);
  if (idx < 0) return null;
  const level = blocks[idx].lines[0].match(/^#+/)[0].length;
  let end = idx + 1;
  while (end < blocks.length && !(blocks[end].kind === 'heading' && blocks[end].lines[0].match(/^#+/)[0].length <= level)) end++;
  return { idx, end };
}

export function applyLens(slug, body, global, page = [], lenient = false, pre = []) {
  const fails = [];
  quiet = lenient;
  let blocks = toBlocks(body);
  const run = (rules, must) => {
    for (const r of rules) {
      if (r.only && !r.only.test(slug)) continue;
      const before = fromBlocks(blocks);
      if (r.cut) {
        blocks = blocks.flatMap((b) => (b.kind === 'para' || b.kind === 'item' ? [cutSentences(b, r.cut, slug)].filter(Boolean) : [b]));
      } else if (r.drop) {
        blocks = blocks.filter((b) => {
          if (b.kind === 'blank' || b.kind === 'raw') return true;
          const t = b.lines.join('\n');
          r.drop.lastIndex = 0;
          if (r.drop.test(t)) { note(slug, 'drop', t); return false; }
          return true;
        });
      } else if (r.sub) {
        let t = fromBlocks(blocks);
        r.sub[0].lastIndex = 0;
        if (r.sub[0].test(t)) {
          r.sub[0].lastIndex = 0;
          const old = t;
          t = t.replace(r.sub[0], r.sub[1]);
          note(slug, 'sub', `${[...old.matchAll(new RegExp(r.sub[0].source, r.sub[0].flags.includes('g') ? r.sub[0].flags : r.sub[0].flags + 'g'))].map((x) => x[0]).join(' | ').slice(0, 400)}`);
          blocks = toBlocks(t);
        }
      } else if (r.all) {
        note(slug, 'replaced the page body', fromBlocks(blocks));
        blocks = toBlocks(r.all);
      } else if (r.section) {
        const s = findSection(blocks, r.section);
        if (s) {
          const inside = blocks.slice(s.idx, s.end);
          const kept = r.keep ? inside.slice(1).filter((b) => b.kind !== 'blank' && r.keep.test(b.lines.join('\n'))) : [];
          note(slug, 'section', inside.filter((b) => !kept.includes(b)).map((b) => b.lines.join(' ')).join(' '));
          blocks.splice(s.idx, s.end - s.idx, ...kept.flatMap((b) => [b, { kind: 'blank', lines: [''] }]));
        }
      } else if (r.rewrite) {
        const s = findSection(blocks, r.rewrite);
        if (s) {
          note(slug, 'rewrite', blocks.slice(s.idx + 1, s.end).map((b) => b.lines.join(' ')).join(' '));
          blocks.splice(s.idx + 1, s.end - s.idx - 1, { kind: 'blank', lines: [''] }, ...toBlocks(r.text), { kind: 'blank', lines: [''] });
        }
      }
      if (must && fromBlocks(blocks) === before) fails.push(r);
    }
  };
  run(pre, true);
  run(global, false);
  run(page, true);
  quiet = false;
  if (fails.length && !lenient) throw new Error(`${slug}: a sales lens rule no longer matches its source: ${fails.map((f) => String(f.cut || f.drop || (f.sub && f.sub[0]) || f.section || f.rewrite || f.all)).join(', ')}`);
  return fromBlocks(blocks);
}
