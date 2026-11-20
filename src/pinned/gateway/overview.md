---
reviewed: hotloop=4.22.1
title: "HotLoop Gateway overview"
description: "An industrial gateway: twelve native protocol drivers, a historian that keeps quality, ISA-18.2 alarms, MCP for agents, and one write gate nothing gets around."
sidebar:
  label: "Overview"
---

:::note[{{hotloop}} is out]
Four products from one tag: [IoT](/iot/overview/), [Edge](/edge/overview/), the Gateway and the [Edge Relay](/edge-relay/overview/), each with its own image and chart. All four are built for amd64 and arm64 in {{hotloop}}, and for arm/v7 too in the three small ones. The Gateway keeps `ghcr.io/hotloop-io/hotloop:{{hotloop}}` and the chart `hotloop` from `https://hotloop.io/hotloop`, and both pull with no login. [Install it](/gateway/install/). On 4.18.11? It's a `helm upgrade`, and agents can write after it, so read the two things that change. On 4.17.0? It's a plain `helm upgrade`, but not with `--reuse-values`, and a couple of defaults moved. On 4.16.0 or 4.3.1? You go through 4.17.0 first. Either way, [read the upgrade first](/gateway/upgrading/). You want to find this out here, not from a stuck rollout.
:::

HotLoop Gateway reads your plant. It polls PLCs and servers in their own protocols, keeps every reading and its quality in a historian, raises ISA-18.2 alarms that can page a phone, runs automations against all of it, and hands the whole plant to agents over MCP. A site runs one chart, the Gateway and its database, instead of a historian, an alarm server, a rules engine, and a pile of glue, each one failing on its own schedule.

It can also command that equipment, so every value headed for a device goes through [one write gate](/gateway/write-gate/). Writes ship switched off, every tag is read-only until somebody arms it, a value outside its range is refused instead of clamped, and every attempt is audited before it touches the wire, refusals included.

It's written in Go, from scratch: one static binary on a distroless base, no sidecar, no interpreter, running as a non-root user with every capability dropped on a read-only root filesystem.

## Where to start

The ground floor, in {{hotloop}} and in every release back to 4.16.0:

- [Install](/gateway/install/) is Helm from the published chart or Podman Quadlet on a box, the key to back up, and the handful of values to set before a real plant sees it.
- [Upgrading](/gateway/upgrading/) is the procedure that keeps your data, from 4.17.0, 4.16.0, or 4.3.1, and every API change a script will trip over.
- [The write gate](/gateway/write-gate/) is every check between a request and a machine, in the order the code runs them, and what each refusal answers.
- [Protocols](/iot/protocols/) says exactly how far each driver has been proven, including the two that were run on bare metal on 2026-11-17, S7comm and EtherNet/IP.
- [Automations](/iot/automations/) covers triggers, conditions, and actions, and why a rule is compiled when you save it instead of when it fires at 3 AM.
- [Model Context Protocol](/iot/mcp/) is the Gateway as an MCP server and client, and how one Gateway reads every site.

New in 4.19.4, and not in 4.18.11: agents write through the same gate as the screen (MCP is on in every product, and the endpoint always has a token), a value written to a scaled tag lands in the register the way you meant it, a CODESYS runtime is read by the names in its Symbol Configuration, a Kafka event stream joins the historian targets, OPC UA PubSub over UADP subscribes and publishes, and `hostNetwork` is a chart setting. 4.19.5 is its multi-arch build, and 4.19.8 adds a Logbook fix and tag pickers that search the whole plant. [The release notes](/releases/hotloop-4-19-4/) say what each one buys you, and what it costs.

New in 4.18.11, and not in 4.18.10: the database is PostgreSQL 17 with an upgrade that runs itself, SNMP and BACnet/IP through one integrations flow, kiosk sign-in with a lockout, alarm escalation, and a UI that installs on a phone. [The release notes](/releases/hotloop-4-18-11/) say what each one buys you, and what it costs.

New in 4.18.10, and not in 4.17.0: the four-product lineup, a choice of database, MQTT, and network discovery, historian targets, and boxes that update themselves. [The release notes](/releases/hotloop-4-18-10/) say what each one buys you.

New in 4.17.0, and not in 4.16.0:

