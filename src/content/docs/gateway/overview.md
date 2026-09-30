---
title: "HotLoop Gateway overview"
description: "An industrial gateway: eight native protocols, a historian that keeps quality, ISA-18.2 alarms, MCP for agents, and one write gate nothing gets around."
sidebar:
  label: "Overview"
---

:::note[4.17.0 is out]
Recipes, scripts, blueprints, helpers, the logbook, a real automation language, read-only UniFi, and device passwords encrypted at rest. The image is `ghcr.io/hotloop-io/hotloop:4.17.0`, the chart is `hotloop` from `https://hotloop.io/hotloop`, and both pull with no login. The source repo is still private. [Install it](/gateway/install/). On 4.16.0? It's a plain `helm upgrade`, but not with `--reuse-values`, and afterwards a new Secret is part of your data. On 4.3.1? A plain `helm upgrade` fails outright. Either way, [read the upgrade first](/gateway/upgrading/). You want to find this out here, not from a stuck rollout.
:::

HotLoop Gateway reads your plant. It polls PLCs and servers in their own protocols, keeps every reading and its quality in a historian, raises ISA-18.2 alarms that can page a phone, runs automations against all of it, and hands the whole plant to agents over MCP. A site runs one chart, the Gateway and its database, instead of a historian, an alarm server, a rules engine and a pile of glue, each one breaking on its own damn schedule.

It can also command that equipment, which is the part that should make you nervous. So every value headed for a device goes through [one write gate](/gateway/write-gate/). Writes ship switched off, every tag is read-only until somebody arms it, a value outside its range is refused instead of clamped, and every attempt is audited before it touches the wire, refusals included.

It's written in Go, from scratch: one static binary on a distroless base, no sidecar, no interpreter, running as a non-root user with every capability dropped on a read-only root filesystem. Up to 3.0.11 this chart shipped a privileged container with `SYS_ADMIN` that spoke zero industrial protocols. 4.0.0 is where that died, and nobody misses it.

## Where to start

The ground floor, in 4.17.0 and in 4.16.0 before it:

- [Install](/gateway/install/) is Helm from the published chart, the key to back up, and the handful of values to set before a real plant sees it.
- [Upgrading](/gateway/upgrading/) is the procedure that keeps your data, from 4.16.0 or from 4.3.1, and every API change a script will trip over.
- [The write gate](/gateway/write-gate/) is every check between a request and a machine, in the order the code runs them, and what each refusal answers.
- [Protocols](/gateway/protocols/) says exactly how far each driver has been proven, including the two that have never touched a physical PLC.
- [Automations](/gateway/automations/) covers triggers, conditions and actions, and why a rule is compiled when you save it instead of when it fires at 3 AM.
- [Model Context Protocol](/gateway/mcp/) is the Gateway as an MCP server and client, and how one Gateway reads every site.

New in 4.17.0, and not in 4.16.0:

