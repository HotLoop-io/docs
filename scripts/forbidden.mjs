// Words that never appear on a public HotLoop surface. HotLoop's code and screens are HotLoop's
// own, so no customer is named, not even by a project code, and a product that has not shipped
// is not on the page. The build and the sync both fail on a match, in the generated pages, the
// built HTML, the search index, and the strings the social cards are drawn from.
//
// When HotLoop Transmitter ships, take it off this list in the same change that adds it to the site.
export const FORBIDDEN = [
  [/\bUT3\b/i, 'UT3, a customer project code'],
  [/\bTrane\b/i, 'Trane, a customer'],
  [/tranetech/i, 'tranetech, a customer tenant'],
  [/expert[ -]?lift/i, 'Expert Lift, a customer'],
  [/a customer'?s? production (program|plc)/i, 'a customer program, described by whose it is'],
  [/HotLoop Transmitter/, 'HotLoop Transmitter, which is not on the public lineup until it ships'],
];

// Returns one line per match, with a little of the text around it.
export function scan(label, text) {
  const hits = [];
  for (const [re, why] of FORBIDDEN) {
    const m = re.exec(text);
    if (m) hits.push(`${label}: "${m[0]}" (${why}) near: ${text.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40).replace(/\s+/g, ' ')}`);
  }
  return hits;
}
