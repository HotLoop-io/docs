---
title: "Install the Edge Relay with Helm or Quadlet"
description: "Run HotLoop Edge Relay 4.17.0 on a cluster with Helm, or on a Pi or industrial PC as a systemd service with Podman Quadlet. The unit files are here in full."
sidebar:
  label: "Install"
---

Two supported ways, both containers, both starting on boot and restarting when they die: the Helm chart on a cluster, and a Podman Quadlet unit on a box that isn't in one. A bare `podman run` from an SSH session is not one of them. That's how an edge box quietly stops forwarding the first time somebody logs out and the container goes with them, and nobody notices until the historian has a hole in it. There's no Docker path either.

Whichever way you go, the relay needs two things: a broker to publish to, and a Sparkplug group id. The image pulls with no login.

:::note[Coming from 4.16.0]
4.16.0's relay couldn't take a pushed device file on either install below: the push died on a read-only mount while the Gateway said `config pushed`. And `persistence.enabled=false` didn't even boot. 4.17.0 fixes both. [Upgrading from 4.16.0](/gateway/upgrading/#the-edge-relay) has the relay's part, including the stale push the broker may hand back at first boot.
:::

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

These are the same device and tag shapes the Gateway's API takes, checked with the same rules: a device needs a protocol HotLoop knows, and a tag needs a device that exists. On top of that the relay refuses a device id declared twice and a tag pointing at a device that was never declared, the two mistakes a hand-edited file makes that a database would have caught for you.

It's read once at start. Change it, restart the relay. No live reload, on purpose.

A device's `config` block can hold credentials, like an OPC UA `username` and `password`. They sit in that file in the clear, and the relay has no API to hide them behind, so where the file lives matters. Both paths below cover it.

## Helm

```bash
helm repo add hotloop https://hotloop.io/hotloop
helm repo update
helm install press-line-3 hotloop/hotloop-edge-relay \
  --version 4.17.0 --namespace hotloop --create-namespace \
  --set edgePublish.broker=tcp://gateway.plant.local:1883 \
  --set edgePublish.group=Plant1 \
  --set edgePublish.node=press-line-3 \
  -f devices.yaml
```

`edgePublish.broker` and `edgePublish.group` are required, and the chart refuses to render without them. Set `edgePublish.node` too. Left empty, it's the pod's hostname, and a Deployment's pod gets a new name every time it's replaced. After the next node drain, the Gateway's fleet and every Sparkplug host upstream see a brand new edge node, and the one you registered shows offline.

Broker password: put it in `edgePublish.password`, or name a Secret with a `password` key in `edgePublish.existingSecret`. Turn on `edgePublish.tls` if the broker speaks TLS.

`devices.yaml` carries the same two lists as the device file, under `devices:` and `tags:`:

```yaml
devices:
  - id: press-01
    name: Press 1
    protocol: opcua
    address: "opc.tcp://press-01.local:4840"
    enabled: true
    pollIntervalMs: 1000
tags:
  - deviceId: press-01
    name: Zone1_Temp
    address: "ns=2;s=Zone1.Temp"
    dataType: float
    enabled: true
```

Those end up in a ConfigMap and in the Helm release record, and anybody who can read ConfigMaps in the namespace can read them. If a device carries a password, put the whole device file in a Secret under the key `devices.json` and name it instead. The Secret is mounted in place of the ConfigMap, and `devices` and `tags` are ignored:

```bash
kubectl -n hotloop create secret generic press-devices --from-file=devices.json
helm upgrade press-line-3 hotloop/hotloop-edge-relay --version 4.17.0 \
  --reset-then-reuse-values --set devicesSecret=press-devices
```

`--reset-then-reuse-values`, not `--reuse-values`. The plain one replays the values the release already has and skips any default a newer chart added. Run it on a relay installed at 4.16.0 and it drops `pushedDevicesFile`, so a push goes right back to dying on the read-only mount, and nothing fails to tell you.

The install notes will then warn that no devices are configured. They're counting the chart's `devices` list, which you left empty on purpose. Check `/status` instead:

```bash
kubectl -n hotloop logs deploy/press-line-3
kubectl -n hotloop port-forward svc/press-line-3 8081:8081
curl localhost:8081/status
```

### The forward queue and its volume

The forward queue lives on its own PVC, 256Mi by default (`persistence.size`), so buffered readings survive the pod moving. The same volume holds the OPC UA client certificate and its trust store at `/data/opcua-client-pki`, so a secured server trusts the relay once, not after every restart.

`edgePublish.queueMaxBytes` is `0` by default, which means unbounded, and the install notes say so. A long enough broker outage fills that volume instead of dropping old readings, and a full volume is a second outage stacked on the first. Set it comfortably under `persistence.size`, and once the queue hits the cap the oldest readings go first.

