---
title: "Versionshinweise: HotLoop core 4.23.1"
description: "Was HotLoop core 4.23.1 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "4.23.1"
---

Diese Version trägt alles, was die Hinweise zur 4.23.0 auflisten. Wetter und Energie, die Web-Oberfläche in dreizehn weiteren Sprachen, Bildschirme, die als Dateien zwischen Installationen wandern, und die ersten Befehle an eine UniFi-Konsole. Nur für amd64 gebaut; der Multi-Arch-Build folgt als nächste Version.

## Was sich geändert hat

- **Eine Wetterstation ist eine einzige Entität.** Sie wird aus den Tags gebaut, die eine Dachstation schon veröffentlicht (Temperatur, Feuchte, Druck, Wind, Regen, Solar), mit Taupunkt, Hitzeindex und gefühlter Windkälte, auf der Box berechnet. Ein Sensor, den die Station nicht bekommen hat, hat keine Zeile, und einer, der nicht mehr antwortet, liest sich Unavailable, nie null. Es wird kein Cloud-Dienst aufgerufen. Siehe [Weather](/de/iot/weather/).
- **Energiezähler.** Ein Zähler ist ein Tag, der als verbrauchte Menge gelesen wird (ein kumulierender Zähler wie kWh, Gas, Wasser oder Luft, oder eine Leistung). Was verbraucht wurde, wird in 15-Minuten-Eimern gehalten, sodass ein Neustart nichts verliert und eine Schicht, ein Tag oder ein Monat eine Summe ist. Ein Tarif gibt jedem Eimer beim Anlegen Kosten, sodass ein später geänderter Preis nicht ändert, was der letzte Monat gekostet hat, und die Kosten einer gefertigten Einheit werden aus einem Produktionszähler berechnet. Es gibt einen Bildschirm Energy, die API und MCP-Werkzeuge. Siehe [Energy](/de/iot/energy/).
- **Die Web-Oberfläche kommt in dreizehn weiteren Sprachen** neben Englisch: Spanisch, Französisch, Italienisch, Deutsch, Norwegisch, Bulgarisch, Griechisch, Koreanisch, Japanisch, Vietnamesisch, Hindi, vereinfachtes Chinesisch und Arabisch, von rechts nach links gesetzt. Wählen Sie eine in der oberen Leiste oder auf der Anmeldekarte. Siehe [Languages](/de/iot/languages/).
- **Ein Dashboard lässt sich in eine Datei exportieren und in eine andere Installation importieren.** Die Bildschirme eines Kunden gehören ihm und sind nie Teil des Produkts: Die Datei listet jedes Tag, Gerät, Skript und Rezept auf, das sie nennt, und ein Import meldet alle Probleme auf einmal, mit einer Zuordnung für abweichende Namen, bevor irgendetwas gespeichert wird. Export und Import sind Schaltflächen auf dem Bildschirm Dashboards, und `screen_export` und `screen_import` sind MCP-Werkzeuge. Siehe [Screen files](/de/iot/screen-file/).
- **MCP-Lesezugriffe, die zu seinen Schreibzugriffen gehören**, die Probeläufe der Editoren und der CODESYS-Alarmimport.
- **Die ersten Befehle an eine UniFi-Konsole.** Fünf Arten von Punkten lassen sich steuern, jeder nur lesend, bis eine Person dieses Tag scharf schaltet, durch das Schreibtor wie jedes Tag: die Lokalisierungs-LED eines Geräts, ein Geräteneustart, der PoE-Spannungszyklus eines Switch-Ports, ein Funknetz an oder aus, ein beobachteter Client gesperrt oder wieder zugelassen und der PoE-Modus eines Ports. Ein Spannungszyklus unterliegt einer Abkühlzeit von 15 Minuten, die in der Datenbank gehalten wird, sodass ein Neustart sie nicht vergisst, und ein Port, der das Netz trägt (ein Uplink, ein Switch, ein Gateway, ein 5G-Backup, ein Peer, den die Konsole nicht listet), wird nie gezykelt. Das Konsolenkonto, mit dem sich HotLoop anmeldet, muss dafür lokaler Administrator sein; ein View-Only-Konto wird von der Konsole abgelehnt, und HotLoop sagt das. Ein eingebauter Blueprint zykelt den Port eines stillen Geräts einmal und löst dann einen Alarm aus. Siehe [UniFi Network](/de/iot/unifi/).
- **Der OPC-UA-Server beantwortet HistoryRead** aus dem Verlauf, den das Gateway hält, roh und verarbeitet.
- **OPC-UA-PubSub-Delta-Frames als Option.** `HOTLOOP_UADP_PUBLISH_DELTA_FRAMES=true` sendet nur die Felder, die sich zwischen Key-Frames geändert haben. Standardmäßig aus.
- **Eine Bildkarte auf einer Panel-Seite passt in ihre Karte** und bestimmt die Zeilenhöhe nicht mehr.
- **Die Datenbank-Update-Unit einer Quadlet-Installation überspringt sich selbst,** wenn das Volume nichts zu aktualisieren hat, weil Podman 5.7 keinen Container startet, der nichts auszuführen hat, und der Name der mitgelieferten Datenbank auf die 52 Zeichen zugeschnitten ist, die ein StatefulSet haben kann.
- **Die Charts behalten ihr Zugangsdaten-Secret beim Deinstallieren,** wie das Datenbank-Volume: Eine Neuinstallation mit demselben Namen erzeugte früher ein neues Passwort, das die behaltene Datenbank ablehnte. Um sauber neu zu starten, löschen Sie das Secret von Hand zusammen mit dem Volume.
- **Die Kafka-Ausgabe wartet** beim Broker auf ein eben angelegtes Topic, so lange ihre Verbindung es zulässt, und die dokumentierten Ausfallwarteschlangen-Werte des Edge Relay sind die gemessenen (etwa zwei Minuten bei 2,000 Messwerten pro Sekunde).
- Korrekturen, die die Testsuite fand: Die OPC-UA-Testbenutzer werden mit dem niedrigsten bcrypt-Aufwand gehasht, sodass ein Login in der Suite nicht mehr länger dauert, als der Testclient auf einem langsamen Runner wartet (der Server und sein Login bleiben unverändert), der Live-Feed vergisst, was er gesendet hat, sobald seine letzte Seite geht, der OPC-UA-Server sagt, wann sein Listener den Port hält, und mehrere Tests schlafen nicht mehr auf Dinge, die in ihrer eigenen Zeit geschehen.

