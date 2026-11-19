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
- [x] The provisioner image public, so it pulls with no login, 0.3.3.
- [x] A multi-arch provisioner image, amd64 and arm64, from 0.3.3 and chart 0.3.8.
- [x] Two OPC UA PubSub listeners on one UDP port, with HotLoop 4.22.0 and chart 0.3.7.
- [x] [Release notes](/releases/codesys-0-3-8/) for every chart, 0.3.0 to 0.3.8.

## Not run yet

- [ ] A secured, user-managed runtime read end to end.
- [ ] A download from the CODESYS IDE while the runtime stays up.
- [ ] A program running on the arm64 runtime.

## To build

- [ ] More than one screen in a profile.