- [Recipes](/iot/recipes/), [Scripts](/iot/scripts/), [Blueprints](/iot/blueprints/), [Helpers](/iot/helpers/), [Logbook](/iot/logbook/) and [UniFi Network](/iot/unifi/). [The release notes](/releases/hotloop-4-17-0/) say what each one buys you.

## What it does with the data

**Historian.** TimescaleDB by default (on PostgreSQL 17 since 4.18.11), and plain PostgreSQL or a SQLite file work too, because [the database is a setting](/releases/hotloop-4-18-10/). The history table is a hypertable when the extension is there and natively range-partitioned when it isn't, so a plain PostgreSQL works instead of failing. Set a deadband per tag. Without one, a sensor jittering in its last bit writes a row every scan forever, and a thousand tags polled every second is about 86 million rows a day.

**Alarms.** ISA-18.2, including the state most homegrown systems miss: `rtn-unack`, an alarm that cleared on its own before anybody saw it. Acknowledged and returned-to-normal are separate axes, so the transient trip at 03:00 is still on the list when the morning shift walks in, instead of vanishing with nobody the wiser. Asymmetric deadbands and on and off delays stop a borderline value from chattering the list into noise nobody reads. Shelving tops out at 24 hours, because a shelve with no end is a suppression nobody wrote down.

**Quality.** Every reading carries good, uncertain, or bad, and bad means the value is not known. It never means zero. Alarms hold their state on a bad reading instead of evaluating it, so a dead instrument shows up as a dead instrument and not as a process upset. Trends and reports aggregate good readings only, count what they left out, and give a period with nothing good no value at all. Zero is a reading (a closed valve, a flow of nothing), and nobody took this one.

**Entities.** The infeed pump, not register 40001. Every tag gets an entity for free, a motor, valve, or PID loop is one entity built from the tags it really is, and all of it hangs on one ISA-95 equipment tree. Rules, screens, and agents read like the plant instead of like a register map. A motor is running when its running contact says so, never because we told it to start.

**Paging.** ntfy, Gotify, Discord, webhook, and email. Press Acknowledge on your phone and the alarm is acknowledged in the Gateway, with a link that's signed, expires, and works once. The Discord bot has been tested against a stand-in that enforces Discord's documented protocol.

## The screens

**Board** is the one that gets left on a wall. Pinned tags are gauges with their alarm limits drawn where they really fall on the arc, and the last minute of history underneath. The layout is stored with the plant, not in a browser, so the panel PC on the floor and the laptop in the office show the same board.

**Entities** is the plant the way people talk about it, each thing under its place on the tree. Quality is drawn before the value: a bad reading shows its last good value greyed and hatched, and nothing you can't believe ever looks like something you can. An operator who trusts a stale number is how a tank gets overfilled. **Plant** is the tree editor.

