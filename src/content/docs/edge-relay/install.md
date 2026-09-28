---
title: "Install the Edge Relay with Helm or Quadlet"
description: "Run HotLoop Edge Relay 4.16.0 on a cluster with Helm, or on a Pi or industrial PC as a systemd service with Podman Quadlet. The unit files are here in full."
sidebar:
  label: "Install"
---

Two supported ways, both containers, both starting on boot and restarting when they die: the Helm chart on a cluster, and a Podman Quadlet unit on a box that isn't in one. A bare `podman run` from a shell that dies with your SSH session is not one of them, because that's how an edge box quietly stops forwarding the first time somebody logs out.

Whichever way, the relay needs two things: a broker to publish to, and a Sparkplug group id. The image pulls with no login.

## The device file

Both ways read the same document: the devices to poll and the tags to read on them.

```json
{
  "devices": [
    {
      "id": "press-01",
      "name": "Press 1",
      "protocol": "opcua",
      "address": "opc.tcp://press-01.local:4840",
      "enabled": true,
      "pollIntervalMs": 1000
    }
  ],
  "tags": [
    {
      "deviceId": "press-01",
      "name": "Zone1_Temp",
      "address": "ns=2;s=Zone1.Temp",
      "dataType": "float",
      "enabled": true
    }
  ]
}
```

It's read once at start. Change it, restart the relay.

## Helm

```bash
helm repo add hotloop https://hotloop.io/hotloop
helm repo update
helm install press-line-3 hotloop/hotloop-edge-relay \
  --version 4.16.0 --namespace hotloop --create-namespace \
  --set edgePublish.broker=tcp://gateway.plant.local:1883 \
  --set edgePublish.group=Plant1 \
  -f devices.yaml
```

`edgePublish.broker` and `edgePublish.group` are required, and the chart refuses to render without them. `edgePublish.node` defaults to the pod's host name. Put the broker password in `edgePublish.password`, or name a Secret with a `password` key in `edgePublish.existingSecret`.

`devices.yaml` carries the same two lists as the device file, under `devices:` and `tags:`. Those end up in a ConfigMap, which anybody who can read ConfigMaps in the namespace can read. If a device carries a password, put the whole device file in a Secret instead and name it:

```bash
kubectl -n hotloop create secret generic press-devices --from-file=devices.json
helm upgrade press-line-3 hotloop/hotloop-edge-relay --reuse-values \
  --set devicesSecret=press-devices
```

The forward queue lives on its own small volume, so buffered readings survive the pod moving.

## Quadlet

For a Pi or an industrial PC outside any cluster. Quadlet turns the container into a systemd service: it starts on boot with nobody logged in, restarts when it dies, and logs to the journal. It needs Podman 4.4 or newer. Raspberry Pi OS Bookworm ships 4.3, which has no Quadlet at all, so use Trixie or newer.

Save this as `/etc/containers/systemd/edge-relay.container`, and change the broker, group and node for this box:

```ini
[Unit]
Description=HotLoop Edge Relay
After=network-online.target
Wants=network-online.target

[Container]
Image=ghcr.io/hotloop-io/hotloop-edge-relay:4.16.0
ContainerName=edge-relay

Environment=HOTLOOP_EDGE_PUBLISH_BROKER=tcp://gateway.example.local:1883
Environment=HOTLOOP_EDGE_PUBLISH_GROUP=Plant1
Environment=HOTLOOP_EDGE_PUBLISH_NODE=press-line-3
Environment=HOTLOOP_EDGE_RELAY_DEVICES_FILE=/etc/edge-relay/devices.json
Environment=HOTLOOP_LOG_LEVEL=info

# Delete this line if the broker takes anonymous connections.
Secret=edge-relay-broker-password,type=env,target=HOTLOOP_EDGE_PUBLISH_PASSWORD

Volume=/etc/edge-relay/devices.json:/etc/edge-relay/devices.json:ro,Z
Volume=edge-relay-data.volume:/data

# Only reachable from this host. /status has no auth, on purpose.
PublishPort=127.0.0.1:8081:8081

User=65532:65532
ReadOnly=true
Tmpfs=/tmp
NoNewPrivileges=true
DropCapability=all

[Service]
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

And this as `/etc/containers/systemd/edge-relay-data.volume`. It holds the forward queue, as a named volume so it survives a `podman system prune` and its ownership matches the container's non-root user without a chown:

```ini
[Volume]
```

Put the device file at `/etc/edge-relay/devices.json`, then:

```bash
sudo mkdir -p /etc/edge-relay
printf '%s' 'your-broker-password' | \
  sudo podman secret create edge-relay-broker-password -
sudo systemctl daemon-reload
sudo systemctl start edge-relay.service
sudo systemctl status edge-relay.service
curl localhost:8081/status
```

Broker takes anonymous connections? Skip the secret and delete the `Secret=` line. On an isolated OT network that's a real setup, not a mistake to work around. The `:Z` on the device file mount is for SELinux, and harmless on a distro without it.

To change devices: edit the file, then `sudo systemctl restart edge-relay.service`. To upgrade: change the `Image=` tag, `daemon-reload`, restart.

## Then

To manage relays from a Gateway, turn on fleet management there (`HOTLOOP_FLEET_ENABLED`), point it at the same broker, and register each relay by its group and node. Registering is on purpose: a relay that just shows up on the broker isn't a fleet member until somebody says it is. From then on the Gateway tracks it from its births and deaths and can send it a rebirth, a restart, or a new device file.
