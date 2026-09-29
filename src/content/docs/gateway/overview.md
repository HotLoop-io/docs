---
title: "HotLoop Gateway overview"
description: "An industrial automation gateway with seven native protocols, ISA-18.2 alarms, a historian, and MCP access for agents."
sidebar:
  label: "Overview"
---

:::note[4.16.0 is out]
The first published release since 4.3.1, with everything from 4.4.0 to 4.15.3 in it at once. The image is `ghcr.io/hotloop-io/hotloop:4.16.0` and the chart is `hotloop` from `https://hotloop.io/hotloop`, and both pull with no login. The source repository, HotLoop-io/hotloop, is still private. [Install it](/gateway/install/), or if you're on 4.3.1, [read the upgrade first](/gateway/upgrading/), because it is not a plain `helm upgrade`.
:::

HotLoop Gateway polls real equipment over real protocols, keeps what it reads, alarms on it, automates against it, and exposes the whole plant to agents over MCP. It is written in Go and it ships as one static binary with no sidecar, running as a non-root user with every capability dropped.

## Where to start

- [Install](/gateway/install/) is Helm from the published chart, and what to set before a real plant sees it.
- [Upgrading from 4.3.1](/gateway/upgrading/) is the procedure, and every API change a script will notice.
- [The write gate](/gateway/write-gate/) explains what stands between a command and a machine, and why nothing can route around it.
- [Protocols](/gateway/protocols/) states exactly what the Gateway speaks and how far each driver has been verified, including the two that have never touched a physical PLC.
- [Automations](/gateway/automations/) covers triggers, conditions, and actions, and why a rule is compiled when you save it.
- [Model Context Protocol](/gateway/mcp/) covers the Gateway as both an MCP server and a client, and how sites are federated.

## What it does with the data

**Historian.** TimescaleDB, promoted to a hypertable when the extension is there and falling back to native range partitioning when it is not. Per-tag deadband filtering means a sensor jittering in its last bit does not write a row every scan forever.

**Alarms.** ISA-18.2, including the state most homegrown systems miss: `rtn-unack`, for an alarm that cleared on its own before anybody saw it. Acknowledgement and return-to-normal are independent axes, which is the whole point. A transient trip at 03:00 is still on the list when the morning shift arrives. Asymmetric deadbands and on and off delays keep the list from chattering into uselessness.

**Quality.** Every reading carries good, uncertain, or bad, and bad means the value is not known, not that it is zero. Alarm evaluation holds its previous state on a bad reading rather than evaluating it.

## The screens

**Board** is the one that gets left on a wall. Pinned tags are gauges with their alarm limits marked where they actually fall on the arc, and the last minute of history sits underneath. The layout is stored with the plant rather than in a browser, so the panel PC on the floor and the laptop in the office show the same board.

**Overview, Devices, Tags, Trends, Alarms, Automations, and Protocols** are the working screens. **Sites** reads across plants, and a site that does not answer is shown as unreachable, with the reason, and left out of the roll-up.

## Where it sits in the lineup

HotLoop is one codebase shipped as four products, all released together from one tag: IoT, Edge, the Gateway and the Edge Relay. The Gateway is the top of it: everything in IoT and Edge, plus fleet management, multi-site roll-ups and scheduled reports. [The lineup](/products/) has what each one carries.

Today you can install the Gateway and the [Edge Relay](/edge-relay/overview/). The relay is its own image and chart, about 15 MB against the Gateway's 34, with no database and no UI, and fleet management in the Gateway tracks and commands registered relays. IoT and Edge arrive in an upcoming release.

## On main, and not in 4.16.0

These merged after the 4.16.0 tag and land in the next release. You can't install them yet.

- **Helpers.** Seven kinds of helper: toggles, numbers, selects, text, counters, timers and schedules. The values a plant's people own, like the batch target or which shift is on, kept across restarts and never clamped.
- **Logbook.** One timeline of state changes, writes, alarms, automation runs and config changes, for the whole plant, one node of the equipment tree, one entity, or one actor, a person or an agent.
- **The automation language.** Condition, wait and stop steps inside a sequence, and `forSec` on a state trigger, so "the press has run for ten minutes" is a trigger and not a hack.
- **Scripts.** Write the CIP cycle once, give it a name, and run it the same way from the Scripts screen, a rule, MCP or its own entity. Typed fields are refused when they're out of range, never trimmed, and a dry run goes through the real gate.

Recipes and blueprints come next. A native UniFi integration, built in Go and starting with UniFi Network, is in development too.

## License

HotLoop Gateway is source-available under the HotLoop Community License. It is free for individual, home, hobbyist, nonprofit, and educational use, and any business use goes through [EmberNET](https://embernet.ai), where signing up is free and business use of HotLoop is free. It is not an OSI-approved open source license. See [Licensing](/licensing/) for the plain-language version and the full text, and [Using HotLoop in a business](/business/) for both ways to run it at work.