**Overview, Devices, Tags, Trends, Alarms, Automations, and Protocols** are the working screens. 4.17.0 adds four: **Logbook** is the timeline, **Scripts** runs named sequences with a form for their fields, **Recipes** applies a set of setpoints and shows exactly what went out (a value that didn't read back shows amber, never green), and **Blueprints** turns a rule with blanks into a real rule, with **Check first** showing what it would do before it exists. Since 4.18.10, **Devices** also lists what discovery found, read-only until an admin accepts it. **Sites** reads across plants, and a site that doesn't answer is shown as unreachable, with the reason, and left out of the roll-up. Counting a plant you can't reach as zero alarms is how a head office decides everything's fine on the worst night of the year.

**Settings** is what the Gateway is actually running with: every setting, its effective value, and whether it came from the database, an environment variable, or the default. When it does something you didn't expect, this is where you find out why. The safety switches are read-only there on purpose, because the master control over whether this process can command equipment doesn't belong behind the same browser session that issues the writes.

## Where it sits in the lineup

HotLoop is one codebase shipped as four products, all released together from one tag: IoT, Edge, the Gateway, and the Edge Relay. The Gateway is the top of it: everything in IoT and Edge, plus fleet management, multi-site roll-ups, and scheduled reports. Features split the products. Protocols never will: every product speaks every protocol we have, so nobody has to buy up a tier to read the PLC on their bench. [The lineup](/products/) has what each one carries.

All four are installable today, all {{hotloop}}. The relay is its own image and chart, about 15 MB against the Gateway's 37, with no database and no UI. The Gateway's fleet management tracks and commands every registered relay, and it's API only (`/api/fleet`): there's no Fleet screen in the UI.

Running it at a plant? [Using HotLoop in a business](/business/) covers licensing and how to reach us.

## What changed, release by release

Each release has its own notes, and the notes are where the detail lives, so it is in one place and not two.

- [4.22.1](/releases/hotloop-4-22-1/): the multi-arch build of 4.22.0, with no change to the product.
- [4.22.0](/releases/hotloop-4-22-0/): a panel page fills its screen edge to edge at any size, the Alarms screen imports a CODESYS Export Alarms file, and OPC UA PubSub devices on one address and port share one socket. This build is amd64 only, and 4.22.1 is the one small bump that builds the arm images.
- [4.21.1](/releases/hotloop-4-21-1/): the multi-arch build of 4.21.0, with no change to the product.
- [4.21.0](/releases/hotloop-4-21-0/): a client can sign in to the OPC UA server with an X.509 certificate an admin attached to a user (off until `HOTLOOP_OPCUA_SERVER_ALLOW_X509=true`), OPC UA passwords of 65 to 72 bytes sign in, and the deprecated security policies `Basic128Rsa15` and `Basic256` are off by default, on upgrades too (`HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES=true` brings them back for a legacy client). The CODESYS alarm import reads an Outside range alarm as a lo and a hi. One migration, 0027, which only adds a table.
- [4.20.2](/releases/hotloop-4-20-2/): an EtherNet/IP device with two or more tags in a batch no longer panics its poll, and `version` prints the version with no configuration. The first core release under the EmberNet Source License 1.0.
- [4.20.1](/releases/hotloop-4-20-1/): the multi-arch build of 4.20.0, with no change to the product.
- [4.20.0](/releases/hotloop-4-20-0/): the new web UI is the page at `/` and the old one is gone, with the same screens and controls, HotLoop's colors, the screens grouped Operate, Plant, Build and System, and a bar of five on a phone. MCP can change everything it can read: 128 tools, sixty-four that change configuration and thirty-seven for the administrator's own functions, each one route of the API run through its own handler with that route's permission, a required reason and the agent in the audit line, behind `allowMcpWrites`. This build is amd64 only, and the next release builds the arm images.
- [4.19.11](/releases/hotloop-4-19-11/): the setpoint and symbol page dashboard cards, a write to a CODESYS or OPC UA tag read back from the PLC, a CODESYS device read once a second, alarms imported from a CODESYS project, the UniFi screens drawing a trace before the number beside it, and a Kafka or Redpanda target that says why a broker refuses writes. This build is amd64 only, and the next release is the one small bump that builds the arm images.
- [4.19.10](/releases/hotloop-4-19-10/): the multi-arch build of 4.19.8, with no change to the product. There is no 4.19.9.
- [4.19.8](/releases/hotloop-4-19-8/): the Logbook's Older entries button keeps its page, and every tag picker searches the whole plant. It carries 4.19.6's and 4.19.7's changes too, because neither was published.
- [4.19.5](/releases/hotloop-4-19-5/): the multi-arch build of 4.19.4, with nothing else in it.
- [4.19.4](/releases/hotloop-4-19-4/): agent writes and a token on every MCP endpoint, scaled writes that land right, CODESYS by symbol name, a Kafka event stream, OPC UA PubSub over UADP, and `hostNetwork`. There is no 4.19.0 to 4.19.3, and the notes say why.
- [4.18.11](/releases/hotloop-4-18-11/): PostgreSQL 17 with an upgrade that runs itself (read this one before you upgrade a running plant), SNMP and BACnet/IP through one integrations flow, kiosk sign-in with a lockout, alarm escalation, and a UI that installs on a phone.
- [4.18.10](/releases/hotloop-4-18-10/): the four-product lineup, a choice of database, MQTT and network discovery, historian targets, and boxes that update themselves. There is no 4.18.0 to 4.18.9, and the notes say why.
- [4.17.0](/releases/hotloop-4-17-0/): recipes, scripts, blueprints, helpers, the logbook, and UniFi Network, read-only.

## License

HotLoop Gateway is under the HotLoop Source License Agreement 1.0, like every HotLoop product. It is free to use and source-available, not OSI open source, and each version converts to AGPL-3.0 or later four years after its release. Home and lab use is free, and so is use by schools, nonprofits and government bodies for their own operations. There are no license keys and nothing unlocks at runtime. [The License page](/license/) has the text, and [Using HotLoop in a business](/business/) covers both ways to run it at work.
