---
title: "Install HotLoop Gateway 4.16.0 with Helm"
description: "Install HotLoop Gateway 4.16.0 from the published Helm chart on k3s or any Kubernetes, sign in, and set what matters before a real plant sees it."
sidebar:
  label: "Install"
---

HotLoop Gateway 4.16.0 ships as a container image for amd64 and arm64 and a Helm chart. The image is about 34 MB, and it and the chart both pull with no login. On 4.3.1 already? Stop here and read [Upgrading from 4.3.1](/gateway/upgrading/), because a fresh install over an old release is not what you want.

There is no Quadlet unit for the Gateway yet, so off a cluster the answer is k3s. The [Edge Relay](/edge-relay/install/) has one today. There is no Docker or Compose path, on purpose.

## Helm

```bash
helm repo add hotloop https://hotloop.io/hotloop
helm repo update
helm install hotloop hotloop/hotloop --version 4.16.0 \
  --namespace hotloop --create-namespace
```

That deploys the Gateway and a TimescaleDB 2.30.1 beside it on a 20 Gi volume. The chart generates the database password, the MCP token and an admin password into the release Secret, and reuses them on every upgrade, so a `helm upgrade` never rotates a password out from under you.

## Sign in

The user is `admin`. The install notes print the command that reads the password back:

```bash
kubectl -n hotloop get secret hotloop \
  -o jsonpath='{.data.admin-password}' | base64 -d
kubectl -n hotloop port-forward svc/hotloop 8080:8080
```

Open `http://localhost:8080`. That admin account is a bootstrap, not a reset switch. Once it exists, changing `auth.admin.password` and upgrading does nothing, so a password somebody set in the UI is never overwritten by a later deploy.

## What to set before a real plant sees it

Put these in a values file and install with `-f`. Don't lean on `--set` for anything you'll need again next upgrade.

| Value | Default | Why you'd touch it |
|---|---|---|
| `plant.name`, `plant.siteId` | `HotLoop`, empty | What the plant is called on screens, in pages and to other sites. |
| `publicUrl` | empty | The address a phone on the plant Wi-Fi reaches HotLoop at. Without it, notifications have no link back and ntfy gets no Acknowledge button. |
| `safety.allowWrites` | `false` | The master switch. Off, nothing writes to a machine, from anywhere. Turn it on once the deployment has been reviewed. |
| `safety.allowMcpWrites` | `false` | Lets agents write through the same gate. It narrows the master switch, it never goes around it. |
| `database.postgresql.persistence.size` | `20Gi` | Your history lives here. Size it for your tag count and `historian.retentionDays` (90). |
| `database.postgresql.enabled` | `true` | Set `false` and fill in `database.external` to use your own PostgreSQL. With the TimescaleDB extension you get a hypertable, without it native partitioning. |
| `ingress` | off | Only if you want it reachable outside the cluster by a name. |

Writes ship off, and that's the point. Even with `safety.allowWrites` on, a tag is read-only until you arm it on its own, and every value is checked against the tag's range, never clamped into it. [The write gate](/gateway/write-gate/) has the whole list.

## Then

Add a device, discover its tags, and watch them come in. [Protocols](/gateway/protocols/) says how far each driver has been proven, including the two that have never touched a physical PLC. If you run it under the EmberNET dashboard, the dashboard finds it by itself and proxies it at the in-cluster address, no ingress needed.

HotLoop Gateway is free for individual use. Using it in a business? That goes through EmberNET, where signing up is free and so is business use. See [Using HotLoop in a business](/business/).
