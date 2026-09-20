---
title: "HotLoop Flow overview"
description: A Node-RED-compatible flow engine in one static Go binary, with bounded queues, a goroutine per node, and a license that lets anyone run it.
sidebar:
  label: "Overview"
---

:::note[Renamed from Emberwire]
Version 2.0.1 is current, and 2.0.0 was the first release under the HotLoop Flow name. Version 0.1.0 was published as Emberwire, and 2.x does not keep the old names working. The [install page](/flow/install/) has the commands, and the [release notes](https://hotloop.io/releases/flow/) list everything that a saved flow, a WASM module, or a credentials file from 0.1.0 needs redone.
:::

HotLoop Flow is a flow engine in Go, and Node-RED's idea with a different runtime. It is one static binary, with an editor of its own and a scheduler that holds up when a sensor starts talking faster than the thing reading it.

**Your flow files stay Node-RED v1 compatible.** Point it at a `flows.json` and it runs.

## Why it exists

Node-RED works, and that is the irritating part, because "it works" is where most people stop looking. It is 717 MB as a container image. It runs one single-threaded event loop for the runtime, the editor, the websockets, and every node's I/O at once. And several of its defaults were built for a workshop, not for a customer's plant floor. Flow keeps the idea and rebuilds the parts that fail in production.

The measured comparison, with its caveats, is on the [Flow page of the main site](https://hotloop.io/flow/#numbers). The short version is a 25.1 MB image against 717 MB, and 4.8 MB of memory at idle against 54.6 MB. Those numbers come from one box in one run, and that page spends three paragraphs on what they are not allowed to claim.

## What is in these docs

- [Security posture](/flow/security/) covers the four places where "anyone who can edit a flow" stops being a synonym for "anyone who owns the box."
- [Back-pressure and bounded queues](/flow/back-pressure/) covers the throughline of the whole project: everything unbounded in Node-RED is bounded here, visibly.
- [Compatibility](/flow/compatibility/) covers what loads, what loads byte for byte, and what is refused.
- [Migrating from Node-RED](/flow/migrating-from-node-red/) is the page to read if you have flows already.

## Where it stands

It runs. It starts, serves the API and the editor, loads flows from its data directory, moves messages, and survives a restart. It has been verified against real infrastructure and not merely against its own encoders: MQTT, InfluxDB 2.7, and PostgreSQL 16. The race detector is clean on every package.

**It has never run on a real plant floor.** Everything past the deploy line is unproven in the field, and it will not be described as production-hardened until a plant has tried to break it.

## License

Apache-2.0. A business can run it, modify it, and ship it commercially without asking anyone. See [Licensing](/licensing/).
