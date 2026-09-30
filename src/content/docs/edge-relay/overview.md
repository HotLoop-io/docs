---
title: "HotLoop Edge Relay overview"
description: "A headless Sparkplug B edge node. It polls with the Gateway's drivers, forwards upstream, and buffers to disk when the link drops. No database, no UI."
sidebar:
  label: "Overview"
---

The Edge Relay is the headless one. It sits on a Pi or a small industrial PC next to the machines, polls them with the same drivers the Gateway uses, and forwards every reading over Sparkplug B to a Gateway somewhere with a real database. When the uplink dies it queues to disk and replays when the link comes back, so the historian upstream ends up with the outage backfilled, not a hole in it. No database, no web UI, no users, no write path, and every one of those missing pieces is something that can't break at 3 AM.

The current release is 4.17.0: `ghcr.io/hotloop-io/hotloop-edge-relay:4.17.0` for amd64 and arm64, about 15 MB, pulled with no login, and the `hotloop-edge-relay` chart from `https://hotloop.io/hotloop`. 4.16.0 was the first release that published it. It shares a version number with the Gateway, and a release refuses to go out unless both charts and the Quadlet unit carry the same one. So the relay gets a new version every release whether its code changed or not. One version number to ask about, and a relay chart can never point at an image nobody pushed. [Install it](/edge-relay/install/).

:::note[Fixed in 4.17.0]
**A device file pushed from the Gateway lands now.** On 4.16.0, a relay installed from the chart or the Quadlet unit wrote the push next to its local device file, and both installs mount that read-only. It logged `a pushed config was rejected` with `read-only file system` and kept polling the old list, while the Gateway cheerfully answered `config pushed`. In 4.17.0 a push goes to `/data/pushed-devices.json` on the relay's volume, and it wins over the local file until somebody clears it.

**`persistence.enabled=false` boots.** On 4.16.0 nothing was mounted at `/data`, the root filesystem is read-only, and the relay died with `open forward queue at /data/forward.db: no such file or directory`. In 4.17.0 it runs on an emptyDir, and [Install](/edge-relay/install/#the-forward-queue-and-its-volume) says what that costs you.

Still on 4.16.0? [Upgrading from 4.16.0](/gateway/upgrading/#the-edge-relay) has the relay's part, including the stale push a broker may hand back at first boot.
:::

## What it is not

**Not a smaller Gateway with the options turned off.** It's a different binary. It never links the database, the web UI and its auth, the automation engine, the entity registry or MCP, and a test asks `go list -deps` what the binary actually links and fails if any of them sneaks in through a shared package. There's no relay mode hiding in the Gateway, because a mode is a switch, and a switch can get flipped by one bad environment variable on a box nobody's watching. A package that was never linked can't be flipped on.

**Not able to take a write, serve a screen or answer an agent.** All three need a signed-in person to pin the action on, and this thing has no users at all. It reads and it forwards, and that's the whole job.

**Not configured at runtime.** Devices and tags come from one JSON file, read once at start. An edge box has one operator who can edit a file and restart a service, and that's harder to get wrong than any live reload anybody could bolt on. The one other way in is a device file pushed from the Gateway, which still only lands on disk and gets read at the next start.

## What it does

- **Polls** with the Gateway's own engine: the same workers, the same reconnect and back-off, and the same drivers for OPC UA, Modbus, MQTT and Sparkplug B, EtherNet/IP, S7comm, MTConnect and HTTP. Since 4.17.0 it can poll a UniFi console too, read-only: the tags its device file declares, and of the client work only the per-network client counts, with no OT watch. A driver bug fixed in the Gateway is fixed here.
- **Forwards** as a Sparkplug B edge node: births, sequence numbers and deaths the way the spec says.
- **Survives the link dying.** Readings queue to a single file on disk. When the broker comes back the queue drains before any live reading goes out, oldest first, each one flagged `is_historical` so the host upstream doesn't mistake a replay for the tag's current value. Delivery is at least once, so whatever consumes it has to tolerate a duplicate after a crash mid-replay. The queue is unbounded by default, which means a long enough outage fills its volume. [Install](/edge-relay/install/) says how to cap it.
- **Answers two read-only endpoints** on port 8081: `/healthz` (the process is up) and `/status` (device counts by connection state, tag count, queue depth, compiled-in protocols). No tag values, no addresses, no config. Both are unauthenticated on purpose: there's no user database to hang a login on, and one shared token would be theater, not security. Keep them behind the same perimeter as the box.
- **Takes orders from a Gateway.** Register a relay with the Gateway's fleet management (API only, there's no Fleet screen) and the Gateway tracks it from its births and deaths, and can send it a rebirth, a restart, or a new device file. A push only stages the file. The relay picks it up at its next restart, which is a separate command on purpose, because a config push that quietly restarts equipment monitoring is a surprise nobody asked for.

## Who gets to command it

Nothing on the relay decides who may restart it or push it a device file. The Gateway checks at its API: `fleet.rebirth` for a rebirth, and `fleet.restart` and `fleet.config` for a restart and a push, both admin only. But the commands travel over the broker, so anything that can publish to the relay's Sparkplug NCMD topic or to `hotloop/edge-relay-config/#` can do exactly what the Gateway does.

So lock the broker down. Its ACL should let only the Gateway's own credentials publish NCMD and the config topic. And put TLS on the broker before you push a device file with passwords in it: a push is published retained, and anyone who can subscribe to that topic can read every credential in the file.

## What has and hasn't been proven

Tested end to end against a real Mosquitto broker, with a reading going through the whole binary and arriving at a plain MQTT subscriber as a correctly valued Sparkplug B NDATA. The device on the other end of that test is an HTTP endpoint standing in for the plant.

Fleet commands and config push were tested against the same real broker, including a push retained before the relay even started, run through the compiled binary to prove it boots from it. That test ran with a writable device file, and the read-only mount in both real installs is exactly what it couldn't see, which is how 4.16.0 shipped a push that never landed. Since 4.17.0, CI renders both installs and fails if a pushed file has nowhere writable and persistent to land.

Not yet: this binary hasn't been pointed at real OPC UA, Modbus, EtherNet/IP or S7comm hardware. Those drivers are the same code the Gateway runs and tests, but "same code" isn't a value off a real controller. It hasn't been run against a certified Sparkplug host application, and nobody has checked the fleet commands against a real broker ACL. When any of that happens, this page will say so.

## License

The Edge Relay is under the HotLoop Community License, like the rest of the lineup except Flow. Free for individual use, and a business signs up for EmberNET free and uses it there free. See [Licensing](/licensing/).
