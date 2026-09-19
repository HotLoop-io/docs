// Adapts a source document from a product repo into a Starlight page.
//
//   node scripts/adapt-source-doc.mjs <in.md> <out.md> --title "..." --description "..." [--order N]
//
// What it changes, and nothing else:
//   - the leading H1 becomes the page title, because Starlight renders the title itself
//   - em-dashes are rewritten by an explicit table below, each one decided by hand
//     (period, comma, colon, or parentheses, whichever the sentence was doing)
//   - British spellings become American, per the house style
//
// It fails if any em-dash survives, so a source doc that grows a new one is noticed
// instead of published. Prose in code blocks is never touched, with one deliberate
// exception listed in the table.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const args = process.argv.slice(2);
const [inFile, outFile] = args;
const flag = (n) => { const i = args.indexOf(`--${n}`); return i > -1 ? args[i + 1] : undefined; };
const title = flag('title'), description = flag('description'), order = flag('order');
if (!inFile || !outFile || !title || !description) {
  console.error('usage: node scripts/adapt-source-doc.mjs <in.md> <out.md> --title "..." --description "..." [--order N]');
  process.exit(1);
}

// [words that follow the dash, joiner]. A joiner ending in ". " capitalizes the
// next word. Every entry was checked against the sentence it lives in.
const DASH = [
  // Protocols
  ['`/api/protocols`', ': '],
  ['every data type,', ': '],
  ['but tested decoding', '. '],
  ['every reading is then', '. '],
  ['it is a plausible number', '. '],
  ['that is a fact about', '. '],
  ['that lives in the TIA', '. '],
  ['it becomes bad quality', '. '],
  ['a PROFINET IO controller', ', such as '],
  ['not a file to add', ', '],
  ['and on a trend,', ', '],
  // MCP
  ['the default deployment', '. '],
  ['with writes on', ': '],
  ['sending 400', ', because '],
  ['nothing is dialled', '. '],
  ['a plant does not stop', '. '],
  ['it is still worth reporting', '. '],
  // Automations
  ['or worse, one that', ', '],
  ['otherwise every threshold', '. '],
  ['a step that was supposed', ': '],
  ['a backstop against', ', '],
  ['when a rule misfires', '. '],
  ['a webhook posting into nothing', '. '],
];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const AMERICAN = [
  [/\bbehaviours\b/g, 'behaviors'], [/\bBehaviour\b/g, 'Behavior'], [/\bbehaviour\b/g, 'behavior'],
  [/\binitialise\b/g, 'initialize'], [/\bdialled\b/g, 'dialed'], [/\blicence\b/g, 'license'],
  [/\bhonoured\b/g, 'honored'], [/\bcolour\b/g, 'color'],
  [/\bcatalogue\b/g, 'catalog'], [/\bdefence\b/g, 'defense'], [/\bcancelled\b/g, 'canceled'],
];

let text = readFileSync(inFile, 'utf8').replace(/\r\n/g, '\n');

// Split into prose and fenced code, so code is never rewritten.
const parts = text.split(/(^```[^\n]*\n[\s\S]*?^```$)/m);
let used = 0;
const rewritten = parts.map((chunk, i) => {
  if (i % 2 === 1) {
    // the one deliberate exception: an annotation inside a code block
    return chunk.replace('a program-scoped tag — the colon is part of the path', 'a program-scoped tag (the colon is part of the path)');
  }
  let out = chunk;
  for (const [follow, joiner] of DASH) {
    // Source docs wrap lines mid-phrase, so a space in a rule matches any run of whitespace.
    const re = new RegExp(`\\s+\\u2014\\s+(${esc(follow).replace(/ /g, '\\s+')})`);
    if (re.test(out)) {
      used++;
      out = out.replace(re, (_, f) => joiner + (joiner.endsWith('. ') ? f[0].toUpperCase() + f.slice(1) : f));
    }
  }
  // An em-dash standing alone in a table cell means "none".
  out = out.replace(/\|\s*—\s*\|/g, '| None |');
  // A dash used as a parenthetical aside in a table cell.
  out = out.replace('drop the new trigger — **the default**, and the right answer near a device', 'drop the new trigger (**the default**, and the right answer near a device)');
  for (const [re, to] of AMERICAN) out = out.replace(re, to);
  return out;
});
text = rewritten.join('');

const left = (text.match(/—/g) || []).length;
if (left) {
  const at = text.indexOf('—');
  console.error(`${left} em-dash(es) survived in ${inFile}. First one:\n  ...${text.slice(Math.max(0, at - 70), at + 70).replace(/\n/g, ' ')}...`);
  process.exit(1);
}

// Starlight renders the title itself, so drop the source's own H1.
text = text.replace(/^# .*\n+/, '');

const fm = ['---', `title: ${JSON.stringify(title)}`, `description: ${JSON.stringify(description)}`];
if (order) fm.push('sidebar:', `  order: ${order}`);
fm.push('---', '');

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, fm.join('\n') + '\n' + text.replace(/^\n+/, ''));
console.log(`${outFile}: ${used} dash rules applied, 0 em-dashes remain`);
