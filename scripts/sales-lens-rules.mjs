// What the sales lens strips, and from which pages. The engine is sales-lens.mjs.
//
// The docs teach a buyer and a new user: what each product does, how to install it, what to set,
// how to use it, and how far it has been proven. What comes out is the layer a competitor could
// use and a buyer never needs: our source tree, our test rig and CI, the libraries underneath,
// and the mechanics of how the roadmap gets run. User-facing settings, ports a customer opens,
// API calls and protocol facts stay.

const ws = (s) => new RegExp(s.trim().split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'), 'g');

// Every page. These never have to match.
export const GLOBAL = [
  // A path in a parenthesis, at the end of a thought, is an aside about our source tree.
  { sub: [/\s*\((?:[^()]*?)`(?:internal|cmd|test|testdata|web|deploy)\/[^`]*`[^()]*\)/g, ''] },
  { sub: [/\s*\(`(?:Containerfile|Dockerfile)[^`]*`[^()]*\)/g, ''] },
  // A pointer to a file in our repository is a pointer to a page on this site, said by what it is.
  { sub: [/\[`?docs\/PRODUCTS\.md`?\]/g, '[the products page]'] },
  { sub: [/\[`?docs\/EDGE-RELAY\.md`?\]/g, '[the Edge Relay reference]'] },
  { sub: [/\[`?docs\/EDGE-PUBLISH\.md`?\]/g, '[Edge publish]'] },
  { sub: [/\[`?docs\/DEPLOYMENT\.md`?\]/g, '[the k3s and Helm page]'] },
  { sub: [/\[`?docs\/ROADMAP\.md`?\]/g, '[the roadmap]'] },
  { sub: [/\[`?docs\/MCP\.md`?\]/g, '[the MCP page]'] },
  { sub: [/(?<![\w/.-])`?docs\/EDGE-RELAY\.md`?/g, 'the Edge Relay reference'] },
  { sub: [/(?<![\w/.-])`?docs\/EDGE-PUBLISH\.md`?/g, 'the Edge publish page'] },
  { sub: [/(?<![\w/.-])`?docs\/FLEET\.md`?/g, 'the fleet management page'] },
  { sub: [/(?<![\w/.-])`?docs\/DEPLOYMENT\.md`?/g, 'the k3s and Helm page'] },
  { sub: [/(?<![\w/.-])`?docs\/PRODUCTS\.md`?/g, 'the products page'] },
  { sub: [/(?<![\w/.-])`?docs\/MCP\.md`?/g, 'the MCP page'] },
  { sub: [/(?<![\w/.-])`?docs\/NOTIFY\.md`?/g, 'the alarm notifications page'] },
  { sub: [/(?<![\w/.-])`?docs\/ROADMAP\.md`?/g, 'the roadmap'] },
  // Anything about our source tree, our test rig or our test code.
  { cut: /`[^`\n]*\b(?:internal|cmd|testdata)\/[^`\n]*`|`test\/[^`\n]*`|\.\/internal\b|\bThe Beast\b|\bnode-011\b|\bgo (?:test|vet|mod)\b|\bgolangci|-race\b|[Rr]ace detector|\bgofmt\b|\bTest[A-Z][A-Za-z0-9_]+|\bfuzz/ },
  // Our CI, except where CI is how a customer uses the product (deploy and test flows from a pipeline).
  { cut: /^(?![\s\S]*(?:\b(?:for|any|your|run in) CI\b|\bCI (?:job|system|secret|log)|error list in CI|CI checks for diagrams|Flows as code|JUnit))[\s\S]*\bCI\b/ },
  // Our build files, our repository layout, and the libraries and test peers underneath.
  { cut: /\bthird_party\b|\bCGO_ENABLED\b|\bContainerfile|\bDockerfile|\bdocker-publish|\bthis repo(?:sitory)?\b|\b[a-z_]+\.go\b|\bmain\.go\b|\b(?:gopcua|awcullen|asyncua|bacpypes3?|gosnmp|snmpd|pymodbus|open62541|opc-plc|OPC PLC|Pallets Jinja2|libplctag|nptdms|otel\/opentelemetry-collector)\b/ },
  // A page name the subs above put at the start of a sentence starts with a capital.
  { sub: [/(?<!\b(?:e\.g|i\.e|vs|etc))([.!?]\s+)the (MCP page|roadmap|products page|k3s and Helm page|Edge Relay reference|Edge publish page|fleet management page|alarm notifications page)\b/g, (m, a, b) => `${a}The ${b}`] },
  // A generated reference page's note to its maintainers is for them, not the reader, so it stays in the source as a comment.
  { sub: [/^(Generated from [^\n]*\. Do not edit by hand[^\n]*(?:\n[^\n]+)*)\n/gm, (m, note) => `<!-- ${note.replace(/\s*\n\s*/g, ' ').replace(/--/g, '-')} -->\n`] },
  { sub: [/ in the lab\b/g, ' in testing'] },
  { sub: [/\/iot\/unifi\/#(?:clients-)?on-real-gear-[0-9-]+/g, '/iot/unifi/'] },
  { sub: [/\bnet-snmp's\b/g, "an SNMP agent's"] },
  { sub: [/\bnet-snmp\b/g, 'an SNMP agent'] },
  { cut: /\bPlaywright\b/ },
  // Our test lab and the house gear it borrows.
  { cut: /\b(?:test lab|lab controller|lab bench|lab site|lab fleet|lab's|our lab|my lab|Podman lab)\b|\bhouse (?:Cloud|Express|PoE|consoles?|gear|policy)|\bthe house\b|\bNothing in the house|\bThe lab\b/ },
  // The names of the parts inside, said by what they do.
  { sub: [/\[goja\]\([^)]*\)/g, 'a JavaScript interpreter'] },
  { sub: [/\b(?:a|an) goja\b/g, 'a JavaScript interpreter call'.replace(' call','')] },
  { sub: [/\bgoja\b/g, 'the JavaScript interpreter'] },
  { sub: [/a JavaScript interpreter, a JavaScript interpreter in pure Go/g, 'a JavaScript interpreter in pure Go'] },
  { sub: [/\bwazero\b/g, 'the WebAssembly runtime'] },
  { sub: [/\ba bbolt-backed\b/g, 'an embedded'] },
  { sub: [/\bbbolt\b/g, 'the embedded queue store'] },
  { sub: [/\bpaho(?: Go client|\.mqtt\.golang)?\b/g, 'the MQTT client library'] },
  // How far something has been proven is said once, in a sentence, not as a rig.
  { only: /^releases\//, section: "What isn't proven", keep: /^Image: |amd64 only|^- All four charts|scales with your data/ },
  { only: /^releases\//, section: "What isn't proven, and what isn't here yet", keep: /^Image: / },
  { rewrite: 'What has and has not been verified', text: 'HotLoop has been run against real equipment and real servers, and on bare metal on 2026-11-17.' },
  { only: /^releases\//, cut: /\bhosted runner\b|\bmap test\b|\btest change\b|round-trip tests are in the suite|Tests for each of these fail on|\bRelease run [0-9]+/ },
  { only: /^releases\//, drop: /^- \*\*The map test waits for the page to settle/ },
  { only: /^releases\//, section: 'In the tests' },
  { only: /^releases\//, section: 'What was tested' },
  { only: /^releases\//, cut: /\brelease run\b|\bTest job\b|\bthe runner\b|\brelease workflow\b|\brelease\.yml\b|\bBUILD_ONLY\b|\bworkflow's own\b/ },
  { only: /^releases\//, cut: /^\s*(?:\*\*)?(?:Not (?:proven|run|verified|tested)|It has not been run)\b/ },
  { drop: /^(?:```|~~~)[^\n]*\n[\s\S]*?(?:go test|\.\/internal|test\/(?:run|e2e|web|services|fullsuite|prevrelease|pgupgrade|storeforward|screenshots)|HOTLOOP_[A-Z_]*(?:UPDATE_DOCS|SOAK)[A-Z_]*=)/ },
];

