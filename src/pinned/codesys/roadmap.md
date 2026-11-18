---
title: "HotLoop for CODESYS roadmap"
description: "What HotLoop for CODESYS has built, published and run on real hardware."
sidebar:
  label: "Roadmap"
---

This is the list of what is done and what is left, in the order it gets done. It promises nothing that isn't in the code or in a test plan, and [Where it stands](/codesys/where-it-stands/) says how far it has been run.

## Built

- [x] A chart around HotLoop Edge with defaults for a runtime on a node: SQLite, one replica, tolerations that keep both pods through a lost control plane.
- [x] A provisioner that applies a profile and keeps it right, with a revision that protects what a person changed.
- [x] A profile that carries a list of devices of any protocol HotLoop speaks, so a listener comes back configured with no PLC needed.
- [x] The device, tags, alarm, and screen made with no hand step, against a CODESYS Control for Linux SL 4.22.0.0 runtime in a container.
- [x] Recovery from a runtime restart with no hands, about 88 seconds.
- [x] A signed sign-in from the EmberCORE dashboard, with the refusals.

## Shipped

- [x] HotLoop {{codesysNeeds}}, the release the chart wraps.
- [x] The chart published at `{{codesysChartRepo}}`, {{codesys}} the newest.
- [x] The provisioner image public, so it pulls with no login.
- [x] [Release notes](/releases/codesys-0-3-1/) for both charts.

## Proven on bare metal

- [x] Run on bare metal (2026-11-17), including an install from the real App Store page as staff do it, k3s v1.35.7, a node that really loses its link to the control plane with the pods kept, a download from the CODESYS IDE while the runtime stays up, a runtime on the host's own network beside the HotLoop pod on one node, and a runtime with user management on and a certificate-secured OPC UA endpoint.

## To build

- [ ] A multi-arch provisioner image. It is amd64 only today.

