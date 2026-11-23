---
title: "Versionshinweise: HotLoop core 4.16.0"
description: "Was HotLoop core 4.16.0 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "4.16.0"
---

Die erste veröffentlichte Version seit der 4.3.1 im August. Alles von 4.4.0 bis 4.15.3 wurde zusammengeführt, aber nie veröffentlicht. Wer auf 4.3.1 ist, bekommt also alles auf einmal, unter neuem Namen, mit neuem Image, neuem Chart und neuer Lizenz. **Von 4.3.1 aus genügt kein einfaches `helm upgrade`.** Lesen Sie unten „Update von 4.3.1“, bevor Sie eine laufende Anlage anfassen.

Die vollständigen Hinweise stehen im README: Was sich in 4.16.0 geändert hat, darunter jede Version bis zurück zur 4.4.0.

## Kurz gesagt

- **HotLoop Core: Entitäten.** Jeder Tag ist eine Entität mit stabiler ID und sitzt in einem ISA-95-Anlagenbaum. Motoren, Ventile, PID-Regelkreise und der Rest sind aus ihren Tags zusammengesetzt, jeder Alarm ist eine Entität, und jeder Entitätsbefehl läuft durch dasselbe Schreibtor wie ein Tag-Schreibzugriff. Agenten (MCP), Automatisierungen und die neuen Bildschirme Entities und Plant nutzen sie alle. Ein Dienstaufruf lässt sich vorab mit `?dry_run=true` erfragen, und die Befehlsabfrage sagt „Would be refused: ...“, bevor Sie bestätigen.
- **Benachrichtigungen, die aufs Handy kommen:** ntfy und der Discord-Bot mit Acknowledge-Schaltfläche, Gotify und ein Discord-Webhook, mit Ratenbegrenzungen, die eine Flut zu einer einzigen Zusammenfassung verdichten.
- **Korrekturen, die auf einer laufenden Anlage zählen:** Das Aufheben der Zurückstellung (unshelve) konnte einen unquittierten Alarm löschen; ein OPC-UA-Abonnement konnte für immer verstummen, während die Sitzung „verbunden“ meldete; ein stummes Modbus-Gerät brauchte bis zu 15 Minuten, um als ausgefallen zu gelten; ein fehlgeschlagener Webhook schrieb seine URL ins Log, die bei Discord und ntfy das Passwort ist; die Wiederherstellung las Spalten nach Position; jedes Redeploy ersetzte das Zertifikat des OPC-UA-Servers, sodass Ignition ihm nicht mehr vertraute; Discover tags importierte jeden OPC-UA-Knoten als float; der Bildschirm Settings nannte Abfragevariablen, die nichts liest.
- **Ignition 8.3.9 liest unseren OPC-UA-Server**, durchgängig geprüft, und der Server meldet jetzt `HotLoop` als Hersteller.
- **Der Edge Relay erscheint** mit eigenem Image und eigenem Chart, im Gleichschritt mit dem Gateway. TimescaleDB 2.30.1, und die Erweiterung aktualisiert sich jetzt selbst.

### API-Änderungen

- Leere Listen sind überall `[]`, nie `null`, auch in Streams.
- `/api/history`-Intervalle ohne gültigen Messwert sind `null` (eine Lücke), und schlechte Messwerte bleiben aus den Mittelwerten heraus.
- Ein Fehler, den die API nicht zuordnen kann, ist ein 500 mit Log-Referenz, kein 400. Ein Gerät, das beim Schreiben oder Durchsuchen fehlschlägt, ergibt einen 502.
- Ein Dienst, den eine Alarm-Entität nicht annimmt (`alarm.turn_on`), ergibt einen 400. Früher antwortete er mit Erfolg und tat nichts.
- Die Zurückstellung eines Alarms aufzuheben, der nicht zurückgestellt ist, ergibt einen 409.
- Das Tag-JSON enthält immer `minValue`, `maxValue` und `hasRange`.
- Neu: `?dry_run=true` bei `POST /api/services/{domain}/{service}`. Nur `true` oder `false`; alles andere ist ein 400.

### Update von 4.3.1

- Image `ghcr.io/hotloop-io/hotloop` (vorher `ghcr.io/embernet-ai/industrial-iot`), Chart-Repository `https://hotloop.io/hotloop`, Chart `hotloop` (vorher `industrial-iot`), und jede Variable `IIOT_` heißt jetzt `HOTLOOP_`.
- Der Chart-Name steckt in den Workload-Selektoren, die Kubernetes nicht an Ort und Stelle ändert. Behalten Sie Release-Namen und Namespace und gehen Sie dann so vor: `pg_dump` der Datenbank; das alte Deployment (`<release>`) und das StatefulSet (`<release>-postgresql`) löschen, wodurch das Datenbank-Volume bleibt, wo es ist; `helm upgrade <release> hotloop/hotloop -f your-4.3.1-values.yaml`. Nicht mit `--reuse-values`. Benennen Sie jedes `IIOT_` in `extraEnv` um und entfernen Sie eine Überschreibung von `image.repository`. Der neue Datenbank-Pod bindet das alte Volume ein, und das Gateway migriert es beim Start vorwärts.
- Lizenz: HotLoops eigene Lizenzbedingungen, nicht die der 4.3.1. Kostenlos für Heim und Labor; Unternehmen melden sich kostenlos über EmberNet an. Die aktuellen Bedingungen stehen in LICENSE.
- Es gibt eine Anmeldung, Schreibzugriffe sind standardmäßig aus, und eine Zeitzone, die sich nicht laden lässt, stoppt den Start, statt mit UTC weiterzulaufen.
