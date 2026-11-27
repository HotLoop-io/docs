---
title: "OPC UA to MQTT as Sparkplug B"
description: "Read an OPC UA server by subscription and publish it to an MQTT broker as Sparkplug B with the HotLoop Edge Relay, then bring it back as OPC UA for your SCADA."
sidebar:
  label: "OPC UA to MQTT"
---

A machine offers an OPC UA server. The rest of the plant wants the values on MQTT. HotLoop reads the server by subscription and republishes it as Sparkplug B, and it can serve the same values back out as OPC UA for a SCADA.

## Point the Edge Relay at the server

The device file names the server and the node ids to read.

```json
{
  "devices": [
    {
      "id": "press-01",
      "name": "Press 1",
      "protocol": "opcua",
      "address": "opc.tcp://press-01.local:4840",
      "enabled": true,
      "pollIntervalMs": 1000
    }
  ],
  "tags": [
    {
      "deviceId": "press-01",
      "name": "Zone1_Temp",
      "address": "ns=2;s=Zone1.Temp",
      "dataType": "float",
      "enabled": true
    }
  ]
}
```

[Install the relay](/edge-relay/install/) with Helm or Podman Quadlet, name your broker and group, and the tags appear as a Sparkplug B edge node.

## It subscribes, it does not poll

The OPC UA driver asks the server to send a value when it changes, at a rate the server can sustain, instead of asking the same question every scan. If a server refuses a subscription, the driver falls back to batched reads rather than failing the device. If a subscription delivers nothing at all, it falls back to reads until the device next reconnects, so a setpoint never reads bad because a first publish was lost.

## Secured servers

The driver was run against Ignition 8.3.9 in both directions with a user name and password over a secured channel. A secured server's certificate and trust store live in the relay's data volume, so they survive the pod moving. [The protocols page](/iot/protocols/#opc-ua) lists what else it was run against.

## Bring it back as OPC UA

HotLoop Edge and the Gateway run an [OPC UA server](/edge/opc-ua-server/) of their own, so a SCADA can read what they collect from devices that never spoke OPC UA. You can use the Gateway as the one OPC UA endpoint for a whole line.

## Where to go next

- [Modbus to MQTT](/guides/modbus-to-mqtt/), for devices that speak Modbus.
- [A unified namespace on Sparkplug B](/guides/unified-namespace/).
- [Edge publish and store-and-forward](/edge/edge-publish/).
