---
title: "HotLoop for CODESYS 0.3.0 release notes"
description: "The first published chart of HotLoop for CODESYS: what it holds, what it wraps, and how far it has been run."
sidebar:
  label: "0.3.0"
---

## What this is

0.3.0 is the first chart of HotLoop for CODESYS in the index at `{{codesysChartRepo}}`, published on 2026-11-05: HotLoop Edge beside a CODESYS runtime, set up from a profile with nobody clicking. It wraps HotLoop 4.19.4 and runs provisioner 0.3.0. [0.3.1](/releases/codesys-0-3-1/) came the same day and is the one to install.

- **A chart that wraps HotLoop Edge**, with defaults for a runtime on the same node: SQLite on the node's own storage, no database pod, one replica, and the OPC UA server, the broker, edge publishing, and backups off.
- **A provisioner**, one static Go binary and a public image, that reads a [profile](/codesys/profile/) (the device, the variables to keep, the alarms, and one screen) and sets all of it up once the PLC's runtime answers. It looks again every five minutes.
- **A list of devices in a profile.** A profile can carry `devices`, of any protocol HotLoop speaks, so an OPC UA PubSub listener comes back configured with no PLC needed. A profile with one `device` reads exactly as before.
- **A PLC that changes is followed.** A variable the profile lists that the PLC has gained since is added. One the PLC lost reads bad with the server's reason. The screen and the alarms are replaced only when the profile's revision is higher.
- **Nothing writes to the PLC.** Every tag the provisioner sets up is read-only.
- **Both pods tolerate an unreachable or not-ready node** with no time limit.
- **hostNetwork**, off by default, for a pod that has to hear a publisher's multicast on the node's own cards.
- **Sign-in from the EmberCORE dashboard** comes from the Edge chart's 4.19 sign-in, and this chart inherits it.

## How far it was run

It has been run on bare metal (2026-11-17). [Where it stands](/codesys/where-it-stands/) says what it was run against.
