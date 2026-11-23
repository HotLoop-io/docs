---
title: "Versionshinweise: HotLoop core 4.23.2"
description: "Was HotLoop core 4.23.2 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "4.23.2"
---

Ein CODESYS-Bildschirm kommt jetzt als HotLoop-Bildschirm an, die Box meldet ihre eigene Gesundheit an das EmberNet-Dashboard, und ein Energiezähler kann ein Leistungsentgelt tragen. Außerdem ist es ein Durchgang durch die Fehler der Testsuite auf langsamen Nodes, jeder ein echtes Warten oder ein echtes Race, behoben. Nur für amd64 gebaut; der Multi-Arch-Build folgt als nächste Version.

## Was sich geändert hat

- **Eine CODESYS-Visualisierung wird als Bildschirm importiert.** Exportieren Sie sie aus der IDE (Project, Export, die native `.export`-Datei, nicht PLCopenXML), und der Import des Bildschirms Dashboards liest sie als HotLoop-Bildschirm auf den Variablen der SPS. Jedes Tag, das der Bildschirm liest und das diese Installation nicht hat, wird aufgelistet, mit einer Gerätezuordnung, und jedes Element, das HotLoop nicht platzieren konnte, wird mit dem Grund aufgelistet, bevor irgendetwas gespeichert wird. Eine Schaltfläche oder ein Sollwert auf einem nicht beschreibbaren Tag wird abgelehnt, wie bei einem Aufbau. Siehe [Import a CODESYS screen](/de/iot/codesys-screen-import/).
- **Box-Gesundheit für das EmberNet-Dashboard.** Ein nach dem Kubernetes-Node benanntes Gerät veröffentlicht CPU-, Speicher-, Platten- und Datenvolumen-Auslastung der Box und den Echtzeit-Jitter dreier Kerne, wenn ein Agent die Datei dafür schreibt. Werte, die sich nicht lesen lassen, haben schlechte Qualität mit dem Grund, nie null. Der OPC-UA-Server liefert ihren Verlauf. Siehe [den OPC-UA-Server](/de/edge/opc-ua-server/#gerätezustand-für-das-embernet-dashboard) und [Protokolle und Treiber](/de/iot/protocols/#zustand-der-box).
- **Ein Login, der lesen kann und sonst nichts.** Ein Deployment kann ein Konto mit genau `tags.read` und `values.read` anlegen (`HOTLOOP_READER_USER` und `HOTLOOP_READER_PASSWORD_HASH`). Das Chart legt `embernet-dashboard-read` bei der ersten Installation an, hält sein Passwort im Secret `<release>-opcua-dashboard` und rotiert es bei Updates nie.
- **Dem Zertifikat des Dashboards wird aus einem Secret vertraut.** Das Chart bindet `<release>-opcua-trust` (optional) ein, und der OPC-UA-Server hält seinen Trusted-Ordner im Gleichschritt: Ein neues Zertifikat wird innerhalb von 30 Sekunden hinzugefügt, eines, das das Secret verlässt, wird entfernt, und eine Datei, die ein Operator von Hand ablegte, wird nie angefasst. Der Server nimmt weiterhin nur Basic256Sha256 SignAndEncrypt, keine anonymen Sitzungen, kein Trust-all. Der Service der Version listet jetzt Port 4840, wenn der Server an ist.
- **Energie: ein Leistungsentgelt und Schichten.** Ein Zähler in Wh, kWh oder MWh nimmt ein `demand_price`, was ein Kilowatt seiner höchsten Viertelstunde in einem Fenster kostet, und die Zusammenfassung zeigt die Spitze, wann sie begann und wie viel dieser Viertelstunde gelesen wurde. Eine Schicht ist ein Fenster, `shift:06:00-14:00` für die zuletzt begonnene und `last_shift:06:00-14:00` für die davor. Der Bildschirm Energy hat ein Feld Shift und einen Leistungspreis, in allen dreizehn Sprachen.
- **Kosten pro gefertigter Einheit lesen sich nicht mehr als kostenlos.** Wenn etwas gefertigt wurde und noch kein bepreister Zähler Verbrauch gezählt hat, lautet die Antwort keine, mit dem Grund `nothing_counted`, nicht null.
- **CODESYS-Runtimes im Test, aufgeschrieben.** Der OPC-UA-Server einer echten Runtime wird mit den SPS-Shell-Befehlen gesichert, die CODESYS dokumentiert, und ein Lesezugriff mit Basic256Sha256 SignAndEncrypt wird gegen sie bewiesen. Ein echter Alarm löst aus, wird quittiert und geht weg nach dem, was eine laufende SPS meldet. Was ein Gerät tut, wenn das zweistündige Demofenster einer unlizenzierten Runtime endet, ist festgehalten, mit dem Zeitleisten-Skript. Das sind Tests und Notizen in [Protokolle und Treiber](/de/iot/protocols/); der Treiber hat sich nicht geändert.
- **Korrekturen, die die Suite fand.** Die Energie-Engine liest einen Zähler nicht mehr, während er gelöscht oder geändert wird (die Datenbank löste den Deadlock, indem sie das Löschen scheitern ließ). Das Manifest eines Backups wird unter einem temporären Namen geschrieben und an Ort und Stelle umbenannt, sodass eine Auflistung nie eine halbe Datei sieht. Das Nachholen des Historians wartet, bis alles bis zu einer Marke geschrieben ist. Der Rest sind Tests, die jetzt auf einem belasteten Node auf das warten, was sie behaupten, statt auf eine feste Zahl von Sekunden.

## Der Boxzustand ist standardmäßig an

Das Chart bindet das Root des Hosts unter `/host` und dessen `/proc` unter `/host/proc` ein, beides nur lesend, und fügt keine Privilegien hinzu: Es werden nur ein statfs und die CPU- und Speicherzähler gelesen. Ein Cluster, das das Restricted-Profil von Pod Security durchsetzt, lehnt einen hostPath ab. Setzen Sie dort `opcuaServer.dashboard.boxHealth.enabled: false` (kein Gerät, keine Mounts) oder `hostMount: false` (das Gerät, mit Platte und CPU der Box als schlecht gelesen und mit dem Hinweis, was einzuhängen ist). Das Quadlet-Drop-in ist `deploy/quadlet/opcua-dashboard.conf`.

## Migrationen

Eine, und sie fügt nur hinzu: `0030_energy_demand` (eine Spalte `demand_price` an Zählern und ihren Eimern, Standard 0, sodass nichts bereits Gezähltes oder Bepreistes sich ändert). Ein Backup der 4.23.1 lässt sich hier wiederherstellen, eines von hier nicht auf einer älteren Version.

## API-Änderungen

`demand_price` im Tarif eines Energiezählers, ein Block `demand` in einer Zusammenfassungszeile, `shift:` und `last_shift:` als Energieperiode und `reason` bei `cost_per_unit`, wenn es null ist. `POST /api/dashboards/import` nimmt `codesys` und `visualization` anstelle von `file`, und sein Bericht trägt eine `conversion`. Siehe [die HTTP-API](/de/iot/api/).

## Update von 4.23.1

Ein normales `helm upgrade`. Die Migration läuft beim ersten Start. Das Chart legt das schreibgeschützte Konto und sein Secret bei der ersten Installation dieser Version an und rotiert es nie; nichts, was schon auf der Box ist, ändert sich.

## Was nicht bewiesen ist

- Elemente, die es nicht kennt, werden aufgelistet und weggelassen, nie geraten, und ein Bildschirm aus einem anderen Projekt kann mehr auflisten.
- Die Echtzeit-Jitter-Tags brauchen einen Agenten, der die Datei schreibt, und diese Version installiert keinen.
- Das Nur-Lese-Login und das Zertifikatsvertrauen wurden mit HotLoops eigenem Client belegt. Die Seite des EmberNet-Dashboards ist eine eigene Version.
- Der sichere CODESYS-Endpunkt wurde im Test auf einer Runtime-Version bewiesen. HotLoops Treiber hat sich dafür nicht geändert, und kein Einrichtungsbildschirm für den sicheren Endpunkt ist Teil dieser Version.
- Leistungspreise wurden an aufgezeichneten Messwerten geprüft, nicht an der Rechnung eines Versorgers.
