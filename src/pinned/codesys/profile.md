---
title: "The profile"
description: "The one input to HotLoop for CODESYS: a JSON file with a revision, the device and its variables, the alarms, and one screen, and how the provisioner applies it."
sidebar:
  label: "The profile"
---

{{codesysNotice}}

A profile is one JSON file in a Secret in the install's namespace, under the key `profile.json`. It is not in the chart or in the provisioner image, so both are generic and public, and nothing in either names anyone's variables. Whoever installs the app gives it. On EmberNet the Store writes it as `<release>-profile`.

The provisioner reads it again at every pass, so a newer profile reaches a running install without a restart.

## The shape

| Key | What it holds |
|---|---|
| `revision` | A whole number from 1. The screen and the alarms are replaced only when this is higher than the revision that made them. |
| `device` | `id`, `name`, `options` (the connector's options, such as `browseRoot`, `arrayElements`, and `browseMaxNodes`), and `points`, the variable names HotLoop keeps from the PLC. |
| `devices` | Optional. A list of devices of any protocol HotLoop speaks, beside `device` or instead of it. See below. |
| `alarms` | HotLoop alarm definitions, each with an `id`. |
| `dashboard` | One HotLoop screen, with an `id`. A [dashboard](/iot/dashboards/) is a list of cards. |

One profile makes one screen, and the one `device` it names, plus any `devices` it lists.

## An example

This is the profile behind the screenshots on the [overview](/codesys/overview/), against HotLoop's lab program. `GVL_Demo` is the lab program's variable list, and the labels are made up.

```json
{
  "revision": 2,
  "device": {
    "id": "line-2",
    "name": "Line 2 PLC",
    "options": {"browseRoot": "Application.GVL_Demo", "arrayElements": 4, "browseMaxNodes": 500},
    "points": ["GVL_Demo.bRun", "GVL_Demo.rTemp", "GVL_Demo.udiCycles", "GVL_Demo.nEcho", "GVL_Demo.rEcho", "GVL_Demo.rReadOnly"]
  },
  "alarms": [
    {"id": "line-2-mixer-hot", "name": "Mixer temperature high", "tagName": "GVL_Demo.rTemp", "condition": "hi", "limit": 20, "deadband": 0.5, "priority": 2, "message": "{device}/{tag} at {value}, limit {limit}"}
  ],
  "dashboard": {
    "id": "line-2-screen", "name": "Line 2", "description": "The Line 2 screen.", "kind": "cards", "roles": [], "homeFor": [], "screens": [],
    "cards": [
      {"id": "t", "type": "value", "title": "Mixer temperature", "w": 3, "h": 2, "config": {"tag": "line-2/GVL_Demo.rTemp", "decimals": 1}},
      {"id": "tr", "type": "trend", "title": "Mixer temperature, last 15 minutes", "w": 6, "h": 3, "config": {"tags": ["line-2/GVL_Demo.rTemp"], "minutes": 15}},
      {"id": "al", "type": "alarms", "title": "Line 2 alarms", "w": 6, "h": 3, "config": {"outstanding": true, "limit": 8}}
    ]
  }
}
```

A card's `tag` is the device id, a slash, and the point's name. The card types, the alarm conditions, and the rest of a screen's keys are the same as in HotLoop's [dashboards](/iot/dashboards/) and [the HTTP API](/iot/api/).

## A list of devices

A profile can also carry `devices`, a list of devices of any protocol HotLoop speaks, beside `device` or instead of it. Each entry is the body of HotLoop's `POST /api/devices` (`id`, `name`, `protocol`, `address`, `enabled`, `pollIntervalMs`, `timeoutMs` and `config`, the protocol's own block) with its `tags`, the descriptors of `POST /api/devices/{id}/import` (`name`, `address`, `dataType`, and optionally `unit`, `description`, `deviceClass`). That covers OPC UA PubSub (UADP) listeners with their RawData `dataSets`, an OPC UA client, and several devices in one profile. At every pass:

- A device HotLoop lacks is made, and one it has is left alone, so a person's edit stays, until the profile's `revision` is higher than the one that made the device (the device's description carries the marker), when the profile's definition replaces it.
- Every tag of the profile that the device lacks is imported, in one request per device, read-only.
- None of it waits on the node's OPC UA server. A listener only listens, and a runtime that is down or restarting holds nothing else back. The single `device` still reads the runtime, and a pass with it down says so and tries again.
- With `devices` absent the profile works exactly as before, and with both present both apply.

A listener that has to hear its node's own multicast, a PLC runtime on the same box publishing to a group over the loopback, needs the pod on the node's network: set `hotloop-edge.hostNetwork: true` and `"interface": "127.0.0.1"` in the device's options. It is off by default, and [the 4.19.2 notes](/releases/hotloop-4-19-2/) say what it means for the pod.

## What the provisioner does with it

- **It makes the device** if there isn't one, and adds any variable of `points` that the PLC has and the device does not.
- **It never writes to the PLC.** Every tag it makes is read-only, and a profile has no way to mark one writable.
- **It makes the alarms and the screen** when they are missing, and replaces them only when `revision` is higher than the one that made them. A change a person made to the screen in HotLoop therefore survives until a newer profile ships on purpose.
- **It keeps looking.** Every five minutes, and sooner after a pass that could not finish, because the runtime or HotLoop was not answering yet.
