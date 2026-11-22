---
title: "HotLoop-Produkte: acht in fünf Linien"
description: "Acht Produkte in fünf Release-Linien: was jedes Core-Produkt enthält, welche Datenbank es nutzt, wie man sie installiert und wie ein Standort aufsteigt."
---

HotLoop sind acht Produkte für die Fertigung: vier, die mit einem Standort wachsen (IoT, Edge, Gateway und Edge Relay), dazu Flow für die Verdrahtung, Cascade für Workflows, HotLoop for CODESYS für den eigenen Bildschirm der SPS und Transmitter, um die Werte einer SPS ins Netz zu bringen.

Sie erscheinen in fünf Release-Linien. **HotLoop core** sind IoT, Edge, Gateway und Edge Relay: vier Produkte, eine Codebasis, ein Tag. Jedes Core-Release liefert alle vier gleichzeitig aus, mit derselben Version, jedes mit eigenem Image, eigenem Helm-Chart und eigenen Podman-Quadlet-Units. Wählen Sie das Produkt, das zum Gerät passt. Jedes spricht jedes Protokoll, das HotLoop kennt, Sie steigen also nie in ein größeres Produkt um, nur um die SPS auf Ihrem Prüftisch auszulesen. Die Funktionen trennen die Produkte. Die Protokolle nicht.

**Flow**, **Cascade**, **HotLoop for CODESYS** und **Transmitter** sind eigene Linien mit eigenen Versionen, ein Flow-Release bewegt also nie den Core, und umgekehrt. Alles unter der Tabelle betrifft den Core. Hier beginnt jedes der acht:

| Produkt | Release-Linie | Dokumentation | Installation | Versionshinweise | Roadmap |
|---|---|---|---|---|---|
| **HotLoop IoT** | HotLoop core | <a href="/de/iot/overview/">Dokumentation</a> | <a href="/de/iot/install/">Installation</a> | <a href="/de/releases/#hotloop-core">Hinweise</a> | <a href="/de/roadmap/">Roadmap</a> |
| **HotLoop Edge** | HotLoop core | <a href="/de/edge/overview/">Dokumentation</a> | <a href="/de/edge/install/">Installation</a> | <a href="/de/releases/#hotloop-core">Hinweise</a> | <a href="/de/roadmap/">Roadmap</a> |
| **HotLoop Gateway** | HotLoop core | <a href="/de/gateway/overview/">Dokumentation</a> | <a href="/de/gateway/install/">Installation</a> | <a href="/de/releases/#hotloop-core">Hinweise</a> | <a href="/de/roadmap/">Roadmap</a> |
| **HotLoop Edge Relay** | HotLoop core | <a href="/de/edge-relay/overview/">Dokumentation</a> | <a href="/de/edge-relay/install/">Installation</a> | <a href="/de/releases/#hotloop-core">Hinweise</a> | <a href="/de/roadmap/">Roadmap</a> |
| **HotLoop Flow** | Flow | <a href="/de/flow/overview/">Dokumentation</a> | <a href="/de/flow/install/">Installation</a> | <a href="/de/releases/#hotloop-flow">Hinweise</a> | <a href="/de/flow/roadmap/">Roadmap</a> |
| **HotLoop Cascade** | Cascade | <a href="/de/cascade/overview/">Dokumentation</a> | <a href="/de/cascade/running/">Installation</a> | <a href="/de/releases/#hotloop-cascade">Hinweise</a> | <a href="/de/cascade/roadmap/">Roadmap</a> |
| **HotLoop for CODESYS** | HotLoop for CODESYS | <a href="/de/codesys/overview/">Dokumentation</a> | <a href="/de/codesys/install/">Installation</a> | <a href="/de/releases/codesys-0-3-8/">Hinweise</a> | <a href="/de/codesys/roadmap/">Roadmap</a> |
| **HotLoop Transmitter** | Transmitter | <a href="/de/transmitter/overview/">Dokumentation</a> | <a href="/de/transmitter/install/">Installation</a> | <a href="/de/releases/transmitter-1-1-0/">Hinweise</a> | <a href="/de/transmitter/roadmap/">Roadmap</a> |

Die folgende Tabelle vergleicht die vier Core-Produkte.

