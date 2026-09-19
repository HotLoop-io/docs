// Re-imports the three Gateway pages from the product repo's own docs.
//
//   node scripts/import-gateway-docs.mjs <PROTOCOLS.md> <MCP.md> <AUTOMATIONS.md>
//
// The titles here are written for search results (kept short enough that Google
// does not truncate them, once the site name is added), and the sidebar labels
// stay short so the navigation is unchanged. Keeping the commands in one place
// means a re-import does not quietly undo that work.
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [protocols, mcp, automations] = process.argv.slice(2);
if (!protocols || !mcp || !automations) {
  console.error('usage: node scripts/import-gateway-docs.mjs <PROTOCOLS.md> <MCP.md> <AUTOMATIONS.md>');
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const adapt = resolve(here, 'adapt-source-doc.mjs');
const out = (n) => resolve(here, `../src/content/docs/gateway/${n}.md`);

const jobs = [
  [protocols, out('protocols'), 'Protocols: OPC UA, Modbus, MQTT, Sparkplug B',
    'Exactly what the Gateway speaks, how far each driver has been verified, and what to do about everything else.', 'Protocols', '3'],
  [automations, out('automations'), 'Automations: triggers, conditions, actions',
    'Triggers, conditions, actions, and run modes, and why a rule is compiled when you save it, not when it fires.', 'Automations', '4'],
  [mcp, out('mcp'), 'Model Context Protocol server and client',
    'The Gateway as an MCP server and client: tools, resources, the write path, and how sites are federated.', 'Model Context Protocol', '5'],
];

for (const [src, dest, title, description, label, order] of jobs) {
  const stdout = execFileSync(process.execPath, [
    adapt, src, dest, '--title', title, '--description', description, '--label', label, '--order', order,
  ]);
  process.stdout.write(stdout);
}
