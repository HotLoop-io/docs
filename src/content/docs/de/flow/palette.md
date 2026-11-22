---
title: "Die Knotenpalette"
description: "Jeder Knotentyp, den Flow mitbringt, als vollständig, teilweise, abweichend oder nur in Flow gekennzeichnet, mit dem Unterschied zu Node-RED festgehalten."
---

**117 Knotentypen für Nachrichten und 39 weitere für FlowLab-Diagramme.**

| Kategorie | Knoten |
|---|---|
| Allgemein | inject, debug, complete, catch, status, link in, link out, comment, junction |
| Funktion | function, switch, change, range, template, delay, trigger, exec, rbe |
| Netzwerk | ntfy out, gotify out, discord out, discord bot out, kafka out, mqtt in/out, http in, http response, http request, websocket in/out, tcp in/out, tcp request, udp in/out, modbus read/write, s7 read/write, ethernetip read/write, opcua read/write/subscribe, sparkplug in/out/command, hotloop in/state/script/recipe, mcp tool/result/client, e-mail, und die Node-RED-Knoten modbus-read/getter/flex-getter/write/flex-write/server |
| Sequenz | split, join, sort, batch |
| Parser | csv, html, json, xml, yaml |
| Speicher | file, file in, watch, influxdb out, postgres, postgresql |
| Dashboard | ui_text, ui_numeric, ui_button, ui_switch, ui_text_input, ui_led, ui_gauge, ui_chart, ui_template, und die Knoten ui_base, ui_tab, ui_group, ui_link und ui_spacer, die die Seite anordnen |
| Erkennung | scan, netinfo, zum Inventarisieren eines OT-Segments |
| Konfiguration | hotloop-flow-ntfy, hotloop-flow-gotify, hotloop-flow-discord-bot, hotloop-flow-kafka, mqtt-broker, websocket-listener, websocket-client, influxdb, postgres, modbus, s7, ethernetip, opcua, sparkplug, hotloop, mcp-server, modbus-client, postgreSQLConfig |
| FlowLab | constant, math, compare, logic, wait, bundle, field, build array, while loop, for loop, body in, body out, serial port, serial read, serial write, parse reading, stable value, log to text file, log to TDMS file, statistics, integral, derivative, filter, read DAQ task, mqtt out, postgres out, control, indicator, chart |

Die FlowLab-Zeile ist eine andere Art von Knoten. Er läuft auf einem Tab, der ein Diagramm ist, wo ein Knoten einmal läuft, wenn jeder Eingang einen Wert hat, und nie eine Nachricht annimmt. Was FlowLab ist und wie seine Schleifen, die Fehlerverbindung, das Panel und der Debugger funktionieren, steht unter [FlowLab](/de/flow/flowlab/). Eine Flow-Datei und damit ein Satz Diagramme kann an jede Flow-Installation gepusht werden, die ein Mandant in EmberNet betreibt, jede geprüft und eine fehlgeschlagene zurückgesetzt: [Pushen an die Stationen eines Mandanten](/de/flow/stations/). Zwei Installationen können sich die Aufgabe einer teilen, mit einem Lease und einer Sperre bei jedem Schreibvorgang auf Anlagen, damit nur eine schreibt: [Ein Warm-Standby mit Lease](/de/flow/failover/).

## Menschen benachrichtigen, und Kafka

Fünf Knoten schicken, was eine Nachricht trägt, irgendwohin und reichen die Nachricht weiter: **ntfy out**, **gotify out**, **discord out** (ein Webhook), **discord bot out** und **kafka out**. Sie nutzen dieselben Einstellungen, mit denen der HotLoop-Kern seine Alarme und Ereignisse sendet, sodass ein Werk, das bereits ein ntfy-Topic, eine Gotify-Anwendung, einen Discord-Webhook oder einen Kafka-Cluster hat, Flow auf dieselben zeigt.

- **ntfy.** Ein Server-Konfigurationsknoten (Adresse, dann ein Zugriffstoken oder Benutzername und Passwort, oder nichts bei einem Server, der jeden veröffentlichen lässt), und pro Knoten ein Topic, ein Titel, eine Priorität (min bis max, oder `msg.priority`), Tags und eine Klickadresse. Ein leeres Topic oder ein leerer Titel nimmt `msg.topic` oder `msg.title`. Auf einem öffentlichen Server ist das Topic das einzige Geheimnis, deshalb bleibt es aus jedem Fehler und Status heraus.
- **Gotify.** Ein Server-Konfigurationsknoten mit dem Token der Anwendung, und pro Knoten ein Titel und eine Priorität von 0 bis 10.
- **Discord-Webhook.** Die Webhook-URL ist die ganze Zugangsberechtigung, am Knoten, und wird nie in einem Status, einem Protokoll oder einem Fehler angezeigt, nicht einmal in einem Netzwerkfehler, der die Adresse nennt. Ein Titel oder eine Farbe macht die Nachricht zu einem Embed. Inhalt wird bei 2,000 Zeichen und die Beschreibung eines Embeds bei 4,096 gekürzt, gezählt, wie Discord zählt, und nichts in einer Nachricht kann jemanden anpingen.
- **Discord-Bot.** Ein Bot-Konfigurationsknoten mit seinem Token, und pro Knoten eine Kanal-ID (oder `msg.channel`). Er postet als der Bot und setzt voraus, dass der Bot im Kanal ist und Sendeberechtigung hat.
- **Kafka out.** Ein Cluster-Konfigurationsknoten (Broker, SASL PLAIN oder SCRAM-SHA-256 oder SCRAM-SHA-512, TLS), und pro Knoten ein Topic und ein optionaler Schlüssel. Der Wert ist `msg.payload`, als Text oder als JSON, wenn er kein Text ist, und die Nachricht wird weitergereicht, sobald der Cluster sie von jedem synchronen Replikat bestätigt hat. Er nutzt franz-go, den Client, den auch die Kafka-Ausgabe des Kerns verwendet.

Ein Server, der ablehnt, nennt den Grund im Fehler des Knotens, ohne etwas von dem, was gesendet wurde. Auf ein Ratenlimit wird einmal gewartet, so lange der Server es angibt, bis zu einer Minute, danach schlägt die Nachricht fehl. Es gibt keinen Slack- und keinen Teams-Knoten und keinen UADP-Knoten: HotLoop nimmt UADP entgegen, und Flow liest diese Werte über die HotLoop-Knoten.

Geprüft gegen ein echtes ntfy, ein echtes Gotify und ein echtes Redpanda: Der Knoten veröffentlicht, und der Server wird gefragt, was er enthält. Die Discord-Knoten folgen der dokumentierten Discord-API für Webhooks und Bots.

`scan` durchsucht einen CIDR-Bereich und erkennt Modbus- und EtherNet/IP-Endpunkte, und `netinfo` meldet die Schnittstellen, die die Laufzeit tatsächlich sehen kann, womit ein Flow im macvlan-Modus seine eigene Adresse im OT-VLAN herausfindet. Modbus-TCP-, S7-, EtherNet/IP-, OPC-UA- und Sparkplug-B-Knoten können jetzt mit dem sprechen, was `scan` findet, und sie sind der nächste Abschnitt.

Ein Go-Deskriptor pro Knotentyp deklariert Eigenschaften, Ports, Standardwerte und Hilfetext, und der Editor erzeugt den Dialog daraus, sodass ein Knoten nicht mit einem Dialog ausgeliefert werden kann, der seiner Laufzeit widerspricht.
