---
title: "Install HotLoop for CODESYS"
description: "Install HotLoop for CODESYS from the EmberCORE App Store or with Helm: what the node needs, the profile Secret, what it does by itself, and how to check it."
sidebar:
  label: "Install"
---

HotLoop for CODESYS is a Helm chart, `hotloop-codesys`, that installs HotLoop Edge and a provisioner on the same node as a CODESYS runtime. The chart is published at `{{codesysChartRepo}}`, at {{codesys}} as the newest, and the provisioner image pulls with no login. On EmberNet it is an App Store app. With no EmberNet it is Helm on k3s.

## What the node needs first

- **A CODESYS runtime on the same node that publishes its OPC UA server on port 4840.** The provisioner finds the node's own address from Kubernetes and reads `<node address>:4840`. The runtime's own chart publishes that port on the host.
- **A Symbol Configuration in the PLC program** with *Support OPC UA features* on, listing the variables you want to see, or `{attribute 'symbol' := 'read'}` on them in the declaration. A PLC with no Symbol Configuration answers the setup with a message that says to add one. This is the only change to the PLC project.
- **HotLoop {{codesysNeeds}}**, which the chart wraps. The CODESYS connector came with HotLoop 4.19.4. The chart depends on the `hotloop-edge` chart on the `~{{codesysNeeds}}` line.
- **A profile.** One Secret with one key. [The profile page](/codesys/profile/) has the shape.

## From the EmberCORE App Store

The chart is marked for staff, so the Store lists it for EmberNet staff, and they install it onto the customer's tenant. It is not a button a tenant presses itself, so ask whoever looks after your tenant. The Store writes the profile into the tenant's namespace as `<release>-profile`, passes the node picked and the tenant's labels into the chart, and passes the dashboard's public key for sign-in. After that there is nothing to do.

## With Helm

```bash
kubectl -n <namespace> create secret generic <release>-profile --from-file=profile.json
helm repo add hotloop-codesys {{codesysChartRepo}}
helm repo update
helm install <release> hotloop-codesys/hotloop-codesys --version {{codesys}} -n <namespace>
```

Name the Secret `<release>-profile`, or change what the chart looks for with `profile.existingSecret` (the Secret) and `profile.key` (the key, `profile.json` by default). To pin the install to the runtime's node, set `nodeSelector`. For HotLoop alone with no profile, to set up by hand, install with `--set provisioner.enabled=false`.

## With a runtime on the node's network

A runtime installed from its chart with `network.hostNetwork=true` holds host port 8080 for WebVisu, so HotLoop's page cannot also listen on 8080 there. The chart has HotLoop's page listen on 8090 inside the pod and keeps the Service on 8080, so the App Store tile and the provisioner reach it as before. Install with the host network on for both:

```bash
helm install <release> hotloop-codesys/hotloop-codesys --version {{codesys}} -n <namespace> \
  --set hotloop-edge.hostNetwork=true --set hotloop-edge.service.targetPort=8090
```

HotLoop's OPC UA PubSub listeners bind a UDP port exclusively, so two listeners on one port cannot both connect. The provisioner refuses a profile that asks for it, and says why.

## What installing does

1. HotLoop Edge starts on that node with SQLite on the node's local-path storage. No database pod, one replica, and the update strategy is `Recreate`.
2. The provisioner starts on the same node. It reads the mounted profile at every pass, so a newer one reaches a running install. It waits for HotLoop and for the node's own CODESYS runtime, then sets up the profile's device, variables, alarms, and screen.
3. It looks again every five minutes and keeps the device right as the PLC's program changes. Variables a profile lists that the PLC now has are added, and one the PLC no longer has reads bad with the server's reason.
4. Both pods tolerate `node.kubernetes.io/unreachable` and `not-ready` with no `tolerationSeconds`, so a node that loses its control plane keeps them. The chart carries this itself and does not depend on the cluster's setting.

The OPC UA server, the embedded broker, edge publishing, and backups are off, because none of them is wanted beside a runtime. Turn one on through the `hotloop-edge` values if you want it.

## Check it

```bash
kubectl -n <namespace> logs deploy/<release>-provision
```

A good start says the device was set up with its variables, none writable, and that the alarms and the screen were made. Open the HotLoop service, sign in as `admin`, and look at Devices and Dashboards. The admin password is in the release Secret, the same as any HotLoop chart.

## Sign-in from the dashboard

From HotLoop 4.19 the Edge chart signs a person in from the EmberCORE dashboard's signed assertion (the `embernetSignin` values, four `HOTLOOP_AUTH_ASSERTION_*` variables, and the Service annotation `embernet.ai/signin: assertion`). This chart inherits all of that from the `hotloop-edge` subchart, and the Store passes the public key into it. The provisioner uses the chart's admin account, which local login still allows. In a test cluster a good assertion signed a person in as an operator or an admin, and a wrong app, a wrong tenant, an expired one, a wrong issuer, and a tampered one were each refused.

## How far it has been run

The chart renders from the live index with Helm, and every step of an install has been run against a real CODESYS Control for Linux SL 4.22.0.0 runtime. [Where it stands](/codesys/where-it-stands/).