| <span class="sr-only">Details</span> | HotLoop IoT | HotLoop Edge | HotLoop Gateway | HotLoop Edge Relay |
|---|---|---|---|---|
| Wofür es gedacht ist | Die Automatisierungsbasis. Ein Pi, ein NUC, eine Kiste im Schrank | Eine Kiste an der Maschine, die weiterläuft, auch wenn die Verbindung nach oben ausfällt | Das Gehirn des Standorts | Abfragen, weiterleiten, durchhalten. Keine Datenbank, keine Oberfläche |
| Entitäten, Automatisierungen, Helfer, Skripte, Rezepte, Blueprints, Dashboards, Logbuch, Benachrichtigungen, MCP, MQTT mit Discovery, ISA-18.2-Alarme, Backups und jeder Treiber | ja | ja | ja | nur Treiber |
| OPC-UA-Server, Sparkplug-Edge-Publishing mit Store and Forward | | ja | ja | nur Publishing |
| Flotte, mehrere Standorte, geplante Berichte | | | ja | |
| Image | `ghcr.io/hotloop-io/hotloop-iot` | `ghcr.io/hotloop-io/hotloop-edge` | `ghcr.io/hotloop-io/hotloop` | `ghcr.io/hotloop-io/hotloop-edge-relay` |
| Chart | `hotloop-iot` | `hotloop-edge` | `hotloop` | `hotloop-edge-relay` |
| Quadlet-Units | `deploy/quadlet/iot/` | `deploy/quadlet/edge/` | `deploy/quadlet/gateway/` | `deploy/quadlet/edge-relay.container` |
| Quadlet-Units auf SQLite | `deploy/quadlet/iot/sqlite/` | `deploy/quadlet/edge/sqlite/` | `deploy/quadlet/gateway/sqlite/` | keine |
| `database.type` im Chart | `postgresql` (Standard), `sqlite` | `timescaledb` (Standard), `postgresql`, `sqlite` | `timescaledb` (Standard), `postgresql`, `sqlite` | keiner |
| Architekturen | amd64, arm64, arm/v7 | amd64, arm64, arm/v7 | amd64, arm64 | amd64, arm64, arm/v7 |
| Datenbank, die Chart und Quadlet betreiben | PostgreSQL 17 | TimescaleDB | TimescaleDB | keine |
| Standardmäßig aufbewahrter Verlauf | 30 Tage | 90 Tage | 90 Tage | keiner |
| Datenbanken, auf denen das Binary läuft | SQLite oder Postgres | SQLite, Postgres oder TimescaleDB | SQLite, Postgres oder TimescaleDB | keine |

Die Datenbank ist eine Einstellung, kein Image: `HOTLOOP_DB_TYPE=sqlite` und `HOTLOOP_DB_PATH` legen jedes der drei auf eine SQLite-Datei, ganz ohne Datenbank-Container (DEPLOYMENT.md, „SQLite“). Die Charts nehmen dieselbe Wahl als `database.type` entgegen und die Quadlet-Units als die Verzeichnisse `sqlite/`, wobei jedes Produkt nur die Datenbanken aus der Tabelle oben anbietet: Wer vom IoT-Chart `timescaledb` verlangt, bekommt eine fehlgeschlagene Installation. Der Wechsel von einer Datenbank zur anderen ist ein Backup und eine Wiederherstellung (BACKUP.md).

Das Gateway hat die Namen behalten, unter denen es bis 4.17.0 erschien: Image `ghcr.io/hotloop-io/hotloop`, Chart `hotloop`. Wer es betreibt, muss nichts ändern.

## Was in einem Produkt steckt, steckt im Binary

Ein Produkt ist ein Build, keine Einstellung. `-tags hotloop_iot` baut IoT, `-tags hotloop_edge` baut Edge, ohne Tag entsteht das Gateway. Was ein Produkt nicht hat, ist nicht abgeschaltet, es ist nicht da: Der OPC-UA-Server steckt gar nicht im IoT-Image, also kann ihn keine Umgebungsvariable, keine Values-Datei und kein schlechter Tag einschalten.

Darum steht ein kleineres Produkt für das gerade, was es nicht hat, statt etwas vorzutäuschen:

