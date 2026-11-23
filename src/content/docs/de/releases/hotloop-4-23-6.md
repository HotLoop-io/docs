---
title: "Versionshinweise: HotLoop core 4.23.6"
description: "Was HotLoop core 4.23.6 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "4.23.6"
---

Die Kästchen der Roadmap für Protect, Access und Stromboxen bekommen Code, das Shelly-Gerät spricht direkt mit dem Shelly, und OPC UA PubSub bekommt Nachrichtensicherheit und Metadaten. Nur für amd64 gebaut; der Multi-Arch-Build folgt als nächste Version.

## Was sich geändert hat

- **UniFi Protect, als Gerät.** Protokoll `unifi-protect`, mit einem API-Schlüssel von der Seite Integrations der Konsole, versiegelt wie ein Konsolenpasswort und mit angeheftetem Zertifikat. Kameras, Sensoren, Lichter und Sirenen sind Tags, die sich selbst hinzufügen. Bewegung und intelligente Erkennungen einer Kamera (Person, Fahrzeug, Paket, Kennzeichen, Gesicht, Tier) kommen aus dem Events-Websocket und lesen sich schlecht, solange er unten ist, nie „keine Bewegung“. Eine Sirene lässt sich scharf schalten, damit sie ertönt, und `alarm.<trigger>.fire` sendet den Webhook des Alarmmanagers, sodass ein HotLoop-Alarm die Kameras aufzeichnen lässt. Der Schnappschuss einer Kamera ist eine Route. Jedes Ereignis steht im Logbook. Siehe [UniFi Network](/de/iot/unifi/#unifi-protect).
- **UniFi Access, als Gerät.** Protokoll `unifi-access`, mit einem API-Token. Stellung und Verriegelung jeder Tür sind Tags, vom Notifications-Websocket aktuell gehalten, und jede Änderung steht im Logbook. Entriegeln ist ein Schreibzugriff, den eine Person scharf schaltet, durch das Schreibtor, protokolliert. Siehe [UniFi Network](/de/iot/unifi/#unifi-access).
- **Ausgänge der SmartPower-PDU.** Relais, Leistung, Strom, Spannung und Leistungsfaktor eines Ausgangs sind Tags des UniFi-Network-Geräts, und die Gesamtaufnahme einer PDU ist eines. Schreibt man `on` auf einen Ausgang, schaltet das ihn und behält den Namen jedes anderen Ausgangs; `cycle` schaltet ihn aus, wartet und schaltet ihn wieder ein, höchstens einmal in 15 Minuten, und endet immer an. Siehe [UniFi Network](/de/iot/unifi/#smartpower-pdu-steckdosen).
- **Ein Shelly-Gerät.** Protokoll `shelly`: RPC ab Gen2 mit dem eigenen Digest-Login des Geräts, Tags für jede Komponente, die es meldet, Schreibzugriffe für Switch, Licht, Rollladen und Thermostat. Gen1 wird mit einer Meldung abgelehnt, die es zu MQTT schickt.
- DataSetMetaData- und Discovery-Antworten, bei Größe in Stücken, gelesen aus aufgezeichneten Nachrichten eines Siemens-Publishers. Der Publisher kündigt seine Metadaten standardmäßig alle zehn Intervalle an (`HOTLOOP_UADP_PUBLISH_METADATA_EVERY`, 0 schaltet es aus). Siehe [Protokolle und Treiber](/de/iot/protocols/).
- **Der Entleerer der Weiterleitungswarteschlange schaut erneut nach und sagt, wenn er scheitert.** Ein Durchlauf, der nichts sendete, während Messwerte warteten, wartete früher auf einen Anstoß, den eine ruhige Abfrage nie sendet, und ein gescheiterter Durchlauf wich eine halbe Minute zurück, ohne eine Zeile im Log.
- **Tests warten auf das, worauf sie warten.** Sechs Energietests warten auf die Messwerte des Aufbaus statt auf eine feste Pause.

- **Ein stilles Modbus-Gerät liest sich an jedem Punkt schlecht.** Auf einer seriellen Leitung nutzte eine Anfrage, die ablief, die ganze Abfragefrist, sodass nur der erste Block schlecht wurde und jeder spätere Punkt seinen letzten guten Wert behielt, solange das Kabel gezogen blieb. Jetzt markiert ein Gerät, das nichts antwortet, jeden Punkt in derselben Abfrage als schlecht. Siehe [Protokolle und Treiber](/de/iot/protocols/).
- **Fertige Funktionen werden eingeschaltet ausgeliefert.** Im Helm-Chart und im Binary: der eingebettete MQTT-Broker (seine Logins werden in HotLoop angelegt), der OPC-UA-Server (Authentifizierung an, mit einem erzeugten `opcua-reader`-Login, den Settings einem Admin zeigt), geplante Berichte, das tägliche lokale Backup (alle 24 Stunden, 5-Gi-Volume), der ServiceMonitor (nur dort gerendert, wo die CRDs des Prometheus-Operators existieren, sodass sich ein Cluster ohne sie wie zuvor installiert) und ein Ingress ohne Hostnamen, der jeden Host beantwortet, den die Klasse bedient, bis `ingress.hosts[0].host` gesetzt ist. Berichte, Backups, die OPC-UA-Zertifikate und die Edge-Warteschlange verwenden standardmäßig ein beschreibbares Verzeichnis unter HotLoops Datenverzeichnis, und ein Port, den ein anderer Dienst schon hält, bleibt untätig und sagt das. Die Charts `hotloop` und die erzeugten IoT- und Edge-Charts tragen es.
- **Alarmkanäle und der Edge-Publisher sind an und warten auf ein Ziel.** Die Kanäle Webhook, E-Mail, ntfy, Gotify, Discord-Webhook und Discord-Bot sowie `edgePublish` sind ab dem ersten Start an. Einer ohne Ziel hält die Installation oder den Start nicht mehr an: Er wartet und sagt das. Ein Admin trägt jedes Ziel unter Settings, „Where alarms and readings go“, ein, und was dort gespeichert wird, hat Vorrang vor den Chart-Werten. Die Alarmkanäle gelten beim Speichern; das Ziel des Edge-Publishers gilt beim nächsten Neustart. Settings hat außerdem eine OPC-UA-Server-Karte mit dem Endpunkt und dem erzeugten Login.
- **Das Kafka-Ziel wartet, bis ein Broker ein neues Topic platziert.** Ein einzelner Broker, den ein ausgelasteter Host einen Moment abriegelt, ließ den ersten Blick mit `INVALID_REPLICATION_FACTOR` scheitern; das Ziel wartet jetzt, bis seine Zeit abläuft, und sagt, was der Broker antwortete.
- **Der Entleerer der Weiterleitungswarteschlange schaut erneut nach und sagt, wenn er scheitert.** Ein Durchlauf, der nichts sendete, während Messwerte warteten, wartete früher auf einen Anstoß, den eine ruhige Abfrage nie sendet, und ein gescheiterter Durchlauf wich eine halbe Minute zurück, ohne eine Zeile im Log.

- **Übernommen aus 4.23.4 und 4.23.5.** TwinCAT-`.TcVIS`- sowie cds-text-sync- und codescribe-Bildschirme werden mit ihren Schaltflächen, Rahmen, Lampen und Ausdrucksregeln importiert, und die Aktualisierung des UniFi-Bildschirms wartet auf die Ansicht, die gerade lädt. Keine der beiden Versionen wurde veröffentlicht, also sind beide hier. Siehe [4.23.4](/de/releases/hotloop-4-23-4/) und [4.23.5](/de/releases/hotloop-4-23-5/).

## Migrationen

Keine.

## API-Änderungen

`GET /api/unifi-protect/{id}/cameras/{camera}/snapshot` liefert das aktuelle JPEG der Kamera. Die Protokollliste hat `unifi-protect` und `unifi-access`. Siehe [die HTTP-API](/de/iot/api/).

## Update von 4.23.5

Ein normales `helm upgrade`. Keine Migration und kein neues Secret. 4.23.4 und 4.23.5 wurden getaggt, und ihre Release-Läufe scheiterten im Test-Job, bevor etwas veröffentlicht wurde, sodass das letzte Release vor diesem die 4.23.3 ist und dieses die Änderungen beider trägt. Eine Werte-Datei, die eine der obigen Funktionen setzt, hat weiterhin Vorrang; setzen Sie eine auf `false`, und sie rendert keinen Listener, Service, kein Volume und keinen Ingress.

## Was nicht bewiesen ist

- Protect, Access und die Ausgänge der PDU wurden nach den veröffentlichten APIs gebaut und an Ersatzkonsolen gemessen, die Zustand halten. Keines war auf einer echten Konsole oder PDU, daher sind ihre Kästchen in der Roadmap nicht abgehakt.
- Ein an eine Alarmbenachrichtigung angehängter Schnappschuss ist nicht gebaut.
- PubSub: Ein Security Key Service ist nicht gebaut (Schlüssel sind statisch), und kein Publisher von Siemens, CODESYS oder Beckhoff war auf einem Prüfstand.
- Das Deaktivieren von UniFi-Ports wartet weiter auf die Anfrage der Web-Oberfläche einer echten 10.6-Konsole.
