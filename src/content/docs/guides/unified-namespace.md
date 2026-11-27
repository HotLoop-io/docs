---
title: "Unified namespace on Sparkplug B"
description: "Build a unified namespace with HotLoop: Edge Relays publish Sparkplug B from the machines, an MQTT broker is the hub, and the Gateway is the primary host."
sidebar:
  label: "Unified namespace"
---

A unified namespace is one place, usually an MQTT broker, where every machine publishes its data under a consistent name, so anything that needs a value reads it from there and not from the device. HotLoop gives you each role from parts that already ship.

| Role | HotLoop part | What it does |
|---|---|---|
| Edge node | [Edge Relay](/edge-relay/overview/) | Polls the machines and publishes them as Sparkplug B, with a disk queue for outages. |
| Hub | [The embedded broker](/iot/broker/), or your own | Carries the namespace. |
| Primary host | [Gateway](/gateway/overview/) | Tracks births and deaths, keeps the history, raises alarms, and writes readings to your database. |

## Step 1: pick the broker

For one plant and a handful of relays, the embedded broker is enough, on by default on port 1883. For several independent Sparkplug host applications, very high fan-out, bridging between sites, or clustering, run Mosquitto, EMQX, or another dedicated broker and point the Gateway and relays at it. [The broker page](/iot/broker/) draws the line.

## Step 2: put an Edge Relay on each machine

[Install the relay](/edge-relay/install/), set `edgePublish.broker`, a `edgePublish.group` for the plant, and a stable `edgePublish.node` name per machine. The group and node names become the first part of every topic, so choose them the way you want the namespace to read.

Each relay polls with the Gateway's own drivers, OPC UA, Modbus, EtherNet/IP, S7comm, MTConnect, and HTTP among them, and forwards as a Sparkplug B edge node. See [Modbus to MQTT](/guides/modbus-to-mqtt/) and [OPC UA to MQTT](/guides/opc-ua-to-mqtt/) for the device files.

## Step 3: make the Gateway the primary host

Add the broker as an MQTT device and read the namespace with `spb:` addresses.

```
spb:Plant|press-line-3||Node/Uptime       a node-level metric
spb:Plant|press-line-3|press-01|Zone1_Temp   a device metric
```

As a primary host the driver publishes a retained `STATE` birth with a matching will, so edge nodes can see the host drop and not infer it from a timeout. It tracks each node's rolling sequence number and asks a node to rebirth when one goes missing. [The protocols page](/iot/protocols/#mqtt-and-sparkplug-b) has the details.

## When the network drops

A relay queues readings to disk and replays them in order when the broker returns, each flagged `is_historical`, so the namespace ends up with the gap backfilled. The queue is capped at 64 MiB by default.

## Adding the next machine

A device file pushed from the Gateway applies live on a relay, with no restart, so adding a device is a change at the Gateway and not a visit to the box. [Fleet management](/gateway/fleet/) covers registering relays and pushing files.
