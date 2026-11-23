---
title: "Versionshinweise: HotLoop Flow 2.9.0"
description: "Was HotLoop Flow 2.9.0 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "2.9.0"
---

HotLoop Flow 2.9.0 bringt native Konnektorknoten für die Migration eines echten Werks. Es führt die Node-RED-Knoten aus, auf die sich die Flows eines Werks stützen, Modbus, das Dashboard, PostgreSQL und E-Mail, dazu das `Buffer` und `setInterval`, das die Funktionsknoten um sie herum aufrufen. Ein Flow, der von einer Node-RED-Maschine erfasst wurde und sie nutzt, wird unverändert geladen, ausgeführt und gespeichert. Außerdem kann ein Flow für jede Maschine einen eigenen Tab führen, und zwar auf einer Box, deren einziger Port für jede ein VLAN trägt, auch wenn alle VLANs dasselbe Subnetz und dieselben Geräteadressen haben.

## Neu

- **Node-RED-Modbus.** `modbus-client`, `modbus-read`, `modbus-getter`, `modbus-flex-getter`, `modbus-write`, `modbus-flex-write`, `modbus-server` und der passive `modbustcp-server`. Die Ausgabe ist die, die die Community-Knoten senden: `msg.payload` als Liste der Werte, `msg.responseBuffer` als `{data, buffer}`, `msg.input` und Fehler über den zweiten Ausgang.
- **Das Dashboard.** `ui_base`, `ui_tab`, `ui_group`, `ui_link`, `ui_spacer`, `ui_text`, `ui_numeric`, `ui_button`, `ui_switch`, `ui_text_input`, `ui_led`, `ui_gauge`, `ui_chart` und `ui_template`, aus der Binärdatei unter `/ui` bereitgestellt, ohne dass etwas von außerhalb des Werks geladen wird. Was ein Bediener auf der Seite tut, kommt als Nachricht aus dem Knoten. `ui_template` führt die Teilmenge im AngularJS-Stil aus, die Werke nutzen: `{{ }}`, `ng-click`, `ng-class`, `ng-init`, `ng-show`, `ng-hide`, `ng-if`, `ng-bind`, `scope.$watch`, `scope.send`.
- **PostgreSQL.** `postgreSQLConfig` und `postgresql`. Die Verbindung wird bei der ersten Abfrage geöffnet, sodass eine Datenbank, die noch nicht läuft, den Flow nicht stoppt.
- **E-Mail.** Der Ausgabeknoten `e-mail` über SMTP, mit STARTTLS, einem Zertifikatsschalter und XOAUTH2.
- **`Buffer`, `setInterval` und `setTimeout` im Funktionsknoten.** Die Timer laufen auf der Uhr des Knotens, jeder Callback hat dasselbe CPU-Limit wie eine Nachricht, und jeder Timer wird gestoppt, wenn der Flow anhält oder neu bereitgestellt wird.
- **Eine Netzwerkschnittstelle für jeden Client.** Ein Knoten, ein Tab oder eine Client-Konfiguration kann die Schnittstelle nennen, an die sich ihre Verbindungen binden (`SO_BINDTODEVICE`), sodass ein Tab für Trockner 14 nur die `192.168.1.5` von VLAN 14 erreicht. Beim Tab ist es die Umgebungsvariable `FLOW_NETWORK_INTERFACE` am Tab, die jeder Clientknoten darauf erbt. Sie gibt es bei den Knoten für Modbus, PostgreSQL, E-Mail, TCP-Anfrage, UDP-Ausgabe und HTTP-Anfrage.

Das README hat einen neuen Abschnitt, `docs/node-red-types.md` sagt, was läuft und wie es sich unterscheidet, und `docs/compatibility.md` wird aus dem Register neu erzeugt.

## Was sich geändert hat

- Im Funktionsknoten fehlten `Buffer`, `setTimeout` und `setInterval` absichtlich, und zwei Tests hielten das fest. Jetzt sind sie da, weil die Funktionen eines Werks sie nutzen. Sonst hat sich an der Sandbox nichts geändert: Es gibt weiterhin kein `require`, kein `process` und keine Node-Standardbibliothek.
- Ist der Hook nicht gesetzt, verhält er sich wie Upstream. NOTICE und `HOTLOOP_PATCH.txt` sagen, was sich geändert hat.
- Der Grund sind die nativen Node-RED-Konnektorknoten für die Migration eines echten Werks.

## Neue Einstellungen

- `HOTLOOP_FLOW_UI_PATH`, Standard `/ui`: wo das Dashboard ausgeliefert wird.
- `FLOW_NETWORK_INTERFACE`, eine Umgebungsvariable von Tab, Subflow oder Prozess: die Schnittstelle, an die die Clients dieses Tabs binden. Standardmäßig leer, was den Host wählen lässt, wie bisher.
- Ein Feld **Netzwerkschnittstelle** an jedem Client-Node und jeder Konfiguration.
- Chart-Wert `bindToInterface.netRaw`, Standard `false`. Einen Socket an eine Schnittstelle zu binden braucht unter Linux 5.7 und neuer keine Capability. Auf einem älteren Kernel braucht es `CAP_NET_RAW`, und `true` fügt dem Pod genau diese eine Capability hinzu und sonst nichts. Der Pod braucht außerdem das Netzwerk des Hosts (`network.mode: host`), um eine VLAN-Schnittstelle zu sehen.

## Upgrade

Ein einfaches `helm upgrade` auf das Image und Chart 2.9.0, oder das neue Tag in Ihrer Quadlet-Unit. Beim ersten Start passiert nichts, es muss nichts migriert werden, und ein Flow, der keinen der neuen Typen nutzte, läuft wie bisher. Ein Flow, der diese Typen schon enthält (eine erfasste Node-RED-Datei), startet sie jetzt, wo er jeden vorher als unbekannten Knotentyp gemeldet hat.

## Eine Änderung an NOTICE und den Lizenzen

NOTICE bekommt den Eintrag der Modbus-Bibliothek, die jetzt eine geänderte Kopie ist. Im Image steckt kein neues Modul von Drittanbietern.

Image: `ghcr.io/hotloop-io/hotloop-flow:2.9.0`, zuerst linux/amd64, mit arm64 danach in 2.9.1. Chart: `https://hotloop.io/hotloop-flow/`. Das README zu diesem Tag hat den Rest, mit Bildern: https://github.com/HotLoop-io/hotloop-flow/blob/v2.9.0/README.md
