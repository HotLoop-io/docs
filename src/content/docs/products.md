---
title: "HotLoop IoT, Edge, Gateway and Edge Relay"
description: "One codebase, four products, released together from one tag. What HotLoop IoT, Edge, Gateway and Edge Relay each carry, and which you can install today."
sidebar:
  label: "The lineup"
---

HotLoop is built once and shipped four ways. Each product has its own image and its own Helm chart, and all four are released together from the same tag with the same version number. Protocols don't split them: every one speaks every protocol HotLoop has, MQTT included. Features do.

| Product | Install today? | Database | What it adds |
|---|---|---|---|
| **HotLoop IoT** | No, upcoming release | SQLite or PostgreSQL | The base: Home Assistant, rewritten in Go for OT |
| **HotLoop Edge** | No, upcoming release | SQLite, PostgreSQL or TimescaleDB | IoT plus the machine layer |
| **HotLoop Gateway** | Yes, [4.16.0](/gateway/install/) | SQLite, PostgreSQL or TimescaleDB | Everything, plus fleet, multi-site and reports |
| **HotLoop Edge Relay** | Yes, [4.16.0](/edge-relay/install/) | None | Headless poll and forward over Sparkplug B |

The database is picked by a setting, in the same image. Today's Gateway runs on TimescaleDB, or plain PostgreSQL when the extension is missing. SQLite, pure Go with no cgo, is on its way.

## HotLoop IoT

The Home Assistant model, rewritten natively in Go for the plant floor. We don't run, embed, bridge or fork Home Assistant. We rebuilt what it does: entities, automations, helpers, scripts, the logbook, dashboards, notifications and MCP, plus the ISA-18.2 alarm engine and backups. On top of that, MQTT with Home Assistant style discovery, so Shelly, ESPHome, Tasmota and Zigbee2MQTT devices show up by themselves, and every industrial driver HotLoop has.

**Not out yet.** IoT ships once MQTT discovery lands, so its first release finds your devices instead of making you type topics. It arrives in an upcoming release, and there's no date on it. Most of what it carries already runs inside the Gateway today.

## HotLoop Edge

IoT, plus what lives next to a machine, in the spirit of Ignition Edge: HMI screens for the touch panel on the machine, PLCs (native drivers, plus CODESYS runtimes and Pi based PLCs over OPC UA or Modbus TCP), store-and-forward upstream over Sparkplug B, and an OPC UA server so the SCADA you already own can read it.

**Not out yet.** It arrives alongside IoT. The store-and-forward and the OPC UA server are in the Gateway today. HMI screens are design, not code, and land after dashboards, which they're built on. CODESYS and Pi PLCs are reached through protocols the Gateway already speaks, but haven't been run against one on the bench.

## HotLoop Gateway

Everything in Edge, plus what a site or a company of sites needs: fleet management of edge relays, multi-site roll-ups, and scheduled reports. [Overview](/gateway/overview/), [install](/gateway/install/), [upgrading from 4.3.1](/gateway/upgrading/).

## HotLoop Edge Relay

Headless and dumb on purpose. It polls with the same drivers and forwards everything over Sparkplug B, buffering to disk when the uplink dies. No database, no UI, no write path. [Overview](/edge-relay/overview/), [install](/edge-relay/install/).

## Moving between them

Every product runs the same database schema. Going from IoT to Edge to the Gateway is designed to be an image swap on the same database, with your devices, entities, automations, alarms, history and users already there. Going back down deletes nothing: what the smaller product doesn't have sits there until you come back. That's the design; it gets proven with tests before IoT and Edge ship.

## No keys, no tiers

There are no license keys and nothing unlocks at runtime. The product is what was compiled, so a feature that isn't in your image can't be switched on by accident. All four are under the HotLoop Community License: free for individual use, and business use is free through EmberNET. See [Licensing](/licensing/).

[HotLoop Flow](/flow/overview/) is a separate product, a Node-RED compatible flow engine under Apache-2.0, free for everyone, businesses included.
