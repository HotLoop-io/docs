---
title: "Install HotLoop Flow with Podman or Helm"
description: "Run HotLoop Flow 2.0.5 with Podman or Quadlet, on Kubernetes with Helm, or from source. It starts locked, so set an admin password first."
sidebar:
  label: "Install"
---

HotLoop Flow 2.0.5 is current. It ships as `ghcr.io/hotloop-io/hotloop-flow:2.0.5`, a 25.1 MB image for amd64 and arm64, plus a Helm chart and source you can build yourself. The image is distroless, runs as a non-root user, and has no shell in it, so there's nothing to drop into, for you or for anybody who shouldn't be there. There's no Docker or Compose path on this page: Podman for one box, Quadlet to make it a service, Helm for a cluster.

Flow starts locked. It refuses to run without an admin account, because a flow can run commands. And it refuses to run without a credential secret, which encrypts every broker and database password stored with your flows. Every path below sets both.

## Podman

Make a password hash first. The image has no shell, so hashing is a subcommand of the binary itself, and it refuses anything under eight characters.

```bash
podman run --rm ghcr.io/hotloop-io/hotloop-flow:2.0.5 hash-password -password 'something-long'
```

Then make the credential secret, and save it somewhere you'll still find it in a year:

```bash
openssl rand -hex 32
```

Then run it. Both values go in single quotes, because a bcrypt hash is full of dollar signs and your shell will eat them otherwise.

```bash
podman run -d --name hotloop-flow -p 1880:1880 -v hotloop-flow-data:/data \
  -e HOTLOOP_FLOW_ADMIN_USER=admin \
  -e HOTLOOP_FLOW_ADMIN_PASSWORD_HASH='<the hash>' \
  -e HOTLOOP_FLOW_CREDENTIAL_SECRET='<the secret>' \
  ghcr.io/hotloop-io/hotloop-flow:2.0.5
```

Open `http://localhost:1880/` and sign in as `admin`. `/health` answers with the version once the process is up, and `/ready` says whether the runtime actually started.

Keep that secret. Everything Flow encrypts onto the volume is only readable with it. Recreate the container with a different one and every stored broker password is gone, and it looks exactly like a clean start right up until MQTT stops authenticating.

## Quadlet

For a service that starts at boot and restarts itself. It needs Podman 4.4 or newer. Put the secrets in a file only you can read:

```bash
mkdir -p ~/.config/hotloop-flow ~/.config/containers/systemd
umask 077
cat > ~/.config/hotloop-flow/hotloop-flow.env <<'EOF'
HOTLOOP_FLOW_ADMIN_USER=admin
HOTLOOP_FLOW_ADMIN_PASSWORD_HASH=<the hash>
HOTLOOP_FLOW_CREDENTIAL_SECRET=<the secret>
EOF
```

Then describe the container to systemd. Save this as `~/.config/containers/systemd/hotloop-flow.container`:

```ini
[Unit]
Description=HotLoop Flow
After=network-online.target
Wants=network-online.target

[Container]
Image=ghcr.io/hotloop-io/hotloop-flow:2.0.5
ContainerName=hotloop-flow
PublishPort=1880:1880
Volume=hotloop-flow-data:/data
EnvironmentFile=%h/.config/hotloop-flow/hotloop-flow.env

[Service]
Restart=always

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload
systemctl --user start hotloop-flow
```

A user service only starts at boot, and only outlives your login, if lingering is on for your account: `loginctl enable-linger`. Skip that and it runs fine right up until you log out or the box reboots.

## Helm

The chart works on any Kubernetes, k3s included.

```bash
helm repo add hotloop-flow https://hotloop.io/hotloop-flow/
helm install line3-flows hotloop-flow/hotloop-flow
```

The chart generates the admin password and the credential secret on first install, and reads both back off the existing Secret on every upgrade, so an upgrade never rotates the secret out from under your stored credentials. The install notes print how to read the password. For the release above:

```bash
kubectl get secret line3-flows-auth -o jsonpath='{.data.admin-password}' | base64 -d
kubectl port-forward svc/line3-flows 1880:8080
```

The user is `admin`. Before 2.0.2 that generated password never worked, because the hash the app checked was made from a different random password than the one the chart stored. Upgrading a release installed that way fixes it in place, and neither the password nor the credential secret changes.

One release is one instance, and the chart pins `replicaCount: 1` on purpose. Each instance holds flow state and live connections to brokers and PLCs. Two pods behind one Service would both subscribe and both write, and InfluxDB would quietly store every reading twice. To run more, install another release with its own flows.