- **Die API** behält jede Route in jedem Produkt. Eine Route für eine Funktion, die dieses Produkt nicht hat, antwortet mit `404` und nennt das Produkt, das sie hat: `{"error":"scheduled reports are part of HotLoop Gateway; this is HotLoop IoT","product":"iot","feature":"reports"}`. `GET /api/status` nennt `product` und `features`, ein Skript fragt also, statt zu raten.
- **Eine Einstellung nur für das Gateway** auf IoT oder Edge (etwa `HOTLOOP_REPORTS_ENABLED=true`, aus einer alten Values-Datei mitgeschleppt) warnt beim Start und im Einstellungsbildschirm, und HotLoop läuft weiter. HotLoop hält die Anlage am Laufen, obwohl es einen Bericht nicht erzeugen kann, und die Warnung sorgt dafür, dass es jemand sieht.
- **Die Charts** haben die Einstellung gar nicht erst. `charts/hotloop-iot` hat keinen Block `reports`, `opcuaServer` oder `edgePublish`, und `hotloop-edge` hat kein `reports`. Wer sie trotzdem setzt, erzeugt damit nichts.
- **`hotloop --product`** gibt `iot`, `edge` oder `gateway` aus. `--version` gibt weiterhin nur die Version aus, weil Skripte sie auswerten.

## Welches Produkt

- **Ein Pi, smarte Steckdosen, ein paar Sensoren, ein MQTT-Broker voller Tasmota und Zigbee2MQTT oder eine SPS auf dem Prüftisch:** IoT. Es hat das kleinste Image (etwa 29 MB auf arm), und das Image von reinem PostgreSQL ist ein Sechstel so groß wie das von TimescaleDB, was auf einer SD-Karte die Zahl ist, auf die es ankommt.
- **Eine Kiste, die neben einer Linie verschraubt ist, ein SCADA über OPC UA speist oder per Sparkplug nach oben veröffentlicht und den Ausfall der Verbindung nach oben übersteht:** Edge.
- **Der Standort: jede Linie, per E-Mail geplant versendete Berichte, Edge Relays, die sich melden, mehr als ein Standort auf einem Bildschirm:** Gateway.
- **Eine Kiste, die nur abfragen und weiterleiten soll, ohne Datenbank, um die man sich kümmern muss:** Edge Relay. Siehe die [Edge-Relay-Referenz](/de/edge-relay/reference/).

## Größen

Das Image ist das Binary plus etwa 3 MB Basis.

| <span class="sr-only">Details</span> | amd64 Image / Binary | arm64 Image / Binary | arm/v7 Image / Binary |
|---|---|---|---|
| IoT | 31.2 / 28.0 MB | 29.1 / 26.0 MB | 29.2 / 26.0 MB |
| Edge | 36.5 / 33.3 MB | 34.2 / 31.0 MB | 34.3 / 31.1 MB |
| Gateway | 37.1 / 33.9 MB | 34.8 / 31.6 MB | nicht gebaut |
| Edge Relay | 15.7 / 12.5 MB | 14.9 / 11.7 MB | 15.1 / 11.9 MB |

Das sind die Größen auf der Platte. Ohne Geräte liegt HotLoop bei etwa 10 MB RSS und PostgreSQL bei etwa 12 MB, und das ist der Boden, nicht der Wert im Betrieb: Was ein Produkt mit abgefragten Geräten braucht, hängt von den Geräten ab.

## Installation

### Helm

Ein Repository, alle vier Charts:

```sh
helm repo add hotloop https://hotloop.io/hotloop/

helm install hotloop hotloop/hotloop-iot  --namespace hotloop --create-namespace
helm install hotloop hotloop/hotloop-edge --namespace hotloop --create-namespace
helm install hotloop hotloop/hotloop      --namespace hotloop --create-namespace
```

Nennen Sie das Release `hotloop`, egal welches Produkt. Nach dem Release-Namen sind das Volume der Datenbank, die Secrets und der Service benannt, und wer ihn beibehält, kann einen Standort später in ein größeres Produkt überführen (siehe unten).

