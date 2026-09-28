---
title: "HotLoop Edge Relay overview"
description: "A headless Sparkplug B edge node: polls with the Gateway's drivers, forwards upstream, buffers to disk when the link drops. No database, no UI."
sidebar:
  label: "Overview"
---

The Edge Relay is the headless one in the HotLoop lineup. It polls equipment with the same drivers the Gateway uses, forwards every reading over Sparkplug B to a Gateway somewhere with a real database, and queues to disk when the uplink goes away. No database, no web UI, no users and no write path. It's for a Pi or a small industrial PC sitting next to the machines.

4.16.0 is the first release that publishes it: `ghcr.io/hotloop-io/hotloop-edge-relay:4.16.0` for amd64 and arm64, about 15 MB, and the `hotloop-edge-relay` chart from `https://hotloop.io/hotloop`. It shares a version number with the Gateway, and a release refuses to go out unless both charts and the Quadlet unit carry the same one. [Install it](/edge-relay/install/).

## What it is not

**Not a smaller Gateway with the options turned off.** It's a different binary. It never links the database, the web UI and its auth, the automation engine, the entity registry or MCP, and a test asks `go list -deps` what the binary actually links and fails the build if one of those creeps in through a shared package. There's no mode switch buried in the Gateway, because a switch is one bad environment variable away from turning it all back on.

**Not able to take a write, serve a screen or answer an agent.** All three need a signed-in person to pin the action on, and this thing has no users at all. It reads and it forwards.

**Not configured at runtime.** Devices and tags come from one JSON file, read once at start. An edge box has one operator, who can edit a file and restart a service. The one other way in is the Gateway's fleet view pushing a new device file, and that still lands on disk and gets read at the next start.

## What it does

- **Polls** with the Gateway's own engine: the same workers, reconnect and back-off, and the same drivers for OPC UA, Modbus, MQTT and Sparkplug B, EtherNet/IP, S7comm, MTConnect and HTTP.
- **Forwards** as a Sparkplug B edge node: births, sequence numbers and deaths the way the spec says.
- **Survives the link dying.** Readings queue to a single file on disk and replay in order, flagged historical, when the broker comes back.
- **Answers two read-only endpoints** on port 8081: `/healthz` (the process is up) and `/status` (device counts by state, tag count, queue depth, compiled-in protocols). No tag values, no addresses, no config. Both are unauthenticated on purpose, so keep them behind the same perimeter as the box.
- **Takes orders from a Gateway.** Register a relay in the Gateway's fleet management and it tracks the relay from its births and deaths, and can send it a rebirth, a restart, or a new device file.

## What has and hasn't been proven

Tested end to end against a real Mosquitto broker, with a reading going through the whole binary and arriving as a correct Sparkplug B NDATA. The device on the other end of that test is an HTTP endpoint standing in for the plant. The other drivers are the same code the Gateway runs and tests, but this binary hasn't been pointed at real OPC UA, Modbus, EtherNet/IP or S7comm hardware yet, and it hasn't been run against a certified Sparkplug host application. When it has, this page will say so.

## License

The Edge Relay is under the HotLoop Community License, like the rest of the lineup except Flow. Free for individual use, and business use is free through EmberNET. See [Licensing](/licensing/).