It's small on purpose too. The default `resources.preset` is `small`, requesting 10m of CPU and 64Mi of memory. Flow's process measured 16.6 MiB resident at idle, so it schedules on an edge node with 64Mi to spare, where the node-red chart's default 512Mi request would sit in Pending.

The pod runs as uid 65532 on a read-only root filesystem, with no privilege escalation, `RuntimeDefault` seccomp and every Linux capability dropped, discovery included. Up to 2.0.4 the chart added `NET_RAW` and `NET_ADMIN` whenever discovery was on, for ARP sweeps nobody ever wrote. 2.0.5 stopped, CI fails if a capability comes back, and you don't need to change anything you set.

The chart has three network modes:

| Mode | What it gets | Instances per node |
|---|---|---|
| `cluster` | A ClusterIP, and whatever the cluster routes. The default, and the right answer unless you need layer 2. | Unlimited |
| `host` | The host's interfaces, ARP table and broadcast domain. | One, since the port is the node's |
| `macvlan` | Its own MAC and IP on the target VLAN, sitting on the segment with the PLCs. Needs Multus. | Unlimited |

`macvlan` is why the modes exist, because scanning a PLC network is pointless from a pod that only sees what the cluster routes to it. It's multi-instance safe and sitting right on that segment, with no port collisions because every instance carries its own address. The [Flow README](https://github.com/HotLoop-io/hotloop-flow#deploying-on-kubernetes) covers the modes and the resource presets in full.

:::note[Where the chart has been run]
The chart has been installed and exercised on a four-node k3s cluster, in the default `cluster` network mode: login, a flow deployed through the API, that flow surviving a pod restart, upgrades, and a deploy from the EmberNET App Store through Fleet. The `host` and `macvlan` modes render, lint, and are rejected when misconfigured, but have not been run on a cluster.
:::

## From the EmberNET App Store

You don't need this. Flow is Apache-2.0, and there's no EmberNET step anywhere in running it. But the chart carries the labels the EmberNET App Store looks for, so if you already run that dashboard, Flow is in its catalog and shows up as a tile.

For a tenant on its own cluster, the dashboard deploys it through Fleet, which needs dashboard 4.9.37 or later. Earlier versions created a Fleet bundle that installed nothing. From Flow 2.0.3 the chart puts the dashboard's tenant labels on everything it creates.

From 2.0.4 the deployed tile gets its name and icon right. The pod and the Service carry the `embernet.ai/app-icon` annotation, which defaults to the chart's own icon, so the dashboard stops guessing an icon from the release name, which never matched. Set `embernet.appIcon` to use your own, and serve it with `Access-Control-Allow-Origin`, or the tile comes up blank. The `embernet.ai/app-name` label is the chart name now, not the release name. The instance is still in `app.kubernetes.io/instance` and the Service name, and no selector changed, so upgrading in place is fine.

The [release notes](https://hotloop.io/releases/flow/) have every version back to 0.1.0.

## From source

You need Go and Node. The editor is built first and embedded into the binary with `go:embed`, so a Go build without it fails on a missing pattern instead of handing you a binary with no editor in it.

```bash
git clone https://github.com/HotLoop-io/hotloop-flow.git
cd hotloop-flow
(cd web && npm ci && npm run build)
go build -o hotloop-flow ./cmd/hotloop-flow
```

The default data directory is `/data`, which is right in a container and probably not what you want on your laptop, so point it somewhere else:

```bash
export HOTLOOP_FLOW_DATA_DIR=./data
export HOTLOOP_FLOW_ADMIN_USER=admin
export HOTLOOP_FLOW_ADMIN_PASSWORD_HASH="$(./hotloop-flow hash-password -password 'something-long')"
export HOTLOOP_FLOW_CREDENTIAL_SECRET='<the secret>'
./hotloop-flow
```

## Coming from Emberwire 0.1.0

2.x is a clean break, on purpose: 0.1.0 had no users to break, and a compatibility layer with no users is just a place for bugs to live. The `EMBERWIRE_*` variables are `HOTLOOP_FLOW_*` now, the two database config node types are `hotloop-flow-influxdb` and `hotloop-flow-postgres`, WASM modules export `hotloop_flow_*`, metrics are `hotloop_flow_*`, and the deploy header is `HotLoop-Flow-Deployment-Rev`.

A credentials file from 0.1.0 can't be read. Since 2.0.1 Flow says so at startup: it names the file, says Emberwire wrote it, and tells you to move it aside and enter the credentials again. The 0.1.0 image is still at `ghcr.io/embernet-ai/emberwire:0.1.0`, and the [release notes](https://hotloop.io/releases/flow/) list every break.
