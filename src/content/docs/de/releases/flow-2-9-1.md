---
title: "Versionshinweise: HotLoop Flow 2.9.1"
description: "Was HotLoop Flow 2.9.1 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "2.9.1"
---

HotLoop Flow 2.9.1 lässt den Knoten `modbus-server` auf der Schnittstelle eines VLANs lauschen, sodass ein Flow auf jedem VLAN eines Ports einen Server mit derselben Adresse und demselben Port betreiben kann.

## Neu

- **`modbus-server` nimmt eine Netzwerkschnittstelle.** Der lauschende Socket wird vor dem Lauschen an die Schnittstelle gebunden (`SO_BINDTODEVICE`), sodass zwei Server auf `192.168.1.9:10502` in zwei VLANs nicht mehr kollidieren. Die Einstellung ist dieselbe wie an jedem Client: die eigene **Netzwerkschnittstelle** des Nodes, sonst `FLOW_NETWORK_INTERFACE` in den Umgebungsvariablen seines Tabs. Ohne beides lauscht er wie immer, und zwei Server auf derselben Adresse und demselben Port kollidieren weiterhin, jetzt mit einem Fehler, der sagt, dass jeder eine Schnittstelle braucht.

## Was sich geändert hat

- Nicht gesetzt, verhält er sich wie Upstream. NOTICE und `HOTLOOP_PATCH.txt` sagen, was sich geändert hat.

## Neue Einstellungen

Nichts außer dem Feld **Netzwerkschnittstelle** an `modbus-server`. Der Chart-Wert `bindToInterface.netRaw` und die Host-Netzwerk-Anforderung aus 2.9.0 gelten dafür wie für die Clients.

## Upgrade

Ein einfaches `helm upgrade` auf das Image und Chart 2.9.1, oder das neue Tag in Ihrer Quadlet-Unit. Beim ersten Start passiert nichts, und es muss nichts migriert werden. Ein Flow, der keine Schnittstelle setzt, verhält sich genau wie unter 2.9.0.

Image: `ghcr.io/hotloop-io/hotloop-flow:2.9.1`, zuerst linux/amd64, mit arm64 danach in 2.9.2. Chart: `https://hotloop.io/hotloop-flow/`. Das README zu diesem Tag hat den Rest, mit Bildern: https://github.com/HotLoop-io/hotloop-flow/blob/v2.9.1/README.md