`persistence.enabled=false` boots in 4.17.0 (on 4.16.0 it killed the relay at boot), with an emptyDir at `/data` capped at `persistence.size`. Know what that costs before you pick it: every time the pod is replaced (a node drain, an eviction, a `kubectl delete pod`, a `helm upgrade` that rolls it) it loses the forward queue and every reading buffered in it, any pushed device file (the relay quietly goes back to the chart's `devices`), and the OPC UA client certificate, so every secured server has to trust the relay again. The install notes print that warning. Fine for a trial. For a relay whose readings matter, keep the PVC.

A pushed device file lives on that same volume, at `/data/pushed-devices.json` (`pushedDevicesFile` in the chart's values), and wins over the chart's `devices` for as long as it exists, through restarts, reschedules and a `helm upgrade` that changes `devices`. The relay logs which file it booted from. To go back to the chart's list, clear the push with `DELETE /api/fleet/{id}/config` on the Gateway while the relay is connected, then restart it.

## Quadlet

For a Pi or an industrial PC outside any cluster. Quadlet turns the container into a real systemd service: it starts on boot with nobody logged in, restarts when it dies, and logs to the journal. It needs Podman 4.4 or newer. Raspberry Pi OS Bookworm ships 4.3, which has no Quadlet at all, so use Trixie or newer.

Make the directories first:

```bash
sudo mkdir -p /etc/containers/systemd /etc/edge-relay
```

Save this as `/etc/containers/systemd/edge-relay.container`, and change the broker, group and node for this box:

```ini
[Unit]
Description=HotLoop Edge Relay
After=network-online.target
Wants=network-online.target

[Container]
Image=ghcr.io/hotloop-io/hotloop-edge-relay:4.17.0
ContainerName=edge-relay

Environment=HOTLOOP_EDGE_PUBLISH_BROKER=tcp://gateway.example.local:1883
Environment=HOTLOOP_EDGE_PUBLISH_GROUP=Plant1
Environment=HOTLOOP_EDGE_PUBLISH_NODE=press-line-3
Environment=HOTLOOP_EDGE_RELAY_DEVICES_FILE=/etc/edge-relay/devices.json
# Where a pushed device file lands, instead of failing on the read-only
# mount below. It wins over the file above for as long as it exists.
Environment=HOTLOOP_EDGE_RELAY_PUSHED_FILE=/data/pushed-devices.json
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

And this as `/etc/containers/systemd/edge-relay-data.volume`. It holds the forward queue and any pushed device file. It's a named volume so it survives a `podman system prune`, and so its ownership matches the container's non-root user without a chown:

```ini
[Volume]
```

Put the device file at `/etc/edge-relay/devices.json`, then:

```bash
printf '%s' 'your-broker-password' | \
  sudo podman secret create edge-relay-broker-password -
sudo systemctl daemon-reload
sudo systemctl start edge-relay.service
sudo systemctl status edge-relay.service
curl localhost:8081/status
```

Broker takes anonymous connections? Skip the secret and delete the `Secret=` line. On an isolated OT network that's a real setup, not a mistake to work around. The `:Z` on the device file mount is for SELinux, and harmless on a distro without it.

To change devices: edit the file, then `sudo systemctl restart edge-relay.service`. To upgrade: change the `Image=` tag, `sudo systemctl daemon-reload`, restart. When something looks wrong, `sudo journalctl -u edge-relay.service` before anything else. The relay says why it rejected a device file or a push, and reading that takes less time than second-guessing your JSON.

## Then: manage it from a Gateway

Fleet management is off in the Gateway until you turn it on, because a Gateway with no relays has no broker to point it at. Set `HOTLOOP_FLEET_ENABLED` to `true` and point `HOTLOOP_FLEET_BROKER` at the same broker the relays publish to, with `HOTLOOP_FLEET_USER`, `HOTLOOP_FLEET_PASSWORD` and `HOTLOOP_FLEET_TLS` if it needs them. The Gateway chart has no fleet values of its own, so they go in its `extraEnv`:

```yaml
extraEnv:
  - name: HOTLOOP_FLEET_ENABLED
    value: "true"
  - name: HOTLOOP_FLEET_BROKER
    value: tcp://gateway.plant.local:1883
```

Then register each relay by its group and node. Registering is on purpose: a relay that just shows up on the broker isn't a fleet member until somebody says it is. `POST` this to `/api/fleet` as a user with `fleet.write`:

```json
{
  "id": "press-line-3",
  "name": "Press line 3",
  "group": "Plant1",
  "nodeId": "press-line-3",
  "statusUrl": "http://press-line-3.hotloop.svc:8081"
}
```

`statusUrl` is optional. Without it the Gateway knows online and offline from births and deaths. With it, the Gateway also polls the relay's `/status` for queue depth and device counts, and a relay it can't reach shows as unreachable, never as a healthy zero. The Quadlet unit above only publishes 8081 on `127.0.0.1`, so a Gateway on another box can't reach `/status` until you change `PublishPort=`, and then it's reachable by anyone on that network too.

From then on the Gateway tracks the relay and can send it `POST /api/fleet/{id}/rebirth`, `POST /api/fleet/{id}/restart` or `POST /api/fleet/{id}/config`, that last one being the push, which lands in 4.17.0 and never did on 4.16.0. `DELETE /api/fleet/{id}/config` clears a push. All of this is API only: there's no Fleet screen in the Gateway's UI. Before you rely on any of that, lock the broker's ACL down so only the Gateway can publish commands and device files. [The overview](/edge-relay/overview/#who-gets-to-command-it) says why.