## Migrationen

Zwei, jede fügt nur hinzu: `0028_unifi_port_cycles` (wann jeder Switch-Port zuletzt gezykelt wurde) und `0029_energy` (drei Tabellen für Zähler und ihre Eimer). Beide sind in Backups. Ein Backup der 4.22.1 lässt sich hier wiederherstellen, eines von hier nicht auf einer älteren Version.

## API-Änderungen

Neue Routen: `GET /api/energy/meters`, `POST /api/energy/meters`, `GET`, `PUT` und `DELETE /api/energy/meters/{id}`, `GET /api/energy/summary` und `/api/energy/summary/{period}`, `GET /api/energy/series` und `/api/energy/series/{meter}/{period}/{step}`, `GET /api/dashboards/{id}/export`, `POST /api/dashboards/import` und `GET /api/entities/composites`. Zwei neue Berechtigungen: `energy.read`, die jede Rolle hat, und `energy.write`, die ein Admin hat. Neue MCP-Werkzeuge für jede. Eine Wetterstation ist eine neue Entitätsdomäne, `weather`. Siehe [die HTTP-API](/de/iot/api/).

## Update von 4.22.1

Ein normales `helm upgrade`. Die Migrationen laufen beim ersten Start und fügen Tabellen hinzu; kein neues Secret. Nichts, was aus war, wird eingeschaltet.

## Was nicht bewiesen ist

- Die übrigen Befehle wurden nicht gegen eine echte Konsole ausgeführt.
- Wetter und Energie liefen gegen Aufzeichnungen, einen Modbus-Aufbau und Emberburns simulierte Zähler, nicht gegen eine echte Dachstation oder die Zähler einer Anlage.
- Die dreizehn neuen Sprachkataloge wurden aus dem gemeinsamen Glossar geschrieben, und kein Muttersprachler hat sie geprüft.
