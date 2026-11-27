---
title: "Modbus to MQTT with the Edge Relay"
description: "Poll a Modbus TCP or RTU device and publish every reading to an MQTT broker as Sparkplug B, with the HotLoop Edge Relay, the Gateway, or a Flow."
sidebar:
  label: "Modbus to MQTT"
---

You have a meter, a drive, or a PLC that speaks Modbus, and something upstream that wants the values on MQTT. This is the shortest path with HotLoop, and it keeps working when the network does not.

There are three ways. Pick by what the box is for.

| Path | Use it when |
|---|---|
| [Edge Relay](/edge-relay/overview/) | You want a headless box at the machine that polls and forwards, with no database and no screen. |
| [Gateway, Edge, or IoT](/gateway/overview/) | You want screens, alarms, and a historian beside the polling, and a broker in the same process. |
| [Flow](/flow/overview/) | You want to wire it yourself, with a transform between the register and the topic. |

## With the Edge Relay

You need a broker to publish to and a Sparkplug group id. The relay reads one device file, and the device is a Modbus device by `protocol` and `address`.

```json
{
  "devices": [
    {
      "id": "meter-01",
      "name": "Line meter",
      "protocol": "modbus",
      "address": "10.0.1.50:502",
      "enabled": true,
      "pollIntervalMs": 1000
    }
  ],
  "tags": [
    {
      "deviceId": "meter-01",
      "name": "Voltage",
      "address": "holding:100:float32:CDAB",
      "dataType": "float",
      "enabled": true
    }
  ]
}
```

Install the relay with [Helm or Podman Quadlet](/edge-relay/install/) and point it at the broker. From then on every reading goes out as a Sparkplug B edge node, with births, sequence numbers, and deaths the way the specification says.

## Write the register address the way the manual prints it

Modbus mistakes are quiet. A float across two registers with the wrong word order is a plausible number that is not the truth, so read these four lines before you trust a screen.

```
holding:100:float32:CDAB    a float across registers 100-101, word-swapped
holding:40:bit3             bit 3 of register 40
input:12:int16              a signed input register
coil:5                      a single coil
```

- **Word order.** `ABCD`, `CDAB`, `BADC`, and `DCBA` are all supported. Set a device default with `byteOrder` and override per tag with the fourth field.
- **Numbering.** Addresses are raw and zero-based. If your drawings use 40001-style numbering, set `oneBased: true` and write the numbers from the drawings.
- **Blocks.** Adjacent and near-adjacent registers merge into one request, so sixty tags are a handful of reads.

The [protocols page](/iot/protocols/#modbus-tcprtu) has the whole reference, and says what the driver has been run against.

## When the uplink drops

The relay queues readings to a file on disk. When the broker returns, the queue drains oldest first before live readings go out, and each replayed reading is flagged `is_historical` so the host upstream does not take a replay for the tag's current value. The queue is capped at 64 MiB by default. Delivery is at least once, so whatever consumes it has to tolerate a duplicate after a crash mid-replay.

## With the Gateway and its own broker

HotLoop can run an MQTT broker in the same process, on by default, listening on port 1883. Add the Modbus device to the Gateway, and publish to that broker with [edge publish](/edge/edge-publish/) so a small install has nothing extra to deploy. For many sites or heavy fan-out, point it at Mosquitto, EMQX, or another dedicated broker. [The embedded broker page](/iot/broker/) says when to use which.

## With Flow

Flow has Modbus read and write nodes and MQTT 5 nodes, so the flow is a Modbus read, a Function or Change node if you want to reshape the value, and an MQTT out. [Quick start](/flow/quick-start/) gets Flow running.

## Where to go next

- [Build a unified namespace on Sparkplug B](/guides/unified-namespace/) with the same relay.
- [OPC UA to MQTT](/guides/opc-ua-to-mqtt/), for devices that speak OPC UA.
- [Install the Edge Relay](/edge-relay/install/).
