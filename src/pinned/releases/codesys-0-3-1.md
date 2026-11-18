---
title: "HotLoop for CODESYS 0.3.1 release notes"
description: "Chart 0.3.1 of HotLoop for CODESYS: the provisioner finds HotLoop's Service and Secret by the release name, so any release name installs."
sidebar:
  label: "0.3.1"
---

## What changed

0.3.1 is in the index at `{{codesysChartRepo}}`, published on 2026-11-05, and it is the chart to install. It still wraps HotLoop 4.19.4 and runs provisioner 0.3.0, which pulls with no login.

- **Any release name installs.** The provisioner now finds HotLoop's Service and its credentials Secret by the naming HotLoop's own chart uses, which is the release name. The old rule guessed a different name for a release without `hotloop-codesys` in it, and the HotLoop pod did not have that name.
- **The example profile is right.** `example-devices.json` no longer lists Variant as a RawData type, because it is not one.
- **Everything in [0.3.0](/releases/codesys-0-3-0/) is still here**, nothing writes to the PLC, and every earlier chart stays in the index.

What it means for you: name the release whatever you like, and the provisioner finds the thing it has to talk to.

## What was checked

The chart renders from the live index with Helm, and it has been run on bare metal (2026-11-17). [Where it stands](/codesys/where-it-stands/) says what it was run against.
