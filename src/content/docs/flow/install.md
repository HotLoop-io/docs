---
title: "Install HotLoop Flow with Podman or Helm"
description: "Run HotLoop Flow 2.0.2 with Podman or Quadlet, on Kubernetes with Helm, or from source. It starts locked, so set an admin password first."
sidebar:
  label: "Install"
---

HotLoop Flow 2.0.2 is current, and 2.0.0 was the first release under this name. It ships as a 25 MB container image for amd64 and arm64, a Helm chart, and source you can build yourself. There is no Docker or Compose path here, on purpose.

Flow starts locked. It refuses to run without an admin account, because a flow can run commands, and it refuses to run without a credential secret, which is what encrypts the credentials stored with your flows. Every path below sets both.

## Podman

Make a password hash first. The image has no shell in it, so the hashing is a command of the binary itself, and it refuses anything under eight characters.

```bash
podman run --rm ghcr.io/hotloop-io/hotloop-flow:2.0.2 hash-password -password 'something-long'
```

Then run it, with the hash from above in single quotes, since it is full of dollar signs.

```bash
podman run -d --name hotloop-flow -p 1880:1880 -v hotloop-flow-data:/data \
  -e HOTLOOP_FLOW_ADMIN_USER=admin \
  -e HOTLOOP_FLOW_ADMIN_PASSWORD_HASH='<the hash>' \
  -e HOTLOOP_FLOW_CREDENTIAL_SECRET="$(openssl rand -hex 32)" \
  ghcr.io/hotloop-io/hotloop-flow:2.0.2
```

Open `http://localhost:1880/` and sign in as `admin`. `/health` answers with the version once it is up.

Keep the credential secret. Everything Flow has encrypted onto the volume is only readable with it, so a secret that changes leaves every stored broker password unreadable, and it looks like a clean start until MQTT stops authenticating.

## Quadlet

For a service that starts at boot and restarts itself, put the secrets in a file only you can read, and describe the container to systemd.

```bash
mkdir -p ~/.config/hotloop-flow ~/.config/containers/systemd
umask 077
cat > ~/.config/hotloop-flow/hotloop-flow.env <<'EOF'
HOTLOOP_FLOW_ADMIN_USER=admin
HOTLOOP_FLOW_ADMIN_PASSWORD_HASH=<the hash>
HOTLOOP_FLOW_CREDENTIAL_SECRET=<64 hex characters>
EOF
```

Save this as `~/.config/containers/systemd/hotloop-flow.container`.

```ini
[Unit]
Description=HotLoop Flow
After=network-online.target
Wants=network-online.target

[Container]
Image=ghcr.io/hotloop-io/hotloop-flow:2.0.2
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

A user service only starts at boot if lingering is on for your account, which is `loginctl enable-linger`.

## Helm

The chart works on any Kubernetes, k3s included.

```bash
helm repo add hotloop-flow https://hotloop.io/hotloop-flow/
helm install line3-flows hotloop-flow/hotloop-flow
```

The chart generates the admin password and the credential secret on first install, and reads both back off the existing Secret on upgrade, so an upgrade never rotates the secret out from under your stored credentials. The install notes print the command for reading the admin password. Before 2.0.2 that password did not work, because the hash the app checks was made from a different random password than the one the chart stored. Upgrading a release installed that way fixes it in place, and the password does not change.

One release is one instance, and the chart pins one replica on purpose. Flow holds flow state and open connections to brokers and PLCs, so two pods behind one Service would both subscribe and both write. To run more, install another release.

The chart has three network modes: `cluster`, which is the default, `host`, and `macvlan`, which gives the pod its own address on an OT segment and needs Multus. The [README](https://github.com/HotLoop-io/hotloop-flow#deploying-on-embernet) covers them, and the resource presets, in full.

:::note[Where the chart has been run]
The chart has been installed and exercised on a four-node k3s cluster, in the default `cluster` network mode: login, a flow deployed through the API, that flow surviving a pod restart, and upgrades. The `host` and `macvlan` modes render, lint, and are rejected when misconfigured, but have not been run on a cluster.
:::

## From source

You need Go and Node. The editor is built first and embedded into the binary, so a Go build without it has no editor in it.

```bash
git clone https://github.com/HotLoop-io/hotloop-flow.git
cd hotloop-flow
(cd web && npm ci && npm run build)
go build -o hotloop-flow ./cmd/hotloop-flow
```

Set the same three variables from the Podman section, then run `./hotloop-flow`.

## Coming from Emberwire 0.1.0

2.x is a clean break. The `EMBERWIRE_*` variables are now `HOTLOOP_FLOW_*`, the two database node types are `hotloop-flow-influxdb` and `hotloop-flow-postgres`, WASM modules export `hotloop_flow_*`, and a credentials file from 0.1.0 cannot be read, which 2.0.1 says plainly at startup. The [release notes](https://hotloop.io/releases/flow/) list every one of them.
