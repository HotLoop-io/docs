---
title: "HotLoop Flow overview"
description: "Node-RED's idea on a Go runtime: one static binary, a ceiling on every queue, a goroutine per node, no start without a login, and Apache-2.0 for all."
sidebar:
  label: "Overview"
---

:::note[Renamed from Emberwire]
2.0.5 is current, and 2.0.0 was the first release under the HotLoop Flow name. Before that it was Emberwire 0.1.0, and 2.x reads nothing the old name wrote: the `EMBERWIRE_*` variables, the two `emberwire-` database node types, WASM modules built against the old exports and the 0.1.0 credentials file all have to be redone. The [install page](/flow/install/) has the commands, and the [release notes](https://hotloop.io/releases/flow/) list every break.
:::

HotLoop Flow is a visual flow engine for the plant floor, written in Go. It's Node-RED's idea on a different runtime: one static binary, an editor of its own, and a scheduler that stays upright when a sensor gets chattier than whatever is reading it.

**Your flows come with you.** Point it at a Node-RED v1 `flows.json` and it runs, and saving it without touching anything hands back the exact same bytes. Before you trust that with a line, `hotloop-flow import flows.json` lists every node type in the file as supported, partly supported with the gap written out, or not supported. Better to learn that at your desk than from a stopped line.

## Why it exists

Node-RED sat in our own App Store for a year. It works. That's the problem, because once something works, nobody opens the hood again. Open it:

- **The image is 717 MB.**
- **Everything shares one thread.** The runtime, the editor, the websockets and all node I/O run on a single event loop. One heavy Function node stalls the lot, the editor included, which is the exact tool you'd open to figure out what's wrong.
- **Nothing caps the queue between a fast sensor and a slow database.** It keeps growing until the kubelet shoots the pod, and the log explains nothing to whoever's holding the pager.
- **Authentication is off by default**, and the `exec` node is sitting right there in the palette.

Not one of those can be fixed with configuration, and anything that could have been fixed in a config file would have been. So Flow keeps the idea and rebuilds everything underneath it.

## The numbers

Both runtimes in rootless Podman on one box, the same five-node flow deployed to each unchanged, driven by the same load generator in the same sitting on 2026-08-08. Linux, 12 CPUs, 8 connections, 30 seconds.

| Measure | HotLoop Flow | Node-RED |
|---|---|---|
| Image size | 25.1 MB | 717 MB |
| Throughput | 3,460 req/s | 1,290 req/s |
| Latency p50 | 1.03 ms | 4.61 ms |
| Latency p99 | 16.72 ms | 23.14 ms |
| Cold start | 2.1 to 2.3 s | 4.6 to 5.5 s |

Now the part most benchmark tables leave out:

- **Cold start.** About two seconds of each row is Podman bringing up a container, a cost both runtimes pay. The part that's actually Flow's is the gap, 2.3 to 3.4 seconds, not the ratio.
- **Throughput isn't a scheduler benchmark.** It runs through the whole HTTP stack, because that's the only surface both runtimes present the same way. It tells you what a client of your flow sees, not whose scheduler is faster.
- **The tail is only 1.4 times better.** Under saturation both runtimes queue, and queueing owns p99. The median is where the cost of actually handling a request shows up, and that's where the gap is.

There used to be a memory row here too: 4.8 MB idle. It's gone. It came off `podman stats`, which reports what the kernel charges the container rather than what the process holds, and nobody could reproduce it, including us. Measured on the native binary instead, Flow's process holds 16.6 MiB idle and 26.6 MiB at peak under load. There's no Node-RED column for that, because nobody has measured Node-RED the same way on the same box yet, and dividing a native process figure by a `podman stats` one would be the same mistake all over again.

Every figure came out of `hotloop-flow bench`, which ships in the binary, so go run it on your own hardware and argue with us. The method, the flow file and the exact commands are in [the Flow README](https://github.com/HotLoop-io/hotloop-flow#the-numbers).

## What's in these docs

- [Install](/flow/install/): Podman, Quadlet, Helm or source. It starts locked, so the page starts with the password.
- [Security posture](/flow/security/): where "anyone who can edit a flow" stops meaning "anyone who owns the box."
- [Back-pressure and bounded queues](/flow/back-pressure/): the whole point of the project. Everything unbounded in Node-RED has a ceiling here, and hitting it is loud.
- [Compatibility](/flow/compatibility/): what loads byte for byte, where each of the 51 node types stands, and what's refused.
- [Migrating from Node-RED](/flow/migrating-from-node-red/): the order to do it in if you have flows already.

## Where it stands

**It runs.** It starts, serves the API and the editor, loads flows from its data directory, moves messages, and comes back after a restart with its flows and credentials. Not its context, though. Context lives in memory only, so flow and global context are gone every time the process restarts.

**Checked against real services**, not only against its own encoders: Mosquitto, InfluxDB 2.7 and PostgreSQL 16, in Podman, on 2026-08-07. An InfluxDB tag value came back out of the real database as `press 01,west`, space and comma intact. Get that escaping wrong and a series fragments in silence, and somebody loses a day finding out why. That run predates the rename, and the only change to those nodes since is their names.

**The race detector is clean** on every package, on every push to main and every pull request.

**Not done yet**, worst first:

- **Partial deploy.** Every deploy restarts every node, changed or not. All the MQTT connections drop and come back, and any messages a Delay node was holding go out early. Until that's fixed, don't deploy mid-shift.
- **Persistent context.** Memory only. A counter or a latch in a flow resets every time the pod moves. Node-RED has a file-backed store and Flow has nothing yet.
- **A node that uses the WASM sandbox.** The host is built and tested, and nothing in the palette calls it, so you can't run a WASM guest in a flow today.
- **Link Call, and Link Out's return mode.** Refused with an error rather than silently doing nothing. Right behavior, still a gap.
- **JSONata.** Every `jsonata`-typed property is refused, so a node that uses one errors on every message. Imported flows hit this more than anything else.
- **Cron-style Inject.** Interval and on-startup injection work. "At 06:00 on weekdays" doesn't: a cron-scheduled Inject loads without complaint and then just never fires. The import report's note on Inject tells you. The running flow won't.
- **Editor click-through for the newer nodes.** The HTTP, WebSocket, TCP and UDP dialogs render from each node's descriptor, and nobody has clicked through them by hand yet.
- **Multipart uploads on HTTP In, and cookies on HTTP Response.** A multipart body arrives as raw bytes, not `msg.files`, and `msg.cookies` does nothing, so set a `Set-Cookie` header.

**It has never run on a real plant floor.** Nothing past the deploy line has been proven in the field, and nobody gets to call it production-hardened until a plant has tried hard to break it.

What gets built next is in the [roadmap](https://github.com/HotLoop-io/hotloop-flow/blob/main/docs/ROADMAP.md): deploy history and rollback first, then flow tests, tracing, durable state, and nodes for the PLCs that `scan` can already find. None of it starts until HotLoop's own roadmap is done. If one of the gaps above blocks you, work around it. Don't wait on a date, because there isn't one.

## Flow and the rest of HotLoop

Flow doesn't talk to the Gateway or the Edge Relay yet. They run side by side and share a broker if you give them one, and that's it. HotLoop nodes, where every command a flow sends goes through HotLoop's write gate and lands in its logbook, are on the roadmap.

## License

Apache-2.0, the same terms for a business as for anyone. Use it at work, put it in something you sell, fork it. There's no EmberNET sign-up anywhere, and the Community License has nothing to say about it. Flow is an independent implementation and contains no Node-RED source. See [Licensing](/licensing/).
