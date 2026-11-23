---
title: "HotLoop Edge Relay im Überblick"
description: "Ein Sparkplug-B-Edge-Node ohne Oberfläche. Er fragt ab, leitet weiter und puffert auf Platte, wenn die Verbindung fällt. Keine Datenbank, keine UI."
sidebar:
  label: "Übersicht"
---

Das Edge Relay ist das Modell ohne Oberfläche. Es sitzt auf einem Pi oder einem kleinen Industrie-PC neben den Maschinen, fragt sie mit denselben Treibern ab wie das Gateway und leitet jeden Messwert per Sparkplug B an ein Gateway irgendwo mit einer richtigen Datenbank weiter. Fällt der Uplink aus, stellt es auf der Platte in eine Warteschlange und spielt nach, wenn die Verbindung zurück ist, sodass der Historian oben den Ausfall aufgefüllt bekommt und kein Loch, solange der Ausfall in die Warteschlange passt, die standardmäßig auf 64 MiB begrenzt ist. Keine Datenbank, keine Weboberfläche, keine Benutzer, kein Schreibpfad, und jedes dieser fehlenden Teile ist etwas, das nachts um 3 Uhr nicht kaputtgehen kann.

Das aktuelle Release ist {{hotloop}}: `ghcr.io/hotloop-io/hotloop-edge-relay:{{hotloop}}`, gebaut für amd64, arm64 und arm/v7 (ein Pi 3 oder eine 32-Bit-Pi-OS-Installation ist genau die Box, auf der ein Relay landet), etwa 15 MB, ohne Anmeldung ladbar, und das Chart `hotloop-edge-relay` von `https://hotloop.io/hotloop`. 4.16.0 war das erste Release, das es veröffentlichte, und arm/v7 kam mit 4.18.10. Es teilt sich die Versionsnummer mit dem Gateway, und ein Release geht nicht raus, wenn nicht beide Charts die Version des Tags tragen und die Quadlet-Unit `:stable` folgt. Das Relay bekommt also mit jedem Release eine neue Version, egal ob sich sein Code geändert hat. Eine Versionsnummer zum Nachfragen, und ein Relay-Chart kann nie auf ein Image zeigen, das niemand gepusht hat. [Installieren Sie es](/de/edge-relay/install/).

