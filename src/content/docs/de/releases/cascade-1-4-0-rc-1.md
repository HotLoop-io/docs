---
title: "Versionshinweise: HotLoop Cascade 1.4.0-rc.1"
description: "Was HotLoop Cascade 1.4.0-rc.1 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "1.4.0-rc.1"
---

Dies ist ein Release Candidate für 1.4.0. Er bewegt kein Tag `stable`, `latest`, `1.4` oder `1` und steht nicht im App-Store-Index, also zieht ihn standardmäßig nichts. Es ist der Code, den 1.4.0 ausliefern wird, vor dem echten Tag gezogen und auf einem echten Podman-Host ausgeführt, und 1.4.0 wird dieser Code sein, nur mit geänderten Versionsstrings. Lesen Sie die Notizen zu 1.4.0, um zu sehen, was drin ist.

## Worum es geht

1.4.0 macht eine Cascade-Installation auf lange Sicht leichter zu betreiben: Der Server wartet auf seine Datenbank, statt abzustürzen, beendete Läufe können für eine Anzahl von Tagen aufbewahrt und samt ihrer Dateien aufgeräumt werden, ein Eigentümer kann begrenzen, wie oft ein API-Schlüssel Aufrufe macht, und die ganze Instanz lässt sich sichern und zurückspielen. Außerdem erledigt es den einen Skalierungstest, den die Roadmap noch offen hatte. Die Engine, das Dateiformat der Workflows, die REST-API, der MCP-Server (83 Tools) und die 14 Sprachen sind die von 1.3.0.

## Wartet auf seine Datenbank

In der geteilten Installation (Server-, Worker- und Webhook-Pods auf PostgreSQL) starteten die Pods früher, bevor der Name der Datenbank aufgelöst wurde, und starteten zwei- oder dreimal neu, bevor sie bereit waren. 1.2.1 und 1.3.0 taten dasselbe. Ein Server, Worker oder Webhook, der seine Datenbank nicht erreicht, sagt das jetzt in seinem Log ("waiting for the database", mit der bisherigen Wartezeit) und versucht es erneut, bis zu fünf Minuten lang, und verbindet sich dann, wenn die Datenbank antwortet. Ein falsches Passwort, eine fehlerhafte Adresse oder eine Datenbank, die nicht existiert, stoppen ihn weiterhin sofort, weil Warten das nicht beheben kann. Die Startup-Probe des Charts wartet so lange wie das Programm. Eine frische geteilte Installation auf einem echten k3s zeigte keine Neustarts, in allen drei Läufen des Chart-Tests.

## Beendete Läufe aufbewahren

Die Einstellungen haben ein neues Feld, Beendete Läufe aufbewahren für (Tage), und `PATCH /api/v1/settings` nimmt `retentionDays`. Es ist standardmäßig aus (0), und jeder Lauf wird aufbewahrt wie bisher. Setzen Sie eine Zahl, und einmal pro Stunde löscht ein Hauptknoten die erfolgreichen, fehlgeschlagenen und abgebrochenen Läufe, die länger zurück beendet wurden, samt ihrer Schrittdaten. Ein Lauf, der noch läuft, wird nie angefasst, ebenso wenig ein Lauf, dessen Eltern noch laufen. Jeder Stapel schreibt `execution.pruned` ins Audit-Protokoll, und das Ändern der Einstellung schreibt `instance.retention`.

Derselbe stündliche Durchlauf räumt jetzt auch den Blob-Speicher auf, ob die Aufbewahrung an ist oder nicht: Ausgaben, die zu groß für die Datenbank sind, und Anhänge, auf die kein Lauf mehr zeigt. Eine Datei, die sich zwei Läufe teilen, bleibt, bis der letzte geht, und nur Dateien, die vor mehr als 24 Stunden geschrieben wurden, werden angesehen, sodass eine Datei, die ein Schritt gerade gespeichert hat, nie entfernt wird. Das gilt jetzt auch für Läufe, die Sie von Hand löschen; früher ließ ein gelöschter Lauf seine großen Ausgaben für immer auf der Platte. Ein Durchlauf, der nicht lesen kann, was er braucht, entfernt nichts, und jeder Durchlauf schreibt `blobs.collected` ins Audit-Protokoll.

