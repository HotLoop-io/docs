---
title: "HotLoop Gateway overview"
description: "An industrial automation gateway with seven native protocols, ISA-18.2 alarms, a historian, and MCP access for agents."
sidebar:
  label: "Overview"
---

:::caution[Not yet published]
Version 4.13.0 is merged, and the code is moving into the HotLoop-io org. Nothing is downloadable yet. The [release notes](https://hotloop.io/releases/gateway/) say exactly which versions have and have not been tagged.
:::

HotLoop Gateway polls real equipment over real protocols, keeps what it reads, alarms on it, automates against it, and exposes the whole plant to agents over MCP. It is written in Go and it ships as one static binary with no sidecar, running as a non-root user with every capability dropped.

## Where to start

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

## Editions

There are two binaries today. The **Gateway** is the whole thing. The **Edge Relay** is a second, lighter binary with no database, about 16.9 MB against the Gateway's 33.4 MB, that polls equipment and forwards it over Sparkplug B. Fleet management in the Gateway tracks and commands registered relays.

## License

HotLoop Gateway is source-available under the HotLoop Community License. It is free for individual, home, hobbyist, nonprofit, and educational use, and any business use goes through [Embernet](https://embernet.ai). It is not an OSI-approved open source license. See [Licensing](/licensing/) for the plain-language version and the full text.
