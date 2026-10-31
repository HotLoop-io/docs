// Headings in the docs are written the way the house writes lists: an Oxford comma.
// Source headings say "Times, durations and tag keys", and the sync writes them as
// "Times, durations, and tag keys", the same as every sentence on the site. Only
// headings are touched, and never inside a code fence. A comma after a version
// ("0.2.0, identity and governance") is not a list, so a heading that starts with
// one is left alone.
export function oxfordHeadings(text) {
  let fence = false;
  return text
    .split('\n')
    .map((line) => {
      if (/^(```|~~~)/.test(line)) fence = !fence;
      if (fence) return line;
      const m = /^(#{1,6}\s+)(.*)$/.exec(line);
      if (!m) return line;
      const [, hashes, title] = m;
      if (/^\d+(\.\d+)+,/.test(title)) return line;
      return hashes + title.replace(/, ([^,]+?) (and|or) (?=\S)/, ', $1, $2 ');
    })
    .join('\n');
}