Aktualisieren Sie ein Relay? [Upgrade von 4.17.0](/de/gateway/upgrading/#das-edge-relay-und-quadlet) und [Upgrade von 4.16.0](/de/gateway/upgrading/#das-edge-relay) haben den Teil des Relays.

## Was es nicht ist

**Kein kleineres Gateway mit abgeschalteten Optionen.** Es ist ein anderes Binary. Es linkt nie die Datenbank, die Weboberfläche samt Authentifizierung, die Automatisierungs-Engine, die Entitätsregistrierung oder MCP, und ein Test fragt `go list -deps`, was das Binary tatsächlich linkt, und schlägt fehl, wenn sich eines davon über ein gemeinsames Paket einschleicht. Im Gateway versteckt sich kein Relay-Modus, denn ein Modus ist ein Schalter, und ein Schalter kann von einer einzigen schlechten Umgebungsvariablen auf einer Box umgelegt werden, die niemand beobachtet. Ein Paket, das nie gelinkt wurde, lässt sich nicht einschalten.

**Es kann keinen Schreibzugriff annehmen, keinen Bildschirm ausliefern und keinem Agenten antworten.** Alle drei brauchen einen angemeldeten Menschen, dem man die Aktion zuordnen kann, und dieses Ding hat gar keine Benutzer. Es liest und leitet weiter, und das ist die ganze Aufgabe.

**Es ist nicht aus dem Netzwerk konfigurierbar.** Geräte und Tags kommen aus einer einzigen JSON-Datei auf der Box. Der einzige andere Weg hinein ist eine Gerätedatei, die vom Gateway über die Broker-Verbindung geschickt wird, die das Relay ohnehin nach außen aufbaut, und die wird live angewendet. Das Relay lauscht nie auf eine neue Konfiguration.

## Was es tut

- **Es fragt ab** mit der eigenen Engine des Gateways: dieselben Worker, dasselbe Wiederverbinden mit Back-off und dieselben Treiber für OPC UA, Modbus, MQTT und Sparkplug B, EtherNet/IP, S7comm, MTConnect und HTTP. Seit 4.18.10 kann es auch MQTT-Broker abhören, die Sie in der Gerätedatei nennen, und lesen, was sich dort ankündigt (ESPHome, Zigbee2MQTT, Tasmota, Shelly), und nichts davon, was es entdeckt, lässt sich scharf schalten, weil ein Relay überhaupt keinen Schreibpfad hat. Seit 4.17.0 kann es auch eine UniFi-Konsole abfragen, nur lesend: die Tags, die seine Gerätedatei deklariert, und von der Client-Arbeit nur die Client-Zahlen pro Netzwerk, ohne OT-Überwachung. Ein im Gateway behobener Treiberfehler ist auch hier behoben.
- **Es leitet weiter** als Sparkplug-B-Edge-Node: Births, Sequenznummern und Deaths, wie die Spezifikation es sagt. Ein Wiederverbinden meldet den Node einmal an, nicht zweimal.
- **Es überlebt den Ausfall der Verbindung.** Messwerte stehen in einer einzigen Datei auf der Platte in der Warteschlange. Kommt der Broker zurück, leert sich die Warteschlange, bevor ein Live-Messwert hinausgeht, der älteste zuerst, jeder mit `is_historical` markiert, damit der Host oben ein Nachspielen nicht für den aktuellen Wert des Tags hält. Die Zustellung ist mindestens einmal, also muss das, was sie verarbeitet, nach einem Absturz mitten im Nachspielen ein Duplikat vertragen. Die Warteschlange ist standardmäßig auf 64 MiB begrenzt, und darüber werden die ältesten Messwerte verworfen und gezählt. Das sind etwa 248.000 Messwerte, etwa zwei Minuten bei 2.000 Messwerten pro Sekunde, also dimensionieren Sie sie nach Ihrer eigenen Rate, etwa 240 Byte pro Messwert bei kurzen Tag-Namen (gemessen an derselben Warteschlange in Edge 4.21.1). Setzen Sie sie auf `0`, ist sie unbegrenzt, und ein lang genug Ausfall füllt das Volume. [Installation](/de/edge-relay/install/) sagt, wie man sie setzt.
- **Es beantwortet zwei schreibgeschützte Endpunkte** auf Port 8081: `/healthz` (der Prozess läuft) und `/status` (Geräteanzahl nach Verbindungszustand, Tag-Anzahl, Warteschlangentiefe, einkompilierte Protokolle, ob der Broker verbunden ist, seine Version, der Image-Digest und der Update-Modus sowie welche Gerätedatei läuft und welche abgelehnt wurde). Keine Tag-Werte, keine Adressen, keine Konfiguration. Beide sind absichtlich ohne Authentifizierung: Es gibt keine Benutzerdatenbank, an die man eine Anmeldung hängen könnte, und ein gemeinsames Token brächte keinen echten Schutz. Halten Sie sie hinter demselben Perimeter wie die Box.
- **Es nimmt Befehle von einem Gateway an.** Registrieren Sie ein Relay in der Flottenverwaltung des Gateways (nur API, es gibt keinen Flotten-Bildschirm), und das Gateway verfolgt es anhand seiner Births und Deaths und kann ihm ein Rebirth, einen Neustart, eine neue Gerätedatei oder die Freigabe für ein Update schicken, das es zurückhält. Eine gesendete Gerätedatei wird live angewendet, ohne Neustart. Ein Neustart ist ein eigener Befehl, weil er die Broker-Sitzung des Relays und jede Gerätesitzung, die es hält, abbricht, und eine Box, die monatelang läuft, sollte das nicht tun, nur um eine Konfigurationsänderung zu übernehmen.

## Wer es steuern darf

Nichts auf dem Relay entscheidet, wer es neu starten oder ihm eine Gerätedatei schicken darf. Das prüft das Gateway an seiner API: `fleet.rebirth` für ein Rebirth sowie `fleet.restart`, `fleet.update` und `fleet.config` für einen Neustart, eine Update-Freigabe und eine Übertragung, alle nur für Administratoren. Aber die Befehle laufen über den Broker, also kann alles, was auf das Sparkplug-NCMD-Topic des Relays oder auf `hotloop/edge-relay-config/#` veröffentlichen darf, genau das tun, was das Gateway tut.

Sperren Sie also den Broker ab. Seine ACL sollte nur den eigenen Zugangsdaten des Gateways erlauben, NCMD und das Konfigurations-Topic zu veröffentlichen. Und schalten Sie TLS auf dem Broker ein, bevor Sie eine Gerätedatei mit Passwörtern darin senden: Eine Übertragung wird retained veröffentlicht, und jeder, der dieses Topic abonnieren kann, kann jede Zugangsdaten in der Datei lesen.

## Wie weit es erprobt ist

Das Edge Relay wurde durchgängig gegen einen echten Mosquitto-Broker ausgeführt, wobei ein Messwert das ganze Binary durchlief und bei einem gewöhnlichen MQTT-Abonnenten als korrekt bewertetes Sparkplug-B-NDATA ankam. Flottenbefehle und Konfigurationsübertragung, auch eine retained gesendete Übertragung, noch bevor das Relay startete, wurden gegen einen echten Broker ausgeführt, und die Live-Anwendung wurde gegen echte Modbus-TCP- und OPC-UA-Geräte ausgeführt: Eine Übertragung fügt ein Gerät hinzu, entfernt eines, ändert ein weiteres und lässt ein viertes in Ruhe, ohne NDEATH und ohne abgebrochene Sitzung bei dem, das sich nicht geändert hat. Eine Änderung, die angewendet wird, während der Broker abgeschnitten ist und sich Messwerte stauen, leert danach die ganze Warteschlange.

Auch Updates wurden ausgeführt: das Rollback der Quadlet-Unit und das optionale Zurückhalten, mit einem echten Update, das zurückgehalten wurde, während das Relay unberührt lief, und dann nach Freigabe übernommen wurde. Unter Podman 4.9 muss die Unit `--sdnotify=healthy` selbst angeben, sonst wird ein gescheitertes Update als Erfolg gemeldet, und sie tut es.

Dieses Binary wurde auf Bare Metal ausgeführt (2026-11-17). Seine OPC-UA-, Modbus-, EtherNet/IP- und S7comm-Treiber sind derselbe Code, den das Gateway ausführt.

Setzen Sie es in einem Werk ein? [HotLoop im Unternehmen nutzen](/de/business/) behandelt die Lizenz und wie Sie uns erreichen.

## Lizenz

Das Edge Relay steht unter dem HotLoop Source License Agreement 1.0, wie jedes HotLoop-Produkt. Es ist kostenlos und quelloffen einsehbar, aber keine Open Source im Sinne der OSI, und jede Version wird vier Jahre nach ihrem Release zu AGPL-3.0 oder später. Die Nutzung zu Hause und im Labor ist kostenlos, ebenso die Nutzung durch Schulen, gemeinnützige Organisationen und Behörden für ihren eigenen Betrieb. [Die Lizenzseite](/de/license/) hat den Text.