- [Recipes](/gateway/recipes/), [Scripts](/gateway/scripts/), [Blueprints](/gateway/blueprints/), [Helpers](/gateway/helpers/), [Logbook](/gateway/logbook/) and [UniFi Network](/gateway/unifi/). [Below](#new-in-4170) is what each one buys you.

## What it does with the data

**Historian.** TimescaleDB. The history table is a hypertable when the extension is there and natively range-partitioned when it isn't, so a plain PostgreSQL works instead of failing. Set a deadband per tag. Without one, a sensor jittering in its last bit writes a row every scan forever, and a thousand tags polled every second is about 86 million rows a day.

**Alarms.** ISA-18.2, including the state most homegrown systems miss: `rtn-unack`, an alarm that cleared on its own before anybody saw it. Acknowledged and returned-to-normal are separate axes, so the transient trip at 03:00 is still on the list when the morning shift walks in, instead of vanishing with nobody the wiser. Asymmetric deadbands and on and off delays stop a borderline value from chattering the list into noise nobody reads. Shelving tops out at 24 hours, because a shelve with no end is a suppression nobody wrote down.

**Quality.** Every reading carries good, uncertain or bad, and bad means the value is not known. It never means zero. Alarms hold their state on a bad reading instead of evaluating it, so a dead instrument shows up as a dead instrument and not as a process upset. Trends and reports aggregate good readings only, count what they left out, and give a period with nothing good no value at all. Zero is a reading (a closed valve, a flow of nothing), and nobody took this one.

**Entities.** The infeed pump, not register 40001. Every tag gets an entity for free, a motor, valve or PID loop is one entity built from the tags it really is, and all of it hangs on one ISA-95 equipment tree. Rules, screens and agents read like the plant instead of like a register map. A motor is running when its running contact says so, never because we told it to start.

**Paging.** ntfy, Gotify, Discord, webhook and email. Press Acknowledge on your phone and the alarm is acknowledged in the Gateway, with a link that's signed, expires, and works once. The Discord bot has only been tested against a stand-in that enforces Discord's documented protocol, not against Discord itself.

## The screens

**Board** is the one that gets left on a wall. Pinned tags are gauges with their alarm limits drawn where they really fall on the arc, and the last minute of history underneath. The layout is stored with the plant, not in a browser, so the panel PC on the floor and the laptop in the office show the same board.

**Entities** is the plant the way people talk about it, each thing under its place on the tree. Quality is drawn before the value: a bad reading shows its last good value greyed and hatched, and nothing you can't believe ever looks like something you can. An operator who trusts a stale number is how a tank gets overfilled. **Plant** is the tree editor.

**Overview, Devices, Tags, Trends, Alarms, Automations and Protocols** are the working screens. 4.17.0 adds four: **Logbook** is the timeline, **Scripts** runs named sequences with a form for their fields, **Recipes** applies a set of setpoints and shows exactly what went out (a value that didn't read back shows amber, never green), and **Blueprints** turns a rule with blanks into a real rule, with **Check first** showing what it would do before it exists. **Sites** reads across plants, and a site that doesn't answer is shown as unreachable, with the reason, and left out of the roll-up. Counting a plant you can't reach as zero alarms is how a head office decides everything's fine on the worst night of the year.

**Settings** is what the Gateway is actually running with: every setting, its effective value, and whether it came from the database, an environment variable or the default. When it does something you didn't expect, this is where you find out why. The safety switches are read-only there on purpose, because the master control over whether this process can command equipment doesn't belong behind the same browser session that issues the writes.

## Where it sits in the lineup

HotLoop is one codebase shipped as four products, all released together from one tag: IoT, Edge, the Gateway and the Edge Relay. The Gateway is the top of it: everything in IoT and Edge, plus fleet management, multi-site roll-ups and scheduled reports. Features split the products. Protocols never will: every product speaks every protocol we have, so nobody has to buy up a tier to read the PLC on their bench. [The lineup](/products/) has what each one carries.

Today you can install the Gateway and the [Edge Relay](/edge-relay/overview/), both 4.17.0. The relay is its own image and chart, about 15 MB against the Gateway's 34, with no database and no UI. The Gateway's fleet management tracks and commands every registered relay, and it's API only (`/api/fleet`): there's no Fleet screen in the UI. IoT and Edge aren't released, and there's no date.

## New in 4.17.0

:::note[Not in 4.16.0]
Everything in this section shipped in 4.17.0. A 4.16.0 Gateway has none of it, so don't go looking for it there. [Upgrade](/gateway/upgrading/) first.
:::

- **[Recipes](/gateway/recipes/).** Grade A's zone temps, line speed and die gap go out together or not at all: checked whole, refused whole, written in order through the gate, and read back from the device. The laminated sheet of numbers taped to the HMI can finally retire.
- **[Scripts](/gateway/scripts/).** Write the CIP cycle once, name it, and run it the same way from the Scripts screen, a rule, MCP or its own entity. Paste it into four rules instead, and one day somebody fixes a step in three of them.
- **[Blueprints](/gateway/blueprints/).** A rule written once with typed blanks, filled in per pump. Each rule keeps the blueprint version it was made from until a person reviews the upgrade, so Wednesday's edit to the blueprint doesn't change what pump 7 does on Thursday.
- **[Helpers](/gateway/helpers/).** The values your people own and no PLC keeps: the batch target, which shift is on, the purge timer. Seven kinds, kept across restarts, and a value outside its range is refused, never clamped.
- **[Logbook](/gateway/logbook/).** State changes, writes, alarms, rule runs and config changes on one timeline, for the whole plant, one branch of the tree, one entity, or one actor. "What happened right before it broke" stops being a tour of five screens.
- **[The automation language](/gateway/automations/).** Condition, wait and stop steps inside a sequence, and `forSec` on a state trigger, so "the press has run for ten minutes" is a trigger instead of a delay and a prayer.
- **[UniFi Network, read-only](/gateway/unifi/).** Switches, ports, PoE, WAN links and clients as ordinary tags. When a PLC goes quiet, its drawer says which switch port it's on and whether that link is up, and a stranger on a network you marked OT raises an alarm. Nothing writes to a console. Its first real read of our own Cloud Gateway got fooled: it called the 5G backup up when it had been dead for two days, because it trusted the WAN block's stale `up` the same way the console's summary did. The health checks knew, and the driver reads those now. A real cable pull and a phone joining SCADA haven't been done on real gear yet, and the page says so.
- **Device passwords encrypted at rest.** A database dump or a backup holds ciphertext, with the key in a Secret the chart generates (`<release>-secret-key`) and keeps. Coming from 4.16.0, the first start seals every stored password, and from then on that Secret is part of your data: back it up somewhere other than next to your backups, because a restore with credentials needs it. [Device credentials](/gateway/protocols/#device-credentials) has the rules.
- **[MCP goes from 16 tools to 25](/gateway/mcp/).** Nine more, for the logbook, scripts, recipes, blueprints and the network. Every one that can move anything still demands a stated reason and still goes through the same gate as an operator.

## License

HotLoop Gateway is source-available under the HotLoop Community License. It's free for individual, home, hobbyist, nonprofit and educational use. Any business use goes through [EmberNET](https://embernet.ai/), where signing up is free and running HotLoop is free. It is not an OSI-approved open source license, and we won't pretend it is. There are no license keys and nothing unlocks at runtime. [Licensing](/licensing/) has the plain-language version and the full text, and [Using HotLoop in a business](/business/) covers both ways to run it at work.
