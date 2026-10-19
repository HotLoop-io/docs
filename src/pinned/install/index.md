---
title: "Install HotLoop"
description: "How every HotLoop product installs: Helm on k3s or any Kubernetes, or Podman Quadlet on a box, with boxes that follow the stable tag and update themselves."
sidebar:
  label: "Install"
---

There are two ways to run a HotLoop product for real: Helm on k3s or any Kubernetes, or Podman with Quadlet on a box that isn't in a cluster. No Docker, no Compose, and no bare `podman run` from a shell that dies with the session. A plain `podman run` is fine to kick the tires, and Flow's page says so, but it isn't an install.

## Pick the way

| You have | Use | Page |
|---|---|---|
| A k3s or Kubernetes cluster | Helm | [k3s and Helm](/install/helm/) |
| A Pi, a NUC or a small industrial PC, no cluster | Podman Quadlet | [Podman Quadlet](/install/quadlet/) |
| Either, and you want to know how updates behave | | [The :stable auto-update](/install/auto-update/) |

## What you can install today

| Product | Latest release | Helm | Quadlet | Start here |
|---|---|---|---|---|
| [HotLoop Gateway](/gateway/overview/) | {{hotloop}} | Yes | On `main`, next release | [Install the Gateway](/gateway/install/) |
| [HotLoop Edge Relay](/edge-relay/overview/) | {{hotloop}} | Yes | Yes | [Install the Edge Relay](/edge-relay/install/) |
| [HotLoop Flow](/flow/overview/) | {{flow}} | Yes | Yes | [Install Flow](/flow/install/) |
| [HotLoop IoT](/iot/overview/) | Not released | On `main`, next release | On `main`, next release | [Overview](/iot/overview/) |
| [HotLoop Edge](/edge/overview/) | Not released | On `main`, next release | On `main`, next release | [Overview](/edge/overview/) |
| [HotLoop Cascade](/cascade/overview/) | {{cascade}}, a pre-release | In the repo, 0.1.0 is not out | In the repo, see [Cascade with Podman Quadlet](/cascade/quadlet/) | [Where Cascade stands](/cascade/status/) |

HotLoop IoT, Edge, Gateway and the Edge Relay come out of one tag, in lockstep, so they share a version number. Flow and Cascade have their own. A command for an image that doesn't exist is worse than no command at all, so the products that aren't out have no install page, only an overview that says so.

## Before you put one on a real plant

- Read [the write gate](/gateway/write-gate/). It is the same in every product, and it's why nothing moves a machine you didn't arm.
- Put the database on a USB SSD and not the SD card, if it's a Pi. History writes all day, every day, and SD cards die of exactly that.
- Back up the device password key. It isn't in the database and it isn't in a backup, so it is part of your data. [Backups](/iot/backup/) says how.
- Take a backup before you move a site up a product or upgrade across a release, and copy it off the box.