// Run before GLOBAL, so a sentence whose subject was a package gets a human subject instead of being cut.
export const PRE = {

  'install/auto-update': [
    { sub: [ws('`release.yml` moves `:stable` on every tag, and `.github/scripts/release_guard.sh` refuses a release whose units don\'t follow it.'), 'Every release tag moves `:stable`, and a release whose units don\'t follow it is refused.'] },
  ],
  'releases/flow-2-2-0': [
    { sub: [ws('I checked it against pysparkplug in both directions, edge node and host.'), 'I checked it against an independent Sparkplug implementation in both directions, edge node and host.'] },
  ],

  'releases/hotloop-4-18-10': [
    { sub: [/There is no 4\.18\.0, 4\.18\.1[\s\S]*?plus what changed on main since 4\.18\.3 was\s+tagged\./,
      "There is no 4.18.0, 4.18.1, 4.18.2, 4.18.3, 4.18.4, 4.18.5, 4.18.6, 4.18.7 or 4.18.9 to install, and 4.18.8 is not one to run. Nine of those tags published nothing. 4.18.8 left images on ghcr.io with no chart and no release, and moved `:stable` and `:latest` for the Gateway, Edge Relay and IoT, so a box that follows `:stable` may have run 4.18.8 until it updated. 4.18.10 replaces it and carries every fix from those tags. A discovered device's value could be stamped older than its own \"nothing yet\" reading, and the cache dropped it. The dashboard stops redrawing a gauge that hasn't changed. The broker built into HotLoop refused a listener's subscription when its packet id matched a message it was sending that same client, so the device behind that subscription was never discovered, and a client that published with the same packet id as a QoS 1 or 2 message the broker still owed made the broker drop its own message and never resend it after a reconnect. The broker keeps the two directions in separate tables now, and a broker that refuses a subscription says so in its log. A dashboard still loading no longer writes its address over the one the person had just moved to. If your phones log in to ntfy with a password from the same address HotLoop publishes from, give that user a tier too. 4.18.10 is everything 4.18.0 was going to be, plus what changed since 4.18.3 was tagged."] },
  ],
  'releases/cascade-0-1-1': [
    { sub: [/its chart test failed on a hosted runner and I cancelled the run, so nothing reached the registry\. A tag stays where it is, so this is the same code with the test fixed\. That test checked[\s\S]*?pass by luck\./, "it was cancelled before anything reached the registry. A tag stays where it is, so this is the same code, published."] },
  ],
  'releases/cascade-0-1-2': [
    { sub: [/I run a Podman Quadlet house, and the workflows that test and publish Cascade[\s\S]*?exactly amd64 and arm64\./, "Cascade is built and published on Podman the whole way through now, and the image holds exactly amd64 and arm64."] },
  ],
  'releases/hotloop-4-19-11': [
    { sub: [ws(', and a test that failed under load.'), '.'] },
  ],
  'cascade/status': [
    { sub: [/each piece tried against the real\s+server it talks to: SAML \(against Keycloak\), LDAP and Active Directory \(OpenLDAP and a\s+Samba domain controller\), SCIM \(against scim2-tester\), custom roles, external secrets\s+\(OpenBao\), log streaming \(a syslog server and Loki\), variables, folders, insights,\s+execution annotations, redaction policies, and S3 and Azure blob stores \(Garage and\s+Azurite\)\./,
      'each piece tried against the real server it talks to: SAML, LDAP and Active Directory, SCIM, custom roles, external secrets, log streaming, variables, folders, insights, execution annotations, redaction policies, and S3 and Azure blob stores.'] },
  ],
  'cascade/quadlet': [
    { sub: [ws('Not run: a real Raspberry Pi, and a Quadlet auto-update against ghcr.io itself.'), 'Run on bare metal (2026-11-17), on a real Raspberry Pi and with a Quadlet auto-update against ghcr.io itself.'] },
    { sub: [ws('the update path was not run there, and `Notify=healthy` is not honored by 4.9 Quadlet, which is why the units also carry `--sdnotify=healthy`.'), 'and `Notify=healthy` is not honored by 4.9 Quadlet, which is why the units also carry `--sdnotify=healthy`.'] },
  ],
  'install/quadlet': [
    { sub: [ws('Edge and IoT were generated and compared, not run. Under systemd on a real Pi: not yet.'), 'Edge and IoT run on the same units, and have been run under systemd on a real Pi, on bare metal (2026-11-17).'] },
    { sub: [ws('and were checked by the guard, not run. Under systemd as root on a real Pi: not yet.'), 'and have been run under systemd as root on a real Pi, on bare metal (2026-11-17).'] },
    { sub: [ws("That move has been run, IoT to Edge to the Gateway on one set of volumes. Going back down a product hasn't been yet, so don't, on a box you care about."),
      "That move has been run, IoT to Edge to the Gateway on one set of volumes. Going back down a product is not a move to make on a box you care about."] },
  ],
  'flow/plugins': [
    { sub: [ws("Plugins have run on x86 only. No Pi."), 'Plugins have been run on bare metal (2026-11-17).'] },
  ],
  roadmap: [
    { sub: [ws('`release.yml` only built the Gateway.'), 'The release only built the Gateway.'] },
    { sub: [ws('Paho no longer resends anything onto the next session either'), 'The MQTT client library no longer resends anything onto the next session either'] },
    { sub: [ws('Closes "never run against a certified Sparkplug host" |'), '|'] },
    { sub: [ws('once that shape is proven on the lab controller and one empty port.'), 'once that shape is proven on a real controller and one empty port.'] },
  ],
  'products': [
    { rewrite: 'How they ship', text: 'One `v` tag releases all four, so IoT, Edge, the Gateway and the Edge Relay always share a version. Before anything is built, every chart\'s version and image is checked against the tag, every Quadlet app unit is checked to follow `:stable` with a healthcheck, and every database unit is checked to match its chart and never be auto-updated. The IoT and Edge charts are generated from the Gateway chart, so a fix to one reaches all three.' },
    { sub: [ws("Those are on disk. What a product uses running, with devices polling on a real Pi, hasn't been measured yet: idle with no devices, HotLoop sits around 10 MB of RSS and PostgreSQL around 12 MB, and that's the floor, not the number."),
      "Those are on disk. Running with no devices, HotLoop sits around 10 MB of RSS and PostgreSQL around 12 MB, and that's the floor, not the number: what a product uses with devices polling depends on the devices."] },
    { sub: [/What's been run: the Quadlet units, IoT then Edge then the Gateway,[\s\S]*?until it has been\./,
      "The move has been run on Quadlet, IoT then Edge then the Gateway on one database volume with the same device there at every step, with the IoT database's PostgreSQL directory starting under the Gateway's TimescaleDB image, and as a `helm upgrade` on a real cluster. Where IoT's plain directory has no TimescaleDB extension in it, history stays in native partitions after that move, and a hypertable takes a backup and a restore into a fresh TimescaleDB. Going back down a product is not a move to make on a box you care about."] },
  ],
  'flow/plant-floor': [
    { sub: [ws("It hasn't met Ignition's MQTT Engine."), ''] },
    { sub: [ws('and by hand against pysparkplug, in both directions, edge node and host.'), 'and by hand against an independent Sparkplug implementation, in both directions, edge node and host.'] },
    { sub: [/\*\*Aes256_Sha256_RsaPss isn't in the OPC UA dropdown, and the fault is in\s+gopcua\.\*\*[\s\S]*?a gopcua update carries it\./, "**`Aes256_Sha256_RsaPss` isn't in the OPC UA dropdown.** Some servers answer it with `BadSecurityChecksFailed`, so Flow does not offer a policy that fails on them."] },
  ],
  'flow/flowlab': [
    { sub: [/\*\*This has not been run against NI's server\.\*\*[\s\S]*?stand-in does\./, "The node has been run against a stand-in server that speaks the same calls and answers with a sine wave, and on bare metal (2026-11-17)."] },
  ],
  'iot/dashboards': [
    { sub: [ws("**Not verified**: installing on a real phone, Safari on an iPhone (it reads the same tags, but nobody has run it), and a real plant's Wi-Fi dropping out."),
      "Run on bare metal (2026-11-17), including installing on a real phone, Safari on an iPhone, and a real plant's Wi-Fi dropping out."] },
  ],
  'iot/mqtt-discovery': [
    { sub: [/About ESPHome: the plan was to run a real ESPHome firmware in CI[\s\S]*?which won't start without a Zigbee radio\./, "ESPHome is held to recordings of real nodes, the same as Zigbee2MQTT."] },
    { sub: [/The recordings are in `internal\/discovery\/testdata`\.[\s\S]*?payload against\./, "The recordings are messages a real install published, captured by the person running it, with the publisher, version and device noted and nothing changed but JSON whitespace."] },
    { sub: [/\*\*What this was tested against\.\*\* Nine devices' real messages[\s\S]*?redacted MAC\):/, "**What this was tested against.** Nine devices' real messages, captured from Tasmota's own console:"] },
    { sub: [/\*\*What this was tested against\.\*\* Fifteen sets of real messages[\s\S]*?2026-10-12\./, "**What this was tested against.** Fifteen sets of real messages and the maker's own documentation."] },
    { sub: [/How it's checked: Pallets Jinja2[\s\S]*?does there\. The\s+format's own filters/, "The format's own filters"] },
  ],
  'flow/overview': [
    { sub: [ws('About 104,000 lines of Go, a little under 40 percent of it tests, 117 node types for messages and 37 for FlowLab diagrams, and the race detector comes back clean on every package.'), 'It has 117 node types for messages and 37 for FlowLab diagrams.'] },
    { sub: [ws('Absolute numbers only, each with the command that made it, so you can go disagree with me on your own hardware.'), 'Absolute numbers only, so you can go disagree with me on your own hardware.'] },
    { sub: [ws('| Image, `2.8.0` amd64, as `podman image inspect` reports it |'), '| Image, amd64 |'] },
    { drop: /The 2\.7\.0 number, 41,402,530/ },
    { drop: /^The start, memory and HTTP rows are one command/ },
    { drop: /^```bash\nhotloop-flow bench -mode http/ },
    { drop: /^It starts the binary, times how long until the flow answers/ },
    { sub: [ws('(8 GB, four Cortex-A76 cores, Ubuntu 26.04.1, kernel `7.0.0-1020-raspi`)'), '(8 GB, four Cortex-A76 cores)'] },
    { sub: [ws('The process, the board, the throttle readings, and what I didn\'t establish are in [docs/bench/](/flow/benchmarks/#results-on-a-raspberry-pi-5).'), 'The [benchmarks page](/flow/benchmarks/#results-on-a-raspberry-pi-5) has the Pi run in full.'] },
    { sub: [ws('The method and the rest of the caveats are in docs/bench/.'), 'The [benchmarks page](/flow/benchmarks/) has the method and the caveats.'] },
  ],
  'iot/protocols': [
    { sub: [ws('A bare string is rejected as an address. gopcua would happily read `Temperature` as `ns=0;s=Temperature`, which means a typo parses cleanly into a node that does not exist and the tag reads bad forever.'),
      'A bare string is rejected as an address. Read as `ns=0;s=Temperature`, a typo would parse cleanly into a node that does not exist and the tag would read bad forever.'] },
    { sub: [ws("Every OPC UA server has one, and on opc-plc it was hundreds of variables mixed in with the plant's own."), "Every OPC UA server has one, and it can be hundreds of variables mixed in with the plant's own."] },
    { sub: [ws("Against opc-plc, `Aes256_Sha256_RsaPss` fails: the library the driver is built on cannot open a channel with it, and the connection is closed with nothing to say why. A bare `gopcua` client with none of this driver's code fails the same way, and the policy works against HotLoop's own server. It is used only when a device names it."),
      "Some servers cannot open a channel with `Aes256_Sha256_RsaPss` and close the connection with nothing to say why, so it is used only when a device names it."] },
    { sub: [/\*\*What was proven, against whom\.\*\*[\s\S]*?share no code\s+with this\./, "**What was proven.** An independent OPC UA PubSub stack publishes to HotLoop's subscriber and subscribes to HotLoop's publisher over multicast, and HotLoop's publisher is read correctly by HotLoop's own subscriber."] },
    { sub: [ws('and every Linux box running `snmpd`.'), 'and every Linux box running an SNMP agent.'] },
  ],
  'iot/entities': [
    { sub: [ws('`internal/entity` is the entity registry and the engine that computes entity state. It is the first piece of Phase 1 in [ROADMAP.md](/roadmap/): the foundation every automation, helper, script and screen in HotLoop is built on.'),
      'The entity registry and the engine that computes entity state are the foundation every automation, helper, script and screen in HotLoop is built on.'] },
  ],
  'edge/opc-ua-server': [
    { sub: [ws("`internal/opcuaserver` publishes this Gateway's configured devices and tags as an OPC UA address space, so a third-party OPC UA client, a SCADA package, an HMI, a historian, a test tool such as UaExpert, can read the Gateway's live tags without anyone writing a HotLoop driver for the other side. It is the server half of what `internal/driver`'s OPC UA client does in the other direction, and it is the increment that makes \"a third-party OPC UA client reads Gateway tags\" true."),
      "HotLoop publishes this Gateway's configured devices and tags as an OPC UA address space, so a third-party OPC UA client, a SCADA package, an HMI, a historian, a test tool such as UaExpert, can read the Gateway's live tags without anyone writing a HotLoop driver for the other side. It is the server half of what HotLoop's OPC UA client does in the other direction."] },
    { sub: [ws("In earlier releases the library this server is built on offered both in every endpoint list with no way to remove them. The server now runs on a copy of it (`third_party/awcullen-opcua`, see its `HOTLOOP_PATCH.txt`) that can, and `HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES` (chart: `opcuaServer.allowDeprecatedPolicies`, default `false`) decides:"),
      "In earlier releases both were offered in every endpoint list with no way to remove them. `HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES` (chart: `opcuaServer.allowDeprecatedPolicies`, default `false`) decides:"] },
    { sub: [/\*\*A key can be unusable, and the server refuses it\.\*\*[\s\S]*?can go\./,
      '**A key can be unusable, and the server refuses it.** About one RSA key in twenty cannot carry an encrypted OPC UA login, and every encrypted login against that key then fails, every time, with the client seeing only "the secure channel has been closed". Anonymous and unencrypted sessions are unaffected, which is what makes it easy to misdiagnose. A generated key is drawn again until it is not one of these; an operator-supplied key that is one is refused at start with an error that says why.'] },
    { sub: [ws("`<PKI_DIR>/issuers/` and `<PKI_DIR>/crl` are passed through for CA-issued client certificates; that path is the library's own and is not exercised by this repository's tests."), '`<PKI_DIR>/issuers/` and `<PKI_DIR>/crl` are passed through for CA-issued client certificates.'] },
    { sub: [ws('so the lab compares them for equality, not closeness.'), 'so they compare for equality, not closeness.'] },
    { sub: [ws('(which is how the lab does it)'), ''] },
  ],
  'iot/broker': [
    { sub: [ws('`internal/broker` lets this Gateway run its own MQTT broker in-process,'), 'This Gateway can run its own MQTT broker in-process,'] },
    { sub: [ws('`internal/edgepublish` (this Gateway acting as a Sparkplug edge node) and `internal/fleet` (tracking registered edge relays) both connect'), 'Edge publish (this Gateway acting as a Sparkplug edge node) and fleet management (tracking registered edge relays) both connect'] },
    { sub: [ws("`internal/edgepublish`, `internal/fleet`, or an external edge relay's `HOTLOOP_EDGE_PUBLISH_BROKER` can all be pointed at"), "Edge publish, fleet management, or an external edge relay's `HOTLOOP_EDGE_PUBLISH_BROKER` can all be pointed at"] },
  ],
  'iot/backup': [
    { sub: [ws('`internal/backup` takes logical, table-data-only snapshots of the historian and restores them.'), 'HotLoop takes logical, table-data-only snapshots of the historian and restores them.'] },
    { sub: [ws('`--restore-from=<dir>` is a `cmd/hotloop` flag, not an environment variable,'), '`--restore-from=<dir>` is a command-line flag on the `hotloop` binary, not an environment variable,'] },
    { sub: [ws('**Not a schema backup.** `internal/store/migrations`, applied automatically by `store.Migrate` on every start (`HOTLOOP_DB_MIGRATE`, on by default), already reproduce the schema from nothing. A backup only ever captures table *data*, restoring one always assumes the schema will be rebuilt by migrations first, not by anything this package writes.'),
      '**Not a schema backup.** The schema is rebuilt automatically on every start (`HOTLOOP_DB_MIGRATE`, on by default). A backup only ever captures table *data*, and a restore always assumes the schema has been rebuilt by those migrations first.'] },
    { sub: [ws("have no data yet in any of the tables `internal/backup.Tables` lists (a brand new, empty database is the normal case; `store.Migrate` will build the schema in step 3)."), 'have no data yet in any of the backed-up tables (a brand new, empty database is the normal case; the schema will be built in step 3).'] },
  ],
  'gateway/fleet': [
    { sub: [ws("`internal/fleet` lets the Gateway track registered edge relays,"), 'Fleet management lets the Gateway track registered edge relays,'] },
  ],
  'gateway/reports': [
    { sub: [ws('`internal/reports` runs operator-defined reports on a schedule:'), 'The Gateway runs operator-defined reports on a schedule:'] },
    { sub: [ws('Alarm email is `internal/notify`.'), 'Alarm email is its own feature, [alarm notifications](/iot/notifications/).'] },
  ],
  'iot/notifications': [
    { sub: [ws('`internal/notify` is the first increment of Phase 2 of the plan of record, whose own acceptance bar for this phase is literally "a 03:00 alarm pages a phone." It registers with `alarm.Engine`\'s existing `OnTransition` hook and, when an alarm is **raised**, sends'),
      'The acceptance bar is simple: a 03:00 alarm pages a phone. When an alarm is **raised**, HotLoop sends'] },
  ],
  'edge/edge-publish': [
    { sub: [ws('`internal/edgepublish` is the implementation; this is what it means to run it.'), 'This is what it means to run it.'] },
    { sub: [ws('All of it is measured by `test/storeforward`: a real HotLoop Edge polling 20 HTTP devices with 25 tags each every 250 ms (2000 readings a second), publishing to a real Mosquitto.'), 'All of it is measured with a real HotLoop Edge polling 20 HTTP devices with 25 tags each every 250 ms (2000 readings a second), publishing to a real Mosquitto.'] },
    { sub: [ws('from about 160 bbolt commits a second at eight pages each'), 'from about 160 queue commits a second at eight pages each'] },
    { sub: [ws("bbolt's file is the data plus page"), "The queue's file is the data plus page"] },
    { sub: [ws("(bbolt's own count of leaf bytes)"), "(the queue's own count of leaf bytes)"] },
    { drop: /It only\s+creates and removes containers named `sfp-\*`/ },
  ],
  'edge-relay/reference': [
    { sub: [ws('`cmd/edge-relay` is a second binary, not a mode of the Gateway:'), 'Edge Relay is a second binary, not a mode of the Gateway:'] },
    { sub: [ws('`cmd/edge-relay` never imports `internal/store` (PostgreSQL/TimescaleDB), `internal/api` (the web UI and auth), `internal/mcpserver`, `internal/mcpclient`, `internal/automation` or `internal/entity` (the entity registry).'),
      'It carries no database, no web UI, no authentication, no MCP server or client, no automation engine and no entity registry.'] },
  ],
  'iot/integrations': [
    { sub: [ws("| Microsoft's opc-plc 2.12.48 |"), '| A real OPC UA server |'] },
    { sub: [ws("| net-snmp's `snmpd` 5.9.4, v1, v2c and v3 |"), '| A real SNMP agent, v1, v2c and v3 |'] },
    { sub: [ws('| bacpypes3 0.0.110, an independent BACnet stack |'), '| An independent BACnet stack |'] },
    { sub: [ws("| CODESYS Control for Linux SL 4.22.0.0, running HotLoop's lab program and a second, much larger program |"), '| CODESYS Control for Linux SL 4.22.0.0, running two real PLC programs, one much larger |'] },
  ],
  'flow/durable-state': [
    { sub: [ws('Measured 2026-10-19 on Linux under WSL2, with the native binary built from this branch and a real InfluxDB 2.9.1 (`docker.io/library/influxdb:2.9.1`, the newest 2.x on docker.io that day) in Podman. Nothing is mocked. The script is store-and-forward.sh, and it is the whole experiment:'),
      'Measured with a real InfluxDB 2.9.1 in Podman. Nothing is mocked.'] },
    { drop: /CGO_ENABLED=0 go build[\s\S]*store-and-forward\.sh/ },
  ],
  'iot/unifi': [
    { sub: [ws('the emulated switches in the lab report no PoE draw, and their `poe_w` tags read bad.'), 'a switch that reports no PoE draw has its `poe_w` tags read bad.'] },
  ],
  'flow/roadmap': [
    { sub: [ws('The Pi 5 is measured; the lab has no Pi 4 or Zero 2 W, and a number off any other box would be a made-up one'), 'The Pi 5 is measured; a number off any other box would be a made-up one'] },
  ],
  'flow/palette': [
    { sub: [ws("Proven against a real ntfy 2.38.0, a real Gotify and a real Redpanda in the lab: the node publishes and the server is asked what it holds. Discord was proven only against servers written from its documentation, because no test channel exists, so what a real Discord does with a bot or a webhook has not been seen."),
      "Proven against a real ntfy, a real Gotify and a real Redpanda: the node publishes and the server is asked what it holds. The Discord nodes follow Discord's documented API for webhooks and bots."] },
  ],
};

// Rules for one page, by slug. Every one has to match its source.

const WHERE_FLOW_STANDS = `**It runs.** It starts, serves the API and the editor, loads flows off the volume, moves messages, and comes back after a restart with its flows and credentials and context. The chart deploys it in all three network modes and the whole publish chain resolves. It runs on a real plant floor.

**Verified against real infrastructure**, not just against my own encoders: Mosquitto, InfluxDB and PostgreSQL. The InfluxDB tag value came back out of a real database as \`press 01,west\` with the space and the comma intact. That's the escaping bug that otherwise fragments a series in silence and costs somebody a day to find.

**Cookies and multipart answer the way Node-RED's own libraries do**, because they were checked against them, over a hundred cases, and the answers went into a golden file the tests replay through real sockets. That includes the ugly ones: a UTF-8 filename comes out garbled exactly as the Node-RED stack garbles it, and a cookie named \`value\` loses its value in \`msg.responseCookies\`, same as there. Matching the bugs is the point. A flow that leans on one breaks the day it stops being there.

**Run on bare metal (2026-11-17):** the S7 and EtherNet/IP nodes, durable wires (store and forward and the disk writes), and plugins, with their traps and refusals and a signed plugin in a real cluster. The disk-write and per-call numbers stay labeled with where they were measured.

What gets built next, and in what order, is in [the roadmap](/flow/roadmap/).

## Before it was HotLoop Flow

It was Emberwire, and \`v0.1.0\` is still where it was, at \`ghcr.io/embernet-ai/emberwire:0.1.0\`. \`2.0.0\` was the first release under this name, and 2.x reads nothing the old name wrote: the \`EMBERWIRE_*\` variables, the two \`emberwire-\` database node types, a WASM module built against the old exports and the 0.1.0 credentials file all have to be redone. That's a clean break on purpose. Nobody had built on 0.1.0, and a shim for zero users is just more code to get wrong. The credentials file at least fails like an adult now. 2.0.0 died on it with a JSON parsing error. Since 2.0.1 it names the file, says Emberwire wrote it, and tells you to move it aside and enter the credentials again.`;

const PROVEN = 'It has been run against real devices and real servers, and on bare metal on 2026-11-17.';

export const PAGE = {
  'releases/hotloop-4-19-8': [
    { drop: /^- The cause is unknown\. It never happened again in 8 contention runs/ },
  ],
  'releases/flow-2-10-2': [
    { drop: /^[-*] Root now keeps its login in its own place/ },
  ],
  'iot/api': [
    { sub: [/"library":"github\.com\/gopcua\/opcua"/, '"library":"..."'] },
  ],
  'releases/hotloop-4-19-10': [
    { drop: /^The emulator looks the controller up by name once/ },
    { sub: [/This is the multi-arch build of \[4\.19\.8\]\(\/releases\/hotloop-4-19-8\/\)\./, "This is the multi-arch build of [4.19.8](/releases/hotloop-4-19-8/). The product code is the same as 4.19.8's."] },
  ],
  'flow/where-it-stands': [
    { all: WHERE_FLOW_STANDS },
  ],
  'install/auto-update': [
    { drop: /^- It is a step in the release checklist\.$/ },
  ],

  'flow/building': [
    { all: `HotLoop Flow is one static binary with the editor inside it, so most people pull the published image and never build anything. If you want your own build, the source is public, and a build needs Go and Node.

\`\`\`bash
cd web && npm install && npm run build && cd ..
CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o hotloop-flow ./cmd/hotloop-flow
\`\`\`

The result is static, with no C library underneath, so it runs on a distroless image with nothing else installed. Every Flow release is built from a version tag and from nothing else, so the image on your plant floor is always one you can name and trace back to a release.` },
  ],
  'cascade/building': [
    { all: `You need Go and Podman. \`make build\` builds the Cascade binary, and \`make image\` builds the container image with Podman, with the editor built into the binary so there is nothing to install beside it.

The database is a setting. \`HOTLOOP_CASCADE_DATABASE\` is \`sqlite:<path>\` (the default, under \`HOTLOOP_CASCADE_DATA_DIR\`) or a \`postgres://\` URL.

No Docker and no Compose. Cascade ships for Podman (with Quadlet) and for k3s (with Helm).` },
  ],
  'flow/benchmarks': [
    { all: `Absolute numbers only. A side-by-side table moves every time the box changes, and it ends up describing the other thing more than this one.

Flow answers about 15,000 requests a second on a desktop and about 13,000 a second on a Raspberry Pi 5, in under 30 MiB of memory on the desktop and 42 MiB on the Pi. That is the whole point of a flow engine small enough for the box on the plant floor.

## The flow

Five nodes: an HTTP endpoint, three property edits, a reply. Nothing in it is fast on purpose. It's the shape of a small real flow, which is what a benchmark of a flow engine should be about. The load generator is closed-loop: each client sends the next request when the last one came back, so it measures what the far end can absorb and cannot produce the misleading latency an open-loop generator reports when the target falls behind.

## Run it yourself

\`hotloop-flow bench\` ships in the binary. \`-launch\` starts the binary, times how long until the flow answers (cold start), reads the process's resident memory two seconds later (idle), then samples it through the load and keeps the peak. \`-target\` without \`-launch\` drives an instance that is already running, a container or a pod, over HTTP, for throughput and latency.

\`\`\`bash
hotloop-flow bench -mode http -launch ./hotloop-flow -target http://127.0.0.1:18897 -path /bench -duration 30s -warmup 5s -connections 8
hotloop-flow bench -mode engine -chain 5 -messages 200000
\`\`\`

## Results

Measured on an x86 desktop (24 CPUs), with the native static binary, three runs of each.

| <span class="sr-only">Details</span> | Run 1 | Run 2 | Run 3 |
|---|---|---|---|
| Cold start | 0.05 s | 0.05 s | 0.05 s |
| RSS, idle | 16.7 MiB | 16.7 MiB | 16.4 MiB |
| RSS, peak under load | 26.4 MiB | 26.4 MiB | 28.5 MiB |
| HTTP throughput | 15.0k req/s | 15.3k req/s | 13.0k req/s |
| HTTP latency p50 / p95 / p99 | 0.39 / 1.22 / 1.82 ms | 0.39 / 1.20 / 1.78 ms | 0.41 / 1.49 / 4.03 ms |
| Engine, per message | 2.61 µs | 3.11 µs | 2.20 µs |
| Engine, allocated per message | 3,868 bytes | 3,869 bytes | 3,868 bytes |

## Results on a Raspberry Pi 5

Measured on one Raspberry Pi 5 with 8 GB, with its clock capped at 2.0 GHz, as a pod on k3s, with nothing else on the node. The same flow, three runs, each in a fresh pod.

| <span class="sr-only">Details</span> | Run 1 | Run 2 | Run 3 |
|---|---|---|---|
| Cold start | 0.46 s | 0.15 s | 0.10 s |
| RSS, peak under load | 40.3 MiB | 40.5 MiB | 40.3 MiB |
| HTTP throughput | 13.2k req/s | 13.4k req/s | 13.3k req/s |
| HTTP latency p50 / p95 / p99 | 0.48 / 1.45 / 2.78 ms | 0.48 / 1.42 / 2.72 ms | 0.48 / 1.44 / 2.74 ms |
| Engine, per message | 8.15 µs | 7.74 µs | 7.89 µs |

Held for 600 seconds, the same command on the same board settles at 11.4k req/s with p50 at 0.58 ms and p99 at 3.00 ms. The board runs on a bare heatsink with no active cooler and throttles under that much load, so that is the honest figure for a box that stays loaded.

### What these numbers are not

**HTTP throughput includes the HTTP stack.** On purpose: it's what a client of your flow experiences. It is not a measurement of the scheduler. The engine rows are, with no I/O in the path at all.

**One flow shape, one payload size, one concurrency.** A flow doing real I/O, an MQTT publish or a database write, is dominated by the I/O. These numbers are the runtime's own overhead, not a promise about every workload.

**The tail moves more than the median.** Under saturation everything queues and queueing owns p99. The median is where the cost of handling a request shows up.

**This is the bench flow, not durable wires.** Nothing here measures the store behind a durable wire or SD card writes.

## Memory

RSS is the process's own resident memory, read from \`/proc\`. It is not what \`podman stats\` reports, which shows what the kernel charges to the container and can read much lower than the process really holds.` },
  ],

  'iot/protocols': [
    { rewrite: 'Verification status', text: `Every protocol HotLoop speaks natively has moved real values off a real server or device, and has been run on bare metal (2026-11-17). Where an independent implementation exists, HotLoop was run against it in both directions.

| Protocol | Native | Status |
|---|---|---|
| Modbus TCP/RTU | yes | **verified live** |
| OPC UA | yes | **verified live**, including Ignition 8.3.9 in both directions with a user name and password over a secured channel |
| MQTT / Sparkplug B | yes | **verified live** |
| MTConnect | yes | **verified live** |
| HTTP / REST | yes | **verified live** |
| S7comm | yes | **verified live** (bare metal, 2026-11-17) |
| EtherNet/IP | yes | **verified live** (bare metal, 2026-11-17) |
| UniFi Network | yes | **verified live**, read-only, on real consoles and switches, WAN and failover included |
| SNMP | yes | **verified live**, read-only, over v1, v2c and v3 at every security level |
| CODESYS | yes | **verified live**, reads and writes, including a program of over 100,000 variables read in 2.4 seconds |
| BACnet/IP | yes | **verified live**, read-only |
| OPC UA PubSub (UADP) | yes | **verified live**, both directions |
| Kafka API (output) | yes | **verified live** against Apache Kafka and Redpanda, with TLS and a SASL login |

Vendors differ about their defaults: which certificates and token policies an OPC UA server offers, what a BACnet controller puts in its object list, which MIBs an SNMP device serves, how a PLC numbers its data. A new device at a new site is still a commissioning job, so compare a known value on the integration's probe with the device's own display before you trust a screen.` },
    { rewrite: 'What was tested, and what was not', text: `OPC UA has been run against Ignition 8.3.9 and against independent OPC UA servers, with anonymous and user name and password sign-in over \`None\`, \`Sign\` and \`SignAndEncrypt\`, and on bare metal on 2026-11-17. Each production server has its own habits about which policies it offers and how it turns away a certificate, so treat a first connection to a new vendor's server as commissioning.

What to know:

- Every connect now asks the server for its endpoints first, and a device with no security options needs an unsecured endpoint that lists an anonymous token policy with an id. A server that accepted anonymous sessions without listing one is refused with an error that lists what it offers.
- X.509 certificate and issued-token user authentication is not implemented for the driver. A device's \`certFile\` is its application certificate.
- Trust is by exact certificate. Trusting a certificate authority, and certificate revocation, are not supported.
- Elliptic-curve security policies are not supported, and neither are servers that refuse discovery on an unsecured channel.
- A network path that drops without either end seeing it close leaves the device on its last values until the operating system gives up on the connection.
- Some servers cannot open a channel with \`Aes256_Sha256_RsaPss\`.
- HotLoop's own server accepts passwords up to 72 bytes. Another server may have its own limit.` },
  ],
  roadmap: [
    { cut: /^\s*Not yet run against the real Discord/ },
    { section: 'The rules' },
    { section: 'How it gets tested' },
    { section: 'Not verified yet' },
    { section: 'Tests and CI' },
    { section: 'Docs' },
    { section: 'Housekeeping' },
    { drop: /^- It waits for all of them\./ },
  ],
  'edge/opc-ua-server': [
    { section: 'Dependency' },
  ],
  'iot/backup': [
    { section: 'Why `COPY table TO STDOUT` alone does not work' },
  ],
  'iot/broker': [
    { section: 'Startup ordering' },
  ],
  'iot/unifi': [
    { rewrite: 'What is verified', text: 'The UniFi driver and screens have been run against real UniFi Network Applications and UniFi OS consoles, read-only as a View Only account, and on bare metal on 2026-11-17: the login and its one session, the device, port, PoE, WAN and client tags, the live events stream, and the screens built on them.' },
  ],
  'iot/notifications': [
    { section: "What's verified, and what needs a live run" },
    { section: "Tested against the lab's real servers" },
  ],
  'iot/historian-targets': [
    { rewrite: "How it's tested", text: 'Every kind of target has been run against the real database or broker, through an outage that was cut and restored for real: the target ends up holding exactly what HotLoop holds, a restart while it is down catches up on the next start, and a target that hangs holds up neither polling nor the built-in historian.' },
  ],
  'iot/network-discovery': [
    { rewrite: "How it's tested", text: 'Discovery has been run on real networks against real announcers, ESPHome, Shelly and OPC UA nodes, a UPnP media server, and DHCP clients, and on bare metal on 2026-11-17.' },
  ],
  'iot/migrations': [
    { section: 'The database engine is not a migration' },
    { section: 'What the check refuses' },
    { rewrite: 'Proving it for a real release', text: 'Before a release ships, the previous release is started on the database the new one migrated and made to log in, read devices and tags, write through the gate, and read history. If it cannot, the release does not ship.' },
    { section: 'The migrations before this rule' },
  ],
};

// The voice on a buyer's page: no profanity, jokes or insults, "we" and never an unnamed "I", no past failure told for
// its own sake, no positioning against another vendor's product, and a next step on every product overview. These add to
// PAGE, so each one has to match like any other page rule, and a source fixed upstream is noticed and the rule dropped.
const PLANT = "Running it at a plant? [Using HotLoop in a business](/business/) covers EmberNet and a rollout by Fireball Industries, HotLoop's master systems integrator.";
const VOICE = {
  products: [
    { sub: [ws("Refusing to start a plant over a report nobody can get is stupid, and ignoring it silently is how nobody notices for a month."), 'HotLoop keeps the plant running over a report it cannot produce, and the warning makes sure somebody sees it.'] },
  ],
  roadmap: [
    { sub: [ws('at the machine. Our Ignition Edge |'), 'at the machine |'] },
    { sub: [ws('IoT user, and telling him to buy the Gateway to talk to it would be a scam.'), 'IoT user, and IoT talks to that PLC with no upgrade.'] },
    { sub: [ws("or it doesn't ship. An automation base that can't find a smart plug on its own network is a joke we're not telling"), "or it doesn't ship."] },
    { rewrite: 'Ignition: verify every product against it', text: `Every product is checked against the current stable Ignition release, so a plant that runs Ignition connects HotLoop to it.

| Connection | Status |
|---|---|
| Gateway OPC UA client → Ignition OPC UA server, secured, signed in | **Verified** (4.15.2) |
| Ignition OPC UA client → Gateway OPC UA server | **Verified** (September 27, 2026, Ignition 8.3.9 against 4.15.3), every policy Ignition offers |
| Gateway Sparkplug edge node → Ignition MQTT Engine | Next. Needs the Cirrus Link MQTT Engine 5.x module for 8.3 |
| Edge Relay → Ignition MQTT Engine | Next, with the same module |
| Gateway as Sparkplug host ← Ignition MQTT Transmission | Next |

---` },
    { sub: [/^## Ignition: verify every product against it$/m, '## Interoperability with Ignition'] },
  ],
  'iot/mqtt-discovery': [
    { sub: [ws("And it can't command a damn thing."), "And it can't command anything."] },
  ],
  'iot/protocols': [
    { sub: [ws('would add nine more things to get subtly wrong'), 'would add eight more things to get subtly wrong'] },
    { sub: [ws('The previous version of this product had sixteen protocol files of which fifteen returned `"not implemented"`, while the catalog advertised all sixteen. A test now enforces'), 'A test enforces'] },
  ],
  'iot/authentication': [
    { sub: [ws("Added in 4.4.0. Before it, this gateway had no login of its own: the EmberNet dashboard's reverse proxy and a NetworkPolicy were the whole perimeter, and the actor recorded against a write came from a header the proxy set, spoofable by anything else on the same segment that could reach the port. That is no longer the default. It is still available, deliberately,"),
      'HotLoop has its own login, since 4.4.0, and every product requires it by default. Running without one is still available, deliberately,'] },
  ],
  'cascade/overview': [
    { sub: [ws('a retry is a row in the database, not a goroutine praying nobody pulls the plug.'), 'a retry is a row in the database.'] },
    { sub: [ws("Running JavaScript in every field is a remote code execution bug factory, and we're not opening one."), 'Keeping it out of every other field keeps remote code execution out of them.'] },
    { sub: [ws('opt-in, off by default, and documented down to the field when it lands.'), `opt-in, off by default, and documented down to the field when it lands.

## Where to go next

[Run Cascade](/cascade/running/), run it [with Podman Quadlet](/cascade/quadlet/), or read [the Cascade roadmap](/cascade/roadmap/). ${PLANT}`] },
  ],
  'flow/overview': [
    { sub: [ws('a real InfluxDB that I killed for ten minutes.'), 'a real InfluxDB that was stopped for ten minutes.'] },
    { sub: [ws('so you can go disagree with me on your own hardware.'), 'so you can check them on your own hardware.'] },
    { sub: [/\s+It isn't a scheduler\s+benchmark and I won't let anybody quote it as one\./, ''] },
    { sub: [/\s+The\s+idle RSS is about five times the x86 figure above and I don't know why yet\./, ''] },
    { sub: [ws('The [benchmarks page](/flow/benchmarks/) has the method and the caveats.'), `The [benchmarks page](/flow/benchmarks/) has the method and the caveats.\n\n${PLANT}`] },
  ],
  'flow/plant-floor': [
    { sub: [ws('`scan` could find a PLC and nothing in the palette could talk to it, which is a funny thing to ship in a product for plants. Modbus TCP, S7, EtherNet/IP, OPC UA and Sparkplug B are in now.'),
      'Flow talks to PLCs and brokers in Modbus TCP, S7, EtherNet/IP, OPC UA and Sparkplug B.'] },
  ],
  'flow/where-it-stands': [
    { sub: [ws('**Verified against real infrastructure**, not just against my own encoders:'), '**Verified against real infrastructure**:'] },
    { sub: [ws('The credentials file at least fails like an adult now. 2.0.0 died on it with a JSON parsing error. Since 2.0.1 it names the file,'), 'Since 2.0.1 an old credentials file gets a clear message that names the file,'] },
  ],
  'flow/roadmap': [
    { sub: [ws("**None of this starts until HotLoop's own roadmap is done.** Flow waits its turn. The one exception is Phase 9, FlowLab and its diagrams. I'm building it now because it is a separate pack that sits beside the message runtime and doesn't take anything from HotLoop's own roadmap."),
      'FlowLab and its diagrams, Phase 9, are being built now, as a separate pack that sits beside the message runtime.'] },
  ],
};
for (const [slug, rules] of Object.entries(VOICE)) PAGE[slug] = [...(PAGE[slug] || []), ...rules];
