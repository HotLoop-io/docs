// What gets synced, and where it lands. scripts/sync-docs.mjs reads this and nothing else.
//
// A page is one source file, or one or more README sections, from one product repo.
// `rules` are explicit rewrites for a sentence the house rules do not allow on this
// site. Every rule has to match, or the sync stops, so a source doc that changes
// under a rule is noticed instead of published wrong.

export const REPOS = {
  hotloop: {
    slug: 'HotLoop-io/hotloop',
    private: true,
    // Where the products shipped by this repo get their release notes.
    releaseName: 'HotLoop',
  },
  flow: { slug: 'HotLoop-io/hotloop-flow', private: false, releaseName: 'HotLoop Flow' },
  cascade: { slug: 'HotLoop-io/hotloop-cascade', private: true, releaseName: 'HotLoop Cascade' },
};

// The six sections of the site, in the order the product picker shows them.
export const PRODUCTS = [
  { id: 'iot', name: 'HotLoop IoT', repo: 'hotloop', tagline: 'The automation base, built in Go for OT.' },
  { id: 'edge', name: 'HotLoop Edge', repo: 'hotloop', tagline: 'IoT plus the machine layer.' },
  { id: 'gateway', name: 'HotLoop Gateway', repo: 'hotloop', tagline: 'Everything, for the whole site.' },
  { id: 'edge-relay', name: 'HotLoop Edge Relay', repo: 'hotloop', tagline: 'Poll, forward, survive.' },
  { id: 'flow', name: 'HotLoop Flow', repo: 'flow', tagline: 'Node-RED compatible flows on a Go runtime.' },
  { id: 'cascade', name: 'HotLoop Cascade', repo: 'cascade', tagline: 'The plant talking to everything else.' },
];

