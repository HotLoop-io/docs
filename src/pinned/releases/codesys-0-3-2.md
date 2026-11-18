---
title: "HotLoop for CODESYS 0.3.2 release notes"
description: "Chart 0.3.2 of HotLoop for CODESYS: it wraps HotLoop 4.19.11, and HotLoop takes port 8090 so it runs beside a runtime on the node's network."
sidebar:
  label: "0.3.2"
---

## What changed

0.3.2 is in the index at `{{codesysChartRepo}}`, published on 2026-11-15, and the provisioner image it runs pulls with no login. Nothing in it writes to the PLC.

- **It wraps HotLoop 4.19.11** and runs the 0.3.1 provisioner.
- **HotLoop's page listens on 8090 inside the pod.** A runtime on the node's network holds host port 8080, and the scheduler refused to place HotLoop's page beside it. The Service stays on 8080, so the App Store tile and the provisioner reach HotLoop as before. Anything that talked to the pod directly on 8080 moves to 8090.
- **The provisioner refuses a profile that puts two OPC UA PubSub listeners on one UDP port.** HotLoop binds a port exclusively, so the second device sat connecting with "address already in use". Now the provisioner says so up front.
- **Every earlier chart stays in the index.**

What it means for you: a CODESYS runtime on the node's own network and HotLoop run side by side on one node.

## What was checked

The chart renders from the live index with Helm, and it has been run on bare metal (2026-11-17). [Where it stands](/codesys/where-it-stands/) says what it was run against.
