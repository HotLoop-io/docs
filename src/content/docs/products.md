---
title: "HotLoop IoT, Edge, Gateway and Edge Relay"
description: "One codebase, four products, one version number. What HotLoop IoT, Edge, Gateway and Edge Relay each carry, and which two you can install today."
sidebar:
  label: "The lineup"
---

HotLoop is one codebase shipped as four products. You choose by how much the box has to do, never by which one has the driver you need, because protocols don't split them. Every product speaks every protocol HotLoop has, MQTT included. Features split them. Somebody with a secondhand S7-1200 on the workbench is an IoT user, and needing one PLC shouldn't force anybody onto the Gateway.

Two of the four exist today: the Gateway and the Edge Relay, both 4.17.0, each with its own image and Helm chart, released together from one tag. IoT and Edge aren't released. They get their own images and charts from that same tag when they ship, and there's no date.

| Product | Install today? | Database | What it adds |
|---|---|---|---|
| **HotLoop IoT** | No, not released | SQLite or PostgreSQL | The base: entities, automations, helpers, scripts, the logbook, dashboards, notifications, MCP and every driver |
| **HotLoop Edge** | No, not released | SQLite, PostgreSQL or TimescaleDB | IoT, plus HMI screens, store-and-forward and an OPC UA server |
| **HotLoop Gateway** | Yes, [4.17.0](/gateway/install/) | SQLite, PostgreSQL or TimescaleDB | Edge, plus fleet, multi-site and scheduled reports |
| **HotLoop Edge Relay** | Yes, [4.17.0](/edge-relay/install/) | None, just a disk-backed forward queue | Headless poll and forward over Sparkplug B |

The database is going to be a setting, not a separate image: SQLite, PostgreSQL or TimescaleDB, picked at runtime, same binary. Today's Gateway runs on TimescaleDB, or plain PostgreSQL when the extension isn't there. SQLite is on its way, the pure Go one with no cgo, so the arm builds stay static and nobody needs a C compiler on a Pi.

## HotLoop IoT

The automation base, written in Go for the plant floor: entities, automations, helpers, scripts, recipes, blueprints, the logbook, dashboards, notifications, MCP, the ISA-18.2 alarm engine and backups, plus every industrial driver HotLoop has. We wrote all of it. None of it is embedded, bridged or forked from somebody else's project, so when it breaks at 3 AM there's exactly one codebase to dig through, and no upstream to file a bug with and then wait on.

On top of that comes MQTT discovery in the format Shelly, ESPHome, Tasmota and Zigbee2MQTT already publish, so those devices show up on their own instead of you typing topics.

**Not out yet, and there's no date.** IoT doesn't ship until MQTT discovery works, because an automation base that makes you hand-type the topics for a smart plug isn't finished. Here's where the rest of it stands inside the Gateway:

- **Already in 4.16.0:** entities and the ISA-95 equipment tree, automations, ISA-18.2 alarms, ntfy, Gotify, Discord, webhook and email paging, MCP, MQTT with an embedded broker, the seven industrial protocol drivers, and backups.
- **New in 4.17.0:** helpers, scripts, recipes, blueprints, the logbook, condition, wait and stop steps with `forSec` on state triggers, and the read-only half of a UniFi driver.
- **Not built:** dashboards and MQTT discovery.

## HotLoop Edge

IoT, plus what lives next to a machine. It's our answer to Ignition Edge: HMI screens for the touch panel on the machine, PLCs through the native drivers, CODESYS runtimes and Pi based PLCs over OPC UA or Modbus TCP, store-and-forward upstream over Sparkplug B, and an OPC UA server so the SCADA you already paid for can read every tag without a new driver.

**Not out yet.** It ships alongside IoT. Where the pieces stand:

- **Store-and-forward and the OPC UA server** are in the Gateway today, and Ignition 8.3.9 reads that OPC UA server end to end.
- **The native drivers** read and write PLCs today. S7comm and EtherNet/IP are decode tested and have never touched a physical PLC, so treat your first one as commissioning.
- **CODESYS and Pi PLCs** talk OPC UA or Modbus TCP, which HotLoop already speaks. Nobody has run one against a CODESYS runtime or a Pi PLC on the bench yet, and until somebody does, it works on paper.
- **HMI screens** aren't built. The plan is fixed canvas screens that never reflow, ISA-101 graphics, motor and valve faceplates, and a kiosk mode. A shared panel will sign operators in with a PIN or badge, because an audit row that says a panel opened the valve names nobody.

## HotLoop Gateway

Everything in Edge, plus what a site or a company of sites needs. All three were already in 4.16.0:

- **Fleet.** Tracks every registered Edge Relay from its Sparkplug births and deaths, and sends it a rebirth, a restart or a new device file, so nobody drives out to the box. It's API only (`/api/fleet`); there's no Fleet screen in the UI. A pushed device file finally lands in 4.17.0, on the relay's data volume. On 4.16.0 it died on a read-only mount while the Gateway said `config pushed`. [The Edge Relay overview](/edge-relay/overview/) has the details.
- **Multi-site.** One Gateway asks the others the question it would answer itself. A site that doesn't answer shows as unreachable, with the reason, and stays out of the totals. A plant you can't reach reported as "no alarms" is the most dangerous number a roll-up can show.
- **Scheduled reports.** Historian numbers on a schedule, as CSV or HTML, stored and emailed. Only good readings count, and every row says how many it threw out.

[Overview](/gateway/overview/), [install](/gateway/install/), [upgrading](/gateway/upgrading/).

## HotLoop Edge Relay

Poll, forward, and live through the uplink dying. It polls with the Gateway's drivers, forwards everything over Sparkplug B, and buffers to disk when the link is down. No database, no UI, no write path. It's its own binary, not Edge with the screen unplugged, and a test fails the build if the database or the web UI ever sneaks into it. [Overview](/edge-relay/overview/), [install](/edge-relay/install/).

## Moving between them

Every product runs on the same database schema, by design. Going from IoT to Edge to the Gateway is designed to be an image swap on the same database, with your devices, tags, entities, automations, alarms, history and users already there. Going back down deletes nothing: what the smaller product doesn't have sits there dormant until you come back. Outgrowing the Pi should cost you a pull, not a project.

That's the design, and nobody has run it yet, because the products haven't split. It gets proven with tests before IoT and Edge ship. Two more rules from the same plan. A Gateway-only setting on IoT or Edge will warn and keep running, and still show up in Settings, so nobody's left guessing why a setting they can see does nothing. And IoT will keep 30 days of history by default, because a Pi's SD card is not a historian.

## No keys, no tiers

There are no license keys and no runtime unlocks. What's in your image is what got compiled, so a feature that isn't there can't be switched on by accident, and nobody can switch one off later to squeeze you. All four are under the HotLoop Community License: free for individuals, and a business signs up for EmberNET free and uses them there free. [Licensing](/licensing/) has the terms, and [Using HotLoop in a business](/business/) has the two ways to do it.

[HotLoop Flow](/flow/overview/) is a separate product: a Node-RED compatible flow engine under Apache-2.0, free for everyone, businesses included, with no EmberNET sign-up. It doesn't talk to the lineup yet. For now they run side by side and share a broker if you give them one.
