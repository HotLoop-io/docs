// Words that never appear on a public HotLoop surface: the inside of our own build, and a product
// that has not shipped. The build and the sync both fail on a match, in the generated pages, the
// built HTML, the search index, and the strings the social cards are drawn from.
export const FORBIDDEN = [
  // The inside. These docs are read by a buyer and a new user, so our test rig, our source tree, our CI and
  // the libraries underneath stay out, and sales-lens-rules.mjs strips them. If one of these shows up, a new
  // source sentence got past the lens: add a rule for it there, never an entry here to hide it.
  [/\bThe Beast\b|\bnode-01[0-9]\b/, 'our test hardware'],
  [/`[^`\n]*\b(?:internal|cmd|testdata)\/[^`\n]*`|`test\/[^`\n]*`|\.\/internal\b|\bthird_party\b/, 'our source tree'],
  [/\bgo (?:test|vet)\b|\bgolangci|-race\b|\bTest[A-Z][a-z]+[A-Z][A-Za-z0-9]*\b/, 'our test code'],
  [/\b(?:gopcua|awcullen|asyncua|bacpypes3?|gosnmp|snmpd|pymodbus|open62541|opc-plc|libplctag|wazero|bbolt|pysparkplug)\b|\bgoja\b|\bpaho\b/i, 'a library or test peer underneath'],
  [/\bnet-snmp\b|\bPlaywright\b/, 'a library or test peer underneath'],
  [/\b(?:release run|Test job|hosted runner|the runner|release workflow|release\.yml|BUILD_ONLY|image-publish\.yml|mirror-image\.sh)\b/, 'our release pipeline'],
  [/\b(?:test lab|Podman lab|our lab|my lab|the house cluster|the house consoles?|the house gear)\b|\bthe lab(?:'s)? (?:controller|bench|fleet|site|program)\b/i, 'our test lab'],
  [/\bContainerfile|\bDockerfile|\bthis repo(?:sitory)?\b/, 'our build files'],
  // CI, except where CI is how a customer uses the product (deploy and test flows from a pipeline).
  { exec(text) {
    for (const line of text.split('\n')) {
      if (/\bCI\b/.test(line) && !/\b(?:[Ff]or|any|your|run in) CI\b|\bCI (?:job|system|secret|log)|error list in CI|CI checks for diagrams|Flows as code|JUnit|-junit|\bCI\/CD\b/.test(line)) return Object.assign(['CI'], { index: text.indexOf(line) });
    }
    return null;
  }, why: 'our CI' },
];

// Returns one line per match, with a little of the text around it.
// Pagefind puts zero-width spaces between the words of ja and zh-hans text in its fragments, and they split "CI/CD" and
// "for CI" so the allow-patterns above never match. They are not text: take them out before looking.
export const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF]/g;
export function scan(label, text) {
  text = text.replace(ZERO_WIDTH, '');
  const hits = [];
  for (const entry of FORBIDDEN) {
    const re = Array.isArray(entry) ? entry[0] : entry;
    const why = Array.isArray(entry) ? entry[1] : entry.why;
    const m = re.exec(text);
    if (m) hits.push(`${label}: "${m[0]}" (${why}) near: ${text.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40).replace(/\s+/g, ' ')}`);
  }
  return hits;
}