## Ein Limit für jeden API-Schlüssel

Die Einstellungen haben ein neues Feld, API-Anfragen pro Schlüssel pro Minute, und `PATCH /api/v1/settings` nimmt `apiRateLimit`. Es ist standardmäßig aus. Setzen Sie eine Zahl, und jeder API-Schlüssel und jeder Agent, der sich über MCP mit einem anmeldet, darf so viele Anfragen pro Minute stellen. Ein Aufruf über dem Limit wird mit 429 und einem `Retry-After` beantwortet. Jeder Schlüssel hat seine eigene Zählung, und im Editor angemeldete Personen unterliegen ihr nicht. Die Zählung gehört jedem Prozess einzeln, sodass ein Schlüssel bei drei Hauptknoten bis zum Dreifachen machen kann. Das Ändern schreibt `instance.api_rate_limit` ins Audit-Protokoll.

## Backup und Wiederherstellung

`hotloop-cascade backup DIR` schreibt ein neues Verzeichnis mit einer konsistenten Kopie der SQLite-Datenbank, die bei laufendem Server gezogen wird, der Schlüsseldatei, die alle gespeicherten Zugangsdaten versiegelt, den Blob-Dateien und einer `manifest.json` mit ihren Hashes. `hotloop-cascade restore DIR` spielt sie zurück, nachdem jede Datei gegen das Manifest geprüft wurde, und weigert sich, eine Datenbank oder einen anderen Schlüssel zu überschreiben, außer Sie geben `--replace` an. Bei PostgreSQL enthält das Backup den Schlüssel, die Blobs und das Manifest und gibt den `pg_dump`-Befehl für die Datenbankhälfte aus; die Wiederherstellung gibt den für `pg_restore` aus. Blobs in S3 oder Azure werden nicht kopiert. `docs/GOVERNANCE.md` hat die Details.

## Die Tests, die dahinterstanden

- Der Skalierungstest, den die Roadmap vorgab, ist erledigt. Zwei Hauptknoten auf einem PostgreSQL führten eine Stunde lang einen Workflow aus, der jede Minute auslöst, während einer von ihnen an der Slot-Grenze mit SIGKILL beendet wurde, siebenmal hintereinander und jeweils etwa 25 Sekunden unten gelassen: 61 Läufe für 61 Minuten-Slots, keiner verpasst, keiner doppelt.
- Der OAuth-Server des Test-Stacks (Hydra) läuft jetzt auf Postgres. Er scheiterte vorher in parallelen Läufen, bestand danach und scheiterte erneut, als die Änderung zurückgenommen wurde. Kein Cascade-Code inspiziert Tokens.
- Der Chart-Test schlägt jetzt fehl, wenn ein Pod bei der Installation neu startet.
- Die zwei neuen Einstellungs-Ablehnungen sind in jeder Sprache übersetzt, und die Einstellungshilfe sagt, dass die großen Ausgaben mit ihren Läufen gehen.

## Nur amd64, und warum

Diese Version wird nur für amd64 gebaut. Multi-Arch kommt in einem eigenen Lauf, also ist die Version nach dieser ein kleiner Versionssprung, der beide baut. `stable`, `latest`, `1.4` und `1` führen das neue amd64-Image neben dem arm64-Image auf, auf das sie schon zeigten.

## Upgrade und zurück

Keine Migrationen: Das Schema ist das von 1.3.0. `helm upgrade` auf 1.4.0, oder lassen Sie `:stable` die Quadlet-Units weiterbewegen. 1.3.1 zurückzuspielen ist sicher, weil sich in der Datenbank nichts geändert hat. Was ein Rollback nicht rückgängig machen kann, ist ein Bereinigen: Läufe, die die Aufbewahrung gelöscht hat, sind weg, ebenso die Blobs, die das stündliche Aufräumen entfernt hat. Die Aufbewahrung ist aus, bis Sie sie einschalten, also machen Sie vorher ein Backup; das Blob-Aufräumen läuft auch ohne sie.