Auf EmberNet ist jedes davon eine eigene Karte im App Store: „HotLoop IoT“, „HotLoop Edge“, „HotLoop Gateway“ und „HotLoop Edge Relay“. Ein Store-Deploy fügt die Mandanten-Labels des Dashboards in alles ein, was das Chart rendert, und Running Apps zeigt sie als `HotLoop-IoT`, `HotLoop-Edge`, `HotLoop-Gateway` und `HotLoop-Edge-Relay`.

### Podman Quadlet

Für ein Gerät, das nicht in einem Cluster steckt. Jedes Produktverzeichnis unter `deploy/quadlet/` enthält fünf Units: `hotloop.network`, `hotloop.container` (die App), `hotloop-db.container` (ihre Datenbank, dasselbe Image und dieselbe Version, die ihr Chart betreibt), `hotloop-db.volume` und `hotloop-data.volume`. Die Installationsschritte stehen im Kopf jeder `hotloop.container`, und [Podman Quadlet](/de/install/quadlet/) hat den Rest.

Dazu wird Podman 5.0 oder neuer gebraucht. Raspberry Pi OS Bookworm bringt 4.3 mit, das gar kein Quadlet hat, ein Pi braucht also Raspberry Pi OS Trixie oder neuer. Die App folgt `:stable`, und das Auto-Update von Podman bewegt sie, die Datenbank bleibt festgesetzt: [Das Quadlet-README](/de/install/auto-update/) erklärt, wie und warum. Egal wie installiert wird: Legen Sie die Datenbank auf eine USB-SSD und nicht auf die SD-Karte. Der Verlauf schreibt den ganzen Tag, jeden Tag, und genau daran sterben SD-Karten.

## Einen Standort in ein größeres Produkt überführen

Von IoT zu Edge zum Gateway bleiben jedes Gerät, jeder Tag, jede Entität, Automatisierung, jeder Alarm, Benutzer und jede Stunde Verlauf erhalten. Jedes Produkt führt jede Migration aus, die Datenbank hat also in allen dreien dieselbe Form, und das größere Produkt startet mit leeren Zusatzfunktionen.

- **Quadlet:** Die Unit-Namen, die Volumes und die Secrets sind in jedem Produktverzeichnis dieselben. Kopieren Sie `hotloop.container` und `hotloop-db.container` des größeren Produkts über Ihre, führen Sie `systemctl daemon-reload` aus und starten Sie neu.
- **Helm:** `helm upgrade hotloop hotloop/hotloop-edge` (oder `hotloop/hotloop`) auf demselben Release. Die drei Charts wählen ihre Pods mit denselben Labels aus und benennen das StatefulSet und das Volume der Datenbank gleich, das Upgrade ist also erlaubt und das Volume bleibt gebunden.

Machen Sie vorher ein Backup (`POST /api/backup`, siehe [Backups und Wiederherstellung](/de/iot/backup/)) und kopieren Sie es vom Gerät herunter. Der Wechsel wurde auf Quadlet durchgespielt, IoT dann Edge dann Gateway auf einem Datenbank-Volume mit demselben Gerät bei jedem Schritt, mit dem PostgreSQL-Verzeichnis von IoT, das unter dem TimescaleDB-Image des Gateways startet, und als `helm upgrade` auf einem echten Cluster. Wo das schlichte Verzeichnis von IoT keine TimescaleDB-Erweiterung enthält, bleibt der Verlauf danach in nativen Partitionen, und eine Hypertable verlangt ein Backup und eine Wiederherstellung in eine frische TimescaleDB. Ein Schritt zurück zu einem kleineren Produkt ist nichts, was man auf einem Gerät tun sollte, an dem einem etwas liegt.

## Wie sie erscheinen

Ein `v`-Tag veröffentlicht alle vier, damit IoT, Edge, das Gateway und das Edge Relay immer dieselbe Version tragen. Bevor etwas gebaut wird, wird geprüft, dass Version und Image jedes Charts zum Tag passen, dass jede Quadlet-App-Unit `:stable` mit einem Healthcheck folgt und dass jede Datenbank-Unit zu ihrem Chart passt und nie automatisch aktualisiert wird. Die Charts von IoT und Edge werden aus dem Chart des Gateways erzeugt, eine Korrektur an einem erreicht also alle drei.
