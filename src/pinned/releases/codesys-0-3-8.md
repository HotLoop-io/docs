---
title: "HotLoop for CODESYS 0.3.8 release notes"
description: "Chart 0.3.8 of HotLoop for CODESYS: the provisioner image it runs is 0.3.3, built for amd64 and arm64."
sidebar:
  label: "0.3.8"
---

## What changed

0.3.8 is in the index at `{{codesysChartRepo}}`, published on 2026-11-19.

- **It runs provisioner 0.3.3,** the first provisioner image built for amd64 and for arm64, so the chart installs on an arm64 node.
- **Nothing else changed.** The templates, the values and the HotLoop it wraps (4.22.0) are those of [0.3.7](/releases/codesys-0-3-7/).

What it means for you: install this one. On an amd64 node nothing is different.

## What was checked

The published chart's values read the 0.3.3 provisioner and HotLoop 4.22.0, and the 0.3.3 image index lists amd64 and arm64. The chart was not reinstalled on a cluster for this release, because only the image tag moved.