const ws = (s) => new RegExp(s.trim().split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'), 'g');

// Wording the site never carries. Home Assistant is never named where a reader sees
// it, and nothing says Apache-2.0 or "free for everything" any more.
export const GLOBAL_RULES = [
  [ws("the entity API is Home Assistant's shape, so that anything which already speaks it speaks this"),
    'the entity API uses the common entity, state and service shape, so that anything which already speaks it speaks this'],
  [ws('Home Assistant calls them scenes, and each is an entity, `scene.<id>`, too.'),
    'Each one is an entity, `scene.<id>`, too.'],
  [ws("Entity endpoints use Home Assistant's snake_case field names"), 'Entity endpoints use snake_case field names'],
  [ws('Home Assistant calls the idea a scene, and every recipe is an entity too, `scene.<id>`.'),
    'Every recipe is an entity too, `scene.<id>`.'],
  [ws('3.x deployed `homeassistant/home-assistant`. There is no migration path for its data because there is no shared data model: Home Assistant\'s recorder schema has nothing in common with a tag historian.'),
    '3.x was a different product. There is no migration path for its data, because it shares no data model with a tag historian.'],
];

// Each entry: id (also the slug under the product), file or sections, title, description.
// `sections` names README headings. `intro` is everything before the first H2.
export const PAGES = [
  // ---- HotLoop IoT: the base every other HotLoop product carries ----
  { product: 'iot', group: 'The base', slug: 'iot/entities', repo: 'hotloop', file: 'docs/ENTITIES.md', title: 'Entities', description: 'The entity registry every automation, helper, script and screen is built on: ids that never change, domains, services and the API that reads them.' },
  { product: 'iot', group: 'The base', slug: 'iot/equipment', repo: 'hotloop', file: 'docs/EQUIPMENT.md', title: 'The equipment tree and labels', description: 'One ISA-95 tree of enterprise, site, area, line, cell, unit and equipment, plus labels, so rules and agents talk about the pump and not register 40001.' },
  { product: 'iot', group: 'The base', slug: 'iot/helpers', repo: 'hotloop', file: 'docs/HELPERS.md', title: 'Helpers', description: "The values a plant's people own, like a batch target or which shift is on: toggles, numbers, selects, text, counters, timers and schedules." },
  { product: 'iot', group: 'The base', slug: 'iot/logbook', repo: 'hotloop', file: 'docs/LOGBOOK.md', title: 'The logbook', description: 'State changes, writes, alarms, rule runs and config changes on one timeline, for the plant, one area or one entity, so what happened right before is one list.' },
  { product: 'iot', group: 'The base', slug: 'iot/sun', repo: 'hotloop', file: 'docs/SUN.md', title: 'The sun', description: 'Sunrise, sunset, dawn, dusk and the sun position worked out on the box from a latitude and longitude, with no weather service and no internet.' },

  { product: 'iot', group: 'Automation', slug: 'iot/automations', repo: 'hotloop', file: 'docs/AUTOMATIONS.md', title: 'Automations', description: 'Rules with ten trigger types, conditions and sequences, compiled when you save, with every write going through the write gate.' },
  { product: 'iot', group: 'Automation', slug: 'iot/blueprints', repo: 'hotloop', file: 'docs/BLUEPRINTS.md', title: 'Blueprints', description: 'Write a rule once with blanks and fill it in per pump. Each rule keeps the blueprint version it was made from, so one edit never changes forty rules.' },
  { product: 'iot', group: 'Automation', slug: 'iot/scripts', repo: 'hotloop', file: 'docs/SCRIPTS.md', title: 'Scripts', description: 'Write a cycle once, name it, and run it from a rule, a screen, MCP or its own entity. A dry run goes through the real write gate before anything moves.' },
  { product: 'iot', group: 'Automation', slug: 'iot/recipes', repo: 'hotloop', file: 'docs/RECIPES.md', title: 'Recipes', description: "A product grade's setpoints applied in one go: checked whole, refused whole, written in order and read back from the device." },

  { product: 'iot', group: 'Screens and alerts', slug: 'iot/dashboards', repo: 'hotloop', file: 'docs/DASHBOARDS.md', title: 'Dashboards', description: 'Pages of cards built per role or per screen: gauges, trends, entity lists and buttons, with the same layout on a panel PC, a laptop and a phone.' },
  { product: 'iot', group: 'Screens and alerts', slug: 'iot/notifications', repo: 'hotloop', file: 'docs/NOTIFY.md', title: 'Alarm notifications', description: 'ntfy, Gotify, Discord, webhooks and email. Press Acknowledge on your phone and the alarm is acknowledged, signed and single use.' },
  { product: 'iot', group: 'Screens and alerts', slug: 'iot/mcp', repo: 'hotloop', file: 'docs/MCP.md', title: 'MCP', description: 'Let an agent read the whole plant and touch only what you armed, through the write gate, with a stated reason logged next to every write.' },

  { product: 'iot', group: 'Devices and data', slug: 'iot/protocols', repo: 'hotloop', file: 'docs/PROTOCOLS.md', title: 'Protocols and drivers', description: 'OPC UA, Modbus, MQTT and Sparkplug B, EtherNet/IP, S7comm, MTConnect and HTTP, with how far each driver has been proven against real equipment.' },
  { product: 'iot', group: 'Devices and data', slug: 'iot/broker', repo: 'hotloop', file: 'docs/BROKER.md', title: 'The embedded MQTT broker', description: 'A broker in the same process, so one small box can be the whole install, with its listeners, accounts and the settings that turn it on.' },
  { product: 'iot', group: 'Devices and data', slug: 'iot/mqtt-discovery', repo: 'hotloop', file: 'docs/DISCOVERY.md', title: 'MQTT discovery', description: 'Point ESPHome, Zigbee2MQTT, Tasmota or a Shelly at the broker and it shows up, read-only until an admin accepts it and arms each point.' },
  { product: 'iot', group: 'Devices and data', slug: 'iot/network-discovery', repo: 'hotloop', file: 'docs/NETWORK-DISCOVERY.md', title: 'Network discovery', description: 'HotLoop listens with mDNS, SSDP and DHCP and shows what is on the plant network, and sends nothing unless you list a network to probe.' },
  { product: 'iot', group: 'Devices and data', slug: 'iot/unifi', repo: 'hotloop', file: 'docs/UNIFI.md', title: 'UniFi Network', description: 'Switches, ports, PoE, WAN failover and clients read from a UniFi console as ordinary tags, with screens and events, and nothing written back.' },
  { product: 'iot', group: 'Devices and data', slug: 'iot/historian-targets', repo: 'hotloop', file: 'docs/HISTORIAN-TARGETS.md', title: 'Historian targets', description: "Write every reading HotLoop keeps out to the plant's own PostgreSQL, TimescaleDB, SQL Server, InfluxDB or MySQL and MariaDB as well." },

  { product: 'iot', group: 'Operate', slug: 'iot/authentication', repo: 'hotloop', file: 'docs/AUTH.md', title: 'Authentication and users', description: 'Logins, roles, tokens and the users screen, and what a deployment behind a trusted proxy has to say out loud to skip them.' },
  { product: 'iot', group: 'Operate', slug: 'iot/backup', repo: 'hotloop', file: 'docs/BACKUP.md', title: 'Backups and restore', description: 'Logical snapshots of the database, restores that refuse a newer schema, and why the device password key has to be backed up apart from them.' },
  { product: 'iot', group: 'Operate', slug: 'iot/migrations', repo: 'hotloop', file: 'docs/MIGRATIONS.md', title: 'Migrations only add', description: 'Why a migration never drops, renames or retypes anything, so a bad update can roll back to the last release without losing a row.' },
  { product: 'iot', group: 'Operate', slug: 'iot/api', repo: 'hotloop', file: 'docs/API.md', title: 'The HTTP API', description: 'Every call HotLoop answers over HTTP, what it needs, what it takes and what it gives back. The web UI uses nothing else.' },

  // ---- HotLoop Edge: what it adds on top of IoT ----
  { product: 'edge', group: 'What Edge adds', slug: 'edge/edge-publish', repo: 'hotloop', file: 'docs/EDGE-PUBLISH.md', title: 'Edge publish and store-and-forward', description: 'Publish everything a box reads to a central Gateway as a Sparkplug B edge node, buffer to disk when the link drops, and replay in order.' },
  { product: 'edge', group: 'What Edge adds', slug: 'edge/opc-ua-server', repo: 'hotloop', file: 'docs/OPCUA-SERVER.md', title: 'The OPC UA server', description: 'Publish configured devices and tags as a read-only OPC UA address space, so the SCADA you already own sees every tag without a new driver.' },

  // ---- HotLoop Gateway: what it adds on top of Edge ----
  { product: 'gateway', group: 'What the Gateway adds', slug: 'gateway/fleet', repo: 'hotloop', file: 'docs/FLEET.md', title: 'Fleet management', description: 'Track every Edge Relay from its Sparkplug births and deaths, and send rebirth, restart or a new device file without driving out to the box.' },
  { product: 'gateway', group: 'What the Gateway adds', slug: 'gateway/reports', repo: 'hotloop', file: 'docs/REPORTS.md', title: 'Scheduled reports', description: 'Historian numbers on a schedule as CSV or HTML, stored and emailed, where only good readings count and every row says how many were thrown out.' },

  // ---- HotLoop Edge Relay ----
  { product: 'edge-relay', group: 'Reference', slug: 'edge-relay/reference', repo: 'hotloop', file: 'docs/EDGE-RELAY.md', title: 'Edge Relay reference', description: 'The headless poll-and-forward Sparkplug B node: what it does, every setting, the disk-backed queue, fleet config and how it is deployed.' },

  // ---- shared pages: install, Podman Quadlet, k3s and Helm, auto-update, the lineup ----
  { product: 'shared', group: 'Install', slug: 'install/helm', repo: 'hotloop', file: 'docs/DEPLOYMENT.md', title: 'k3s and Helm', description: 'Deploy any HotLoop chart on k3s or any Kubernetes: the values worth setting, the database choice, upgrades, rollbacks and what a good install looks like.' },
  { product: 'shared', group: 'Install', slug: 'install/quadlet', repo: 'hotloop', file: 'deploy/quadlet/README.md', stopAt: 'Updates', title: 'Podman Quadlet', description: 'Run HotLoop as real systemd services on a Pi or small industrial PC with Podman Quadlet, with no Docker, no Compose and no cluster.' },
  { product: 'shared', group: 'Install', slug: 'install/auto-update', repo: 'hotloop', file: 'deploy/quadlet/README.md', sections: ['Updates'], title: 'The :stable auto-update', description: 'Every box follows the stable tag and Podman moves it. What an update does, what a rollback cannot undo, and how to hold updates until you say.' },
  { product: 'shared', group: 'Lineup', slug: 'products', repo: 'hotloop', file: 'docs/PRODUCTS.md', title: 'The lineup', description: 'Four products from one codebase, what each one has, which database each runs, how to install it and how to move a site up a product.', bannerExtra: 'The release you can install today, HotLoop 4.17.0, ships the Gateway and the Edge Relay. HotLoop IoT and HotLoop Edge are built from this same code and arrive with the next release.' },
  { product: 'shared', group: 'Lineup', slug: 'roadmap', repo: 'hotloop', file: 'docs/ROADMAP.md', title: 'HotLoop roadmap', description: "What HotLoop is, what is left to build and what is broken, in the order it gets done. If it is not on the list, it is not getting done." },

  // ---- HotLoop Flow ----
  { product: 'flow', group: 'Start here', slug: 'flow/overview', repo: 'flow', file: 'README.md', intro: true, sections: ['The numbers'], title: 'HotLoop Flow', description: 'A visual flow engine for the plant floor in one Go binary, with a ceiling on every queue, reviewable deploys and your existing Node-RED flows loaded unchanged.' },
  { product: 'flow', group: 'Start here', slug: 'flow/quick-start', repo: 'flow', file: 'README.md', sections: ['Quick start'], title: 'Quick start', description: 'Build or run HotLoop Flow, set the admin account and credential secret it insists on, and start it, from source or from the image.' },
  { product: 'flow', group: 'Start here', slug: 'flow/migrating-from-node-red', repo: 'flow', file: 'README.md', sections: ['Bring your flows'], title: 'Bring your Node-RED flows', description: 'Import a Node-RED flows.json unchanged, see what it maps to node by node, and what Flow refuses to run and why.' },
  { product: 'flow', group: 'How it runs', slug: 'flow/back-pressure', repo: 'flow', file: 'README.md', sections: ['Back-pressure, visibly'], title: 'Back-pressure, visibly', description: 'A ceiling on every queue, a policy for what happens at the ceiling, and a graph of every message that did not fit, before it becomes an OOM kill.' },
  { product: 'flow', group: 'How it runs', slug: 'flow/store-and-forward', repo: 'flow', file: 'README.md', sections: ['Store and forward'], title: 'Store and forward', description: 'Mark a wire durable and messages go to disk, in order, when the node behind it stops answering, and survive a kill -9.' },
  { product: 'flow', group: 'How it runs', slug: 'flow/durable-state', repo: 'flow', file: 'docs/durable/README.md', title: 'Durable state, measured', description: 'Context that survives a restart and durable wires that only touch the disk when the target stops answering, with the scripts and numbers behind both.' },
  { product: 'flow', group: 'How it runs', slug: 'flow/subflows', repo: 'flow', file: 'README.md', sections: ['Subflows'], title: 'Subflows', description: 'Wrap a set of nodes into one reusable node, with its own properties, and what a subflow shares with the flow around it.' },
  { product: 'flow', group: 'Review and test', slug: 'flow/deploys', repo: 'flow', file: 'README.md', sections: ['Every deploy is a record'], title: 'Every deploy is a record', description: 'Who, when, why and the exact bytes of every deploy, diffed node by node in the API, the CLI and git, with a rollback that keeps credentials.' },
  { product: 'flow', group: 'Review and test', slug: 'flow/tests', repo: 'flow', file: 'README.md', sections: ['Tests next to the flows'], title: 'Tests next to the flows', description: 'Write a test file beside a flow, run it on a fake clock, gate the deploy on it, and nothing leaves the test.' },
  { product: 'flow', group: 'Review and test', slug: 'flow/tracing', repo: 'flow', file: 'README.md', sections: ['Tracing and replay'], title: 'Tracing and replay', description: 'Click a debug message and see where it went, replay it into a draft, turn a trace into a test, and send spans to OpenTelemetry.' },
  { product: 'flow', group: 'Nodes', slug: 'flow/palette', repo: 'flow', file: 'README.md', sections: ['The palette'], title: 'The palette', description: 'Every node type Flow ships, labeled full, partial, divergent or Flow-only, with the difference from Node-RED written down.' },
  { product: 'flow', group: 'Nodes', slug: 'flow/plant-floor', repo: 'flow', file: 'README.md', sections: ['The plant floor'], title: 'The plant floor', description: 'Modbus TCP, OPC UA, Sparkplug B and the other nodes that talk to PLCs and brokers, and what each has been run against.' },
  { product: 'flow', group: 'Nodes', slug: 'flow/sandboxes', repo: 'flow', file: 'README.md', sections: ['Two sandboxes, and only one of them runs flows yet'], title: 'Two sandboxes', description: 'How the Function node and the WebAssembly sandbox are fenced, what each can touch and which one runs flows today.' },
  { product: 'flow', group: 'Nodes', slug: 'flow/compatibility', repo: 'flow', file: 'docs/compatibility.md', title: 'Node-RED compatibility', description: 'Every deliberate divergence from Node-RED, node by node, with the reason, so an imported flow gets the answer it got before.' },
  { product: 'flow', group: 'Run it', slug: 'flow/security', repo: 'flow', file: 'README.md', sections: ['Security posture'], title: 'Security posture', description: 'No login is a startup error, exec ships off, file nodes are fenced, and credentials are encrypted. What Flow refuses and how to opt out on purpose.' },
  { product: 'flow', group: 'Run it', slug: 'flow/configuration', repo: 'flow', file: 'README.md', sections: ['Configuration'], title: 'Configuration', description: 'Every setting Flow reads, its default, its environment override and what a bad value does at startup.' },
  { product: 'flow', group: 'Run it', slug: 'flow/admin-api', repo: 'flow', file: 'README.md', sections: ['The admin API'], title: 'The admin API', description: 'The HTTP and websocket calls the editor and the command line use, what each needs and what it returns.' },
  { product: 'flow', group: 'Run it', slug: 'flow/metrics', repo: 'flow', file: 'README.md', sections: ['Metrics'], title: 'Metrics', description: 'The Prometheus metrics Flow exposes per node, so a backed-up wire or a full inbox shows up on a graph before it shows up as an outage.' },
  { product: 'flow', group: 'Run it', slug: 'flow/deploying', repo: 'flow', file: 'docs/deploying.md', title: 'Deploying Flow', description: 'Flow on Kubernetes with Helm, on a box with Podman and Quadlet, or with a plain podman run, plus backups and the one secret you must never lose.' },
  { product: 'flow', group: 'Run it', slug: 'flow/troubleshooting', repo: 'flow', file: 'README.md', sections: ['When it refuses to start'], title: 'When it refuses to start', description: 'The startup errors Flow gives on purpose, what each one means and the one-line fix.' },
  { product: 'flow', group: 'Project', slug: 'flow/where-it-stands', repo: 'flow', file: 'README.md', sections: ['Where it stands'], title: 'Where Flow stands', description: 'What has been proven against real equipment, what has not, and what is known to be missing.' },
  { product: 'flow', group: 'Project', slug: 'flow/benchmarks', repo: 'flow', file: 'docs/bench/README.md', title: 'Benchmarks', description: 'How the Flow numbers were measured: the flow, the commands, the results, what they are not, and how memory is read.' },
  { product: 'flow', group: 'Project', slug: 'flow/building', repo: 'flow', file: 'README.md', sections: ['Building'], title: 'Building Flow', description: 'Build the Flow binary from source, run the tests and the race detector, regenerate the compatibility doc, and what CI refuses to ship.' },
  { product: 'flow', group: 'Project', slug: 'flow/roadmap', repo: 'flow', file: 'docs/ROADMAP.md', title: 'Flow roadmap', description: 'The phases still to build for Flow, what is done, and why the editor rewrite in Astro is last.' },

  // ---- HotLoop Cascade ----
  { product: 'cascade', group: 'Start here', slug: 'cascade/overview', repo: 'cascade', file: 'README.md', intro: true, sections: ["What it won't do"], title: 'HotLoop Cascade', description: 'Workflows that get the plant talking to everything else, checkpointed so a retry is a database row, in one static Go binary.' },
  { product: 'cascade', group: 'Start here', slug: 'cascade/status', repo: 'cascade', file: 'README.md', sections: ['Where it stands'], title: 'Where Cascade stands', description: 'Cascade is released: what is in it, what is not in it yet, and why a pull needs a registry login.' },
  { product: 'cascade', group: 'Use it', slug: 'cascade/running', repo: 'cascade', file: 'README.md', sections: ['Running it'], title: 'Running Cascade', description: 'Run Cascade with Podman Quadlet or Helm on k3s, on SQLite or Postgres, with the health check the units and the chart probes use.' },
  { product: 'cascade', group: 'Use it', slug: 'cascade/importing', repo: 'cascade', file: 'README.md', sections: ['Bringing a workflow in'], title: 'Bringing a workflow in', description: 'Import an existing workflow into Cascade, what maps across and what the importer tells you it could not carry.' },
  { product: 'cascade', group: 'Use it', slug: 'cascade/observability', repo: 'cascade', file: 'README.md', sections: ['Watching it'], title: 'Watching it', description: 'Health, readiness, Prometheus metrics and traces for every run and step, so a stuck job shows up on a graph and not in a complaint.' },
  { product: 'cascade', group: 'Use it', slug: 'cascade/file-steps', repo: 'cascade', file: 'README.md', sections: ['The file steps'], title: 'The file steps', description: 'The steps that read, write, list and move files, build CSV or Excel, and read a PDF, all fenced to one directory and off until you set it.' },
  { product: 'cascade', group: 'Install', slug: 'cascade/quadlet', repo: 'cascade', file: 'deploy/quadlet/README.md', title: 'Cascade with Podman Quadlet', description: 'Run Cascade as systemd services with Podman Quadlet, on SQLite or with Postgres and a separate worker, with an update window you control.' },
  { product: 'cascade', group: 'Install', slug: 'cascade/building', repo: 'cascade', file: 'README.md', sections: ['Building'], title: 'Building Cascade', description: 'Build the Cascade binary and image from source, and run the vet and race test suite against real services.' },
  { product: 'cascade', group: 'Project', slug: 'cascade/roadmap', repo: 'cascade', file: 'docs/ROADMAP.md', title: 'Cascade roadmap', description: 'What Cascade has built and what comes after the first release, phase by phase, and what each phase has to prove first.' },
];

// Release notes are every file in docs/releases, found on the ref, not listed here.
export const RELEASE_NOTES = [
  { repo: 'hotloop', dir: 'docs/releases', slugPrefix: 'releases/hotloop-', label: 'HotLoop' },
  { repo: 'flow', dir: 'docs/releases', slugPrefix: 'releases/flow-', label: 'HotLoop Flow' },
  // 0.1.0 was tagged and never published anything, so it gets no page. A note for a release that does not exist is a claim that it does.
  { repo: 'cascade', dir: 'docs/release-notes', slugPrefix: 'releases/cascade-', label: 'HotLoop Cascade', skip: ['0.1.0'] },
];

// README sections that are deliberately not on the site, so a new section nobody
// mapped is an error and not a silent omission.
export const SKIPPED_SECTIONS = {
  flow: {
    'README.md': [
      'Deploying', // a pointer, and the real thing is docs/deploying.md
      'Layout', 'Adding a node', // contributor notes
      'The rest of HotLoop', // the lineup lives here already, and the license wording lives on the License page
      'Licence', // the License page renders the canonical text
    ],
  },
  cascade: {
    'README.md': ['License'],
  },
};

// Rewrites for a page that is generated without a manifest entry of its own, keyed by slug.
export const SLUG_RULES = {
  'releases/hotloop-4-16-0': [
    [ws('- License: the HotLoop Community License v1.0, not Apache-2.0. Free for individual, home, hobbyist, nonprofit and education use; businesses sign up free through EmberNET.'),
      '- License: the terms changed with this release. The current terms are on the [License]({{LICENSE_URL}}) page, and a business install should read them before it upgrades.'],
  ],
};

Object.assign(SLUG_RULES, {
  roadmap: [
    [ws('No license keys and no unlocking at runtime. HotLoop is free. A tier is an image,'), 'No license keys and no unlocking at runtime. A tier is an image,'],
    [ws('2026-09-28: the first public release since 4.3.1, and the one the Community License applies from'), '2026-09-28: the first public release since 4.3.1'],
  ],
  'cascade/overview': [
    [ws("scoped API keys and HA workers ship to everyone. There is no license check anywhere in the code, so there's nothing to rug-pull later."), 'scoped API keys and HA workers are all in the one binary. There is no license check anywhere in the code.'],
  ],
  'cascade/roadmap': [
    [ws('Everything here is free. No phase is a paid tier, and no license check exists anywhere in the code, so there is nothing to rug-pull later.'), 'No license check exists anywhere in the code.'],
  ],
  'flow/roadmap': [
    [ws("HotLoop's drivers stay HotLoop's, and Flow stays Apache."), "HotLoop's drivers stay HotLoop's, and Flow's nodes stay Flow's."],
  ],
});
