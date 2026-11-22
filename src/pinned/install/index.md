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
| [HotLoop IoT](/iot/overview/) | {{hotloop}} | Yes | Yes | [Install IoT](/iot/install/) |
| [HotLoop Edge](/edge/overview/) | {{hotloop}} | Yes | Yes | [Install Edge](/edge/install/) |
| [HotLoop Gateway](/gateway/overview/) | {{hotloop}} | Yes | Yes | [Install the Gateway](/gateway/install/) |
| [HotLoop Edge Relay](/edge-relay/overview/) | {{hotloop}} | Yes | Yes | [Install the Edge Relay](/edge-relay/install/) |
| [HotLoop Flow](/flow/overview/) | {{flow}} | Yes | Yes | [Install Flow](/flow/install/) |
| [HotLoop Cascade](/cascade/overview/) | {{cascade}} | Yes, no login needed | Yes, no login needed, see [Cascade with Podman Quadlet](/cascade/quadlet/) | [Running Cascade](/cascade/running/) |
| [HotLoop for CODESYS](/codesys/overview/) | {{codesys}} | Yes, or the EmberCORE App Store | No | [Install HotLoop for CODESYS](/codesys/install/) |
| [HotLoop Transmitter](/transmitter/overview/) | 1.1.0 | No, it is a CODESYS library | No, it is a CODESYS library | [Install Transmitter](/transmitter/install/) |

HotLoop IoT, Edge, Gateway, and the Edge Relay come out of one tag, in lockstep, so they share a version number. Flow, Cascade, HotLoop for CODESYS, and Transmitter have their own. The IoT, Edge, and Gateway Quadlet units need Podman 5.0 or newer, and the relay's unit was run on Podman 4.9.3. Raspberry Pi OS Bookworm ships 4.3, which has no Quadlet at all, so a Pi wants Trixie or newer.

## Install from the EmberNet App Store

On EmberNet, the install is the App Store. It runs the same Helm chart for you, on the node you pick, so there is no chart to add, no values file, and no command line. We timed it on a real node: 1 minute 10 seconds from opening the App Store to live readings on the board.

<figure>
<video controls preload="none" playsinline width="1920" height="1080" poster="/embernet-install/poster.webp" aria-label="Installing HotLoop Gateway from the EmberNet App Store, start to live data in 1 minute 10 seconds" style="width:100%;height:auto;aspect-ratio:16/9">
<source src="/embernet-install/install-hotloop-on-embernet.mp4" type="video/mp4" />
<source src="/embernet-install/install-hotloop-on-embernet.webm" type="video/webm" />
Your browser cannot play this video. <a href="/embernet-install/install-hotloop-on-embernet.mp4">Download it</a>.
</video>
<figcaption>One take, real time. The clock runs from the moment the App Store opens until HotLoop is reading data, and the wait for the install is shown at four times speed.</figcaption>
</figure>

1. In EmberCORE, open the **App Store**.

   ![The EmberCORE App Store catalog with its Category, Publisher, and Sort filters](/embernet-install/hotloop-install-01-app-store.webp)

2. Pick the **HotLoop** category, then press **Deploy** on HotLoop Gateway. Each HotLoop product has its own card in this category.

   ![The App Store filtered to the HotLoop category, showing the HotLoop Cascade, Edge, Edge Relay, Flow, Gateway, and IoT cards](/embernet-install/hotloop-install-02-hotloop-apps.webp)

3. Choose the node and press **Deploy** again.

   ![The Deploy HotLoop Gateway dialog with a node chosen](/embernet-install/hotloop-install-03-choose-node.webp)

4. EmberCORE confirms the install, and HotLoop Gateway appears under **Running apps** with its version and its Flux address.

   ![The EmberCORE message that HotLoop Gateway is being installed on the node](/embernet-install/hotloop-install-04-installing.webp)

   ![Running apps with HotLoop Gateway running, its version, its Flux address online, and the Launch, Open, Pod shell, Device shell, and Remove buttons](/embernet-install/hotloop-install-05-running.webp)

5. Press **Launch**. EmberCORE signs you in, and HotLoop opens with the box's own health already reading, so the first thing you see is live data.

   ![HotLoop Gateway open inside EmberCORE and signed in, showing one device with 4 of 4 tags reporting and no alarms](/embernet-install/hotloop-install-06-hotloop-signed-in.webp)

6. Pin the tags you care about, and they become live gauges on the board.

   ![The Pin a tag to the board dialog listing the node's CPU, memory, and disk tags](/embernet-install/hotloop-install-07-pin-a-tag.webp)

   ![The HotLoop board with live gauges for CPU, memory, and disk utilization on the node](/embernet-install/hotloop-install-08-board-live.webp)

The EmberNet docs walk the same install with a page for each app: [HotLoop Gateway on EmberNet](https://docs.embernet.ai/docs/app-store/hotloop).

## Before you put one on a real plant

- Read [the write gate](/gateway/write-gate/). It is the same in every product, and it's why nothing moves a machine you didn't arm.
- Put the database on a USB SSD and not the SD card, if it's a Pi. History writes all day, every day, and SD cards die of exactly that.
- Back up the device password key. It isn't in the database and it isn't in a backup, so it is part of your data. [Backups](/iot/backup/) says how.
- Take a backup before you move a site up a product or upgrade across a release, and copy it off the box.
