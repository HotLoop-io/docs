---
title: "Where HotLoop for CODESYS stands"
description: "What HotLoop for CODESYS has been run against, what it has not, and what has to ship before you can install it."
sidebar:
  label: "Where it stands"
---

{{codesysNotice}}

A doc that rounds up is how somebody finds out at commissioning, so this page is the whole list.

## What is true today

HotLoop for CODESYS is built and has been run against a real runtime in the lab. It is not published. To install it, three things have to ship, and none of them has:

- **HotLoop {{codesysNeeds}}.** The CODESYS connector is in HotLoop core's main branch for that release, and the chart depends on the `hotloop-edge` chart on the `~{{codesysNeeds}}` line.
- **The chart.** `{{codesysChartRepo}}` answers and lists no chart yet.
- **The release itself:** the notes, and the version. The first version is [{{codesys}}](/releases/codesys-0-3-0/).

## What was run

In the lab, the chart on a k3s v1.36 node with Store-shaped values, a real CODESYS Control for Linux SL 4.22.0.0 runtime on the same node running HotLoop's own lab program (built with the CODESYS ScriptEngine), and a HotLoop Edge image built from HotLoop's main branch.

- The device, its tags (none writable), its alarm, and its screen appeared with no hand step.
- Every value read good and moved.
- The pods came back after a pod delete.
- The install read bad with the reason "the PLC's runtime is not answering" through a runtime restart, and came back by itself about 88 seconds after.
- A signed sign-in from the dashboard signed a person in as an operator or an admin, and a wrong app, a wrong tenant, an expired one, a wrong issuer, and a tampered one were each refused.

The connector under it, HotLoop core's CODESYS driver, is verified live against a CODESYS Control for Linux SL 4.22.0.0 runtime in a container, for reads and writes, and not on a physical controller. Writes are there in the connector, and this product never turns them on.

## What was not

- An install from the real App Store page. The Store's code was changed and tested, and no Store has listed the chart, because it is not published.
- A physical controller. The only runtime it has met is a container.
- k3s v1.35.7. The lab is v1.36.
- A node actually losing its link to the control plane. The tolerations are in the pods, and the link was not cut.
- A download from the CODESYS IDE while the runtime stays up. The lab replaces the runtime process.
- A hostNetwork runtime and the HotLoop pod on one node. The lab runtime is a container on the node's own network, reached at the node's address.
- A runtime with user management on, or a certificate-secured OPC UA endpoint.

## What a profile can't do yet

One profile makes one device and one screen. There is no way to mark a variable writable from it, on purpose.
